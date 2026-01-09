// backend-sma/src/controllers/customer.controller.js
import bcrypt from 'bcryptjs'
import { prisma } from '../db/prisma.js'
import * as warrantyCtrl from './warranty.controller.js'
import { createAndPublish as createNotification } from '../routes/notifications.routes.js'

/* =========================
 * Utilities
 * ========================= */

// UTC-safe date-only helper
function dateOnlyUTC(v) {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d)) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// ใช้สูตร UTC date-only + Math.ceil ให้ตรงกับฝั่งร้าน/หน้ารายการอื่น ๆ
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

function bool(v, fallback = false) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    if (/^(true|1|yes|on)$/i.test(v)) return true
    if (/^(false|0|no|off)$/i.test(v)) return false
  }
  return fallback
}

function trimOrNull(s) {
  if (typeof s !== 'string') return null
  const t = s.trim()
  return t ? t : null
}

/* =========================
 * Profile APIs (NEW)
 * ========================= */

// GET /customer/profile
export async function getMyProfile(req, res, next) {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customerProfile: true },
    })
    if (!me || me.role !== 'CUSTOMER') {
      return res.status(404).json({ message: 'ไม่พบบัญชีลูกค้า' })
    }

    const p = me.customerProfile
    return res.json({
      email: me.email,
      firstName: p?.firstName ?? '',
      lastName: p?.lastName ?? '',
      phone: p?.phone ?? '',
      isConsent: !!p?.isConsent,
      avatarUrl: p?.avatarUrl ?? '',
    })
  } catch (err) {
    next(err)
  }
}

// PATCH /customer/profile
export async function updateMyProfile(req, res, next) {
  try {
    const body = req.body ?? {}

    const [me, exist] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id } }),
      prisma.customerProfile.findUnique({ where: { userId: req.user.id } }),
    ])

    if (!me || me.role !== 'CUSTOMER') {
      return res.status(404).json({ message: 'ไม่พบบัญชีลูกค้า' })
    }

    const data = {
      firstName: trimOrNull(body.firstName) ?? (exist?.firstName ?? ''),
      lastName: trimOrNull(body.lastName) ?? (exist?.lastName ?? ''),
      phone: trimOrNull(body.phone) ?? (exist?.phone ?? ''),
      isConsent: bool(body.isConsent, exist?.isConsent ?? false),
      avatarUrl: trimOrNull(body.avatarUrl) ?? (exist?.avatarUrl ?? ''),
    }

    let saved
    try {
      saved = await prisma.customerProfile.upsert({
        where: { userId: req.user.id },
        update: data,
        create: { userId: req.user.id, ...data },
      })
    } catch (err) {
      // Fallback for environments where Prisma client wasn't regenerated yet
      // (so `avatarUrl` may be an unknown field). Retry without avatarUrl.
      const msg = String(err?.message || '')
      if (msg.includes('avatarUrl') || msg.includes('Invalid `prisma.customerProfile.upsert()` invocation')) {
        const { avatarUrl, ...dataNoAvatar } = data
        saved = await prisma.customerProfile.upsert({
          where: { userId: req.user.id },
          update: dataNoAvatar,
          create: { userId: req.user.id, ...dataNoAvatar },
        })
      } else {
        throw err
      }
    }

    // Create a notification for the user about profile update
    try {
      await createNotification({ prisma, attrs: {
        userId: me.id,
        title: 'อัปเดตโปรไฟล์',
        body: 'ข้อมูลโปรไฟล์ของคุณได้รับการอัปเดตแล้ว',
        data: { type: 'profile_updated' }
      } })

      // Notify stores that have warranties linked to this customer (by userId or email)
      try {
        const linked = await prisma.warranty.findMany({
          where: {
            OR: [
              { customerUserId: me.id },
              { customerEmail: me.email }
            ]
          },
          select: { storeId: true }
        })
        const storeIds = [...new Set(linked.map(l => l.storeId).filter(Boolean))]
        for (const sid of storeIds) {
          try {
            await createNotification({ prisma, attrs: {
              storeId: sid,
              title: 'ลูกค้ามีการอัปเดตโปรไฟล์',
              body: `ลูกค้า ${saved.firstName || ''} ${saved.lastName || ''} ได้อัปเดตโปรไฟล์`,
              data: { type: 'customer_profile_updated', userId: me.id }
            } })
          } catch (e) {
            console.warn('notify store of customer profile update failed', e?.message || e)
          }
        }
      } catch (e) {
        console.warn('find linked stores for profile update failed', e?.message || e)
      }
    } catch (e) {
      // ignore notification errors
      console.warn('notify user profile update failed', e?.message || e)
    }

    return res.json({
      message: 'บันทึกโปรไฟล์เรียบร้อย',
      profile: {
        email: me.email,
        firstName: saved.firstName,
        lastName: saved.lastName,
        phone: saved.phone,
        isConsent: saved.isConsent,
        avatarUrl: saved.avatarUrl ?? '',
      },
    })
  } catch (err) {
    next(err)
  }
}

