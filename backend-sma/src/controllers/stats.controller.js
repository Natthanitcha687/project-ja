import { prisma } from '../db/prisma.js'

// helper แบบเดียวกับ customer.controller
function dateOnlyUTC(v) {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d)) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function statusFromDate(expiryDate, notifyDays = 30) {
  const exp = dateOnlyUTC(expiryDate)
  if (!exp) return { status: 'active', daysLeft: null }

  const today = dateOnlyUTC(new Date())
  const ONE_DAY = 24 * 60 * 60 * 1000
  const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / ONE_DAY)

  if (daysLeft < 0) return { status: 'expired', daysLeft }
  if (daysLeft <= (notifyDays ?? 30)) return { status: 'nearing_expiration', daysLeft }
  return { status: 'active', daysLeft }
}

export async function getStats(_req, res) {
  try {
    const stores = await prisma.user.count({ where: { role: 'STORE' } })
    const customers = await prisma.user.count({ where: { role: 'CUSTOMER' } })
    const warranties = await prisma.warranty.count()

    // satisfaction: average rating & total
    const agg = await prisma.satisfaction.aggregate({
      _avg: { rating: true },
      _count: { id: true },
    })

    const satisfaction = {
      average: agg._avg.rating ? Number(Number(agg._avg.rating).toFixed(2)) : null,
      count: agg._count.id || 0,
    }

    res.json({ stores, customers, warranties, satisfaction })
  } catch (e) {
    console.error('getStats error', e)
    res.status(500).json({ message: 'Server error' })
  }
}

export async function getWarrantyStatusSummary(_req, res) {
  try {
    const items = await prisma.warrantyItem.findMany({
      select: {
        expiryDate: true,
        warranty: {
          select: {
            store: {
              select: {
                storeProfile: {
                  select: { notifyDaysInAdvance: true },
                },
              },
            },
          },
        },
      },
    })

    const totals = { active: 0, nearing_expiration: 0, expired: 0 }

    for (const it of items) {
      const notifyDays =
        it.warranty?.store?.storeProfile?.notifyDaysInAdvance ?? 30
      const s = statusFromDate(it.expiryDate, notifyDays)
      if (s.status === 'active') totals.active += 1
      else if (s.status === 'nearing_expiration') totals.nearing_expiration += 1
      else if (s.status === 'expired') totals.expired += 1
    }

    res.json({ totals })
  } catch (e) {
    console.error('getWarrantyStatusSummary error', e)
    res.status(500).json({ message: 'Server error' })
  }
}

export async function postFeedback(req, res) {
  try {
    const { rating, comment, storeId, warrantyId } = req.body
    const r = Number(rating || 0)
    if (!r || r < 1 || r > 5) return res.status(400).json({ message: 'rating must be 1..5' })

    // user id optional - try to read from auth header if token exists
    let userId = null
    try {
      const header = req.headers.authorization || ''
      const token = header.startsWith('Bearer ') ? header.slice(7) : null
      if (token) {
        const p = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
        userId = Number(p.sub || null)
      }
    } catch { /* ignore */ }

    const created = await prisma.satisfaction.create({
      data: { rating: r, comment: comment || null, userId: userId || null, storeId: storeId ? Number(storeId) : null, warrantyId: warrantyId || null }
    })

    // ถ้าเป็นผู้ใช้ที่ล็อกอินอยู่ ให้ถือว่าตอบแบบประเมินแล้ว → ไม่ต้องเด้ง popup อีก
    if (userId) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { hasSeenSatisfactionSurvey: true },
        })
      } catch (e) {
        // ถ้าอัปเดตสถานะไม่สำเร็จ ไม่ต้องทำให้ API ล้ม
        console.warn('update hasSeenSatisfactionSurvey failed', e?.message || e)
      }
    }

    res.status(201).json({ ok: true, feedback: created })
  } catch (e) {
    console.error('postFeedback error', e)
    res.status(500).json({ message: 'Server error' })
  }
}

// ตรวจสอบว่า user ควรแสดง popup แบบประเมินความพึงพอใจหรือยัง
// เงื่อนไข:
// - ต้องล็อกอิน (อ่านจาก JWT ใน Authorization header)
// - ROLE = CUSTOMER → นับจำนวน Warranty ที่ customerUserId = user.id
// - ROLE = STORE    → นับจำนวน Warranty ที่ storeId = user.id
// - แสดงครั้งแรกเมื่อมีใบรับประกันครบอย่างน้อย 3 ใบ และไม่เคยเห็นมาก่อน
export async function getUsageSurveyEligibility(req, res) {
  try {
    let userId = null
    try {
      const header = req.headers.authorization || ''
      const token = header.startsWith('Bearer ') ? header.slice(7) : null
      if (token) {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
        )
        userId = Number(payload.sub || null)
      }
    } catch {
      // ignore decode errors → ปล่อยให้เป็น unauthenticated
    }

    if (!userId) {
      return res.json({ shouldShow: false, reason: 'unauthenticated' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        email: true,
        hasSeenSatisfactionSurvey: true,
        lastSatisfactionSurveyWarrantiesCount: true,
      },
    })

    if (!user) {
      return res.json({ shouldShow: false, reason: 'user_not_found' })
    }

    let warrantiesCount = 0
    if (user.role === 'CUSTOMER') {
      // ลูกค้าอาจผูกใบรับประกันด้วยทั้ง customerUserId หรือแค่อีเมล
      warrantiesCount = await prisma.warranty.count({
        where: {
          OR: [
            { customerUserId: user.id },
            { customerEmail: user.email },
          ],
        },
      })
    } else if (user.role === 'STORE') {
      warrantiesCount = await prisma.warranty.count({ where: { storeId: user.id } })
    } else {
      return res.json({ shouldShow: false, reason: 'role_not_applicable' })
    }

    // ถ้าเคยตอบแบบประเมินแล้ว (hasSeenSatisfactionSurvey = true) → ไม่ต้องเด้งอีก
    if (user.hasSeenSatisfactionSurvey) {
      return res.json({ shouldShow: false, reason: 'already_submitted', warrantiesCount })
    }

    // เงื่อนไขเด้ง popup:
    // - มีใบรับประกันในระบบอย่างน้อย 3 ใบ
    // - และจำนวนใบรับประกันตอนนี้ "มากกว่า" ครั้งล่าสุดที่เคยเด้ง popup
    const lastCount = user.lastSatisfactionSurveyWarrantiesCount ?? 0
    const shouldShow = warrantiesCount >= 3 && warrantiesCount > lastCount

    if (shouldShow) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastSatisfactionSurveyWarrantiesCount: warrantiesCount },
      })
    }

    return res.json({
      shouldShow,
      role: user.role,
      warrantiesCount,
      lastCount,
    })
  } catch (e) {
    console.error('getUsageSurveyEligibility error', e)
    res.status(500).json({ message: 'Server error' })
  }
}