// PATCH /customer/change-password
export async function changeMyPassword(req, res, next) {
  try {
    const { old_password = '', new_password = '' } = req.body ?? {}

    const me = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!me || me.role !== 'CUSTOMER') {
      return res.status(404).json({ message: 'ไม่พบบัญชีลูกค้า' })
    }

    // ตรวจของเก่า
    const valid = await bcrypt.compare(String(old_password), me.passwordHash)
    if (!valid) {
      return res.status(400).json({ message: 'รหัสผ่านเดิมไม่ถูกต้อง' })
    }

    // ตรวจของใหม่
    if (typeof new_password !== 'string' || new_password.length < 8) {
      return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' })
    }
    const same = await bcrypt.compare(String(new_password), me.passwordHash)
    if (same) {
      return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม' })
    }

    const hash = await bcrypt.hash(String(new_password), 12)
    await prisma.user.update({
      where: { id: me.id },
      data: { passwordHash: hash },
    })

    return res.json({ message: 'เปลี่ยนรหัสผ่านเรียบร้อย' })
  } catch (err) {
    next(err)
  }
}

/* =========================
 * Warranties (EXISTING)
 * ========================= */

// GET /customer/warranties
export async function getMyWarranties(req, res, next) {
  try {
    const q = (req.query.q || '').trim()
    const status = req.query.status || 'all'

    const customerCond = {
      OR: [{ customerUserId: req.user.id }, { customerEmail: req.user.email }],
    }

    const where = q
      ? {
          AND: [
            customerCond,
            {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { items: { some: { productName: { contains: q, mode: 'insensitive' } } } },
                { store: { storeProfile: { storeName: { contains: q, mode: 'insensitive' } } } },
              ],
            },
          ],
        }
      : customerCond

    const list = await prisma.warranty.findMany({
      where,
      include: {
        store: { include: { storeProfile: true } },
        items: true, // images เป็น Json ใน item อยู่แล้ว
      },
      orderBy: { createdAt: 'desc' },
    })

    // enrich per item + filter by status
    const totalsCounter = { all: 0, active: 0, nearing_expiration: 0, expired: 0 }
    const filtered = list
      .map((w) => {
        const notifyDays = w.store?.storeProfile?.notifyDaysInAdvance ?? 30
        const items = (w.items || []).map((it) => {
          const s = statusFromDate(it.expiryDate, notifyDays)
          totalsCounter.all += 1
          totalsCounter[s.status] += 1
          return { ...it, _status: s.status, _daysLeft: s.daysLeft }
        })

        const itemsAfterFilter = status === 'all' ? items : items.filter((i) => i._status === status)
        return { ...w, items: itemsAfterFilter }
      })
      .filter((w) => w.items.length > 0 || status === 'all')

    res.json({
      totals: totalsCounter,
      data: filtered,
    })
  } catch (err) {
    next(err)
  }
}

// PATCH /customer/warranty-items/:itemId/note
export async function updateMyNote(req, res, next) {
  try {
    const { itemId } = req.params // cuid string
    const { note = '' } = req.body

    const item = await prisma.warrantyItem.findUnique({
      where: { id: itemId },
      include: { warranty: true },
    })
    if (!item) return res.status(404).json({ message: 'Item not found' })

    const isOwner =
      item.warranty.customerUserId === req.user.id ||
      (item.warranty.customerEmail && item.warranty.customerEmail === req.user.email)

    if (!isOwner) return res.status(403).json({ message: 'Forbidden' })

    const updated = await prisma.warrantyItem.update({
      where: { id: itemId },
      data: { customerNote: String(note) },
    })

    res.json({ message: 'Saved', item: updated })

    // notify store about customer note
    try {
      if (updated && updated.warrantyId) {
        const w = await prisma.warranty.findUnique({ where: { id: updated.warrantyId }, select: { storeId: true } })
        if (w?.storeId) {
          const { createAndPublish } = await import('../routes/notifications.routes.js')
          await createAndPublish({ prisma, attrs: {
            storeId: w.storeId,
            title: 'ลูกค้ามีข้อความใหม่ในรายการรับประกัน',
            body: `ลูกค้าได้เพิ่มบันทึกในรายการ (id: ${updated.id})`,
            data: { type: 'customer_note_added', warrantyId: updated.warrantyId, warrantyItemId: updated.id }
          } })
        }
      }
    } catch (e) { console.warn('notify store customer note failed', e?.message || e) }
  } catch (err) {
    next(err)
  }
}

// GET /customer/warranties/:warrantyId/pdf
export async function getMyWarrantyPdf(req, res, next) {
  try {
    const { warrantyId } = req.params

    const w = await prisma.warranty.findUnique({ where: { id: warrantyId } })
    if (!w) return res.status(404).json({ message: 'Not found' })

    const isOwner =
      w.customerUserId === req.user.id ||
      (w.customerEmail && w.customerEmail === req.user.email)

    if (!isOwner) return res.status(403).json({ message: 'Forbidden' })

    // ส่งต่อให้ตัว renderer ที่มีอยู่จริง
    req.params.warrantyId = warrantyId
    return warrantyCtrl.downloadWarrantyPdf(req, res, next)
  } catch (err) {
    next(err)
  }
}
/* =========================
 * Complaints (NEW)
 * ========================= */

// POST /customer/complaints
export async function createMyComplaint(req, res, next) {
  try {
    const me = await prisma.user.findUnique({ where: { id: Number(req.user.id) } })
    if (!me || me.role !== 'CUSTOMER') {
      return res.status(404).json({ message: 'ไม่พบบัญชีลูกค้า' })
    }

    const body = req.body ?? {}
    const category = trimOrNull(body.category)
    const subject = trimOrNull(body.subject)
    const message = trimOrNull(body.message)

    if (!subject) return res.status(400).json({ message: 'กรุณากรอกหัวข้อ (subject)' })
    if (!message) return res.status(400).json({ message: 'กรุณากรอกรายละเอียด (message)' })

    if (subject.length > 200) {
      return res.status(400).json({ message: 'subject ยาวเกินไป (สูงสุด 200 ตัวอักษร)' })
    }
    if (message.length > 5000) {
      return res.status(400).json({ message: 'message ยาวเกินไป (สูงสุด 5000 ตัวอักษร)' })
    }

    // ✅ เพิ่ม: รับไฟล์แนบจาก multer (field: images)
    const uploaded = []
    const files = req.files
    if (Array.isArray(files)) {
      uploaded.push(...files)
    } else if (files && typeof files === 'object') {
      for (const v of Object.values(files)) {
        if (Array.isArray(v)) uploaded.push(...v)
      }
    }
    // เก็บเป็น path เพื่อให้ frontend/admin เปิดรูปได้ผ่าน static /uploads
    const imagePaths = uploaded
      .filter((f) => f && f.filename)
      .map((f) => `/uploads/complaints/${f.filename}`)

    let complaint
    try {
      complaint = await prisma.complaint.create({
        data: {
          userId: me.id,
          category,
          subject,
          message,
          images: imagePaths, // ✅ เพิ่ม
        },
      })
    } catch (err) {
      // Fallback: ถ้า prisma client ยังไม่ได้ generate/migrate field images
      const msg = String(err?.message || '')
      if (msg.includes('images') || msg.includes('Unknown argument') || msg.includes('Invalid `prisma.complaint.create()` invocation')) {
        complaint = await prisma.complaint.create({
          data: {
            userId: me.id,
            category,
            subject,
            message,
          },
        })
      } else {
        throw err
      }
    }

    // แจ้งเตือนกลับไปหาลูกค้า (optional - ถ้าพลาดก็ไม่ทำให้ API ล้ม)
    try {
      await createNotification({
        prisma,
        attrs: {
          userId: me.id,
          title: 'ส่งคำแจ้งปัญหาแล้ว',
          body: `เราได้รับเรื่อง: ${complaint.subject}`,
          data: { type: 'complaint_created', complaintId: complaint.id },
        },
      })
    } catch (e) {
      console.warn('notify complaint_created failed', e?.message || e)
    }

    return res.status(201).json({ message: 'รับแจ้งปัญหาเรียบร้อย', complaint })
  } catch (err) {
    next(err)
  }
}

// GET /customer/complaints
export async function listMyComplaints(req, res, next) {
  try {
    const meId = Number(req.user.id)

    const complaints = await prisma.complaint.findMany({
      where: { userId: meId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return res.json({ complaints })
  } catch (err) {
    next(err)
  }
}
