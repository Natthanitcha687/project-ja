// backend-sma/src/jobs/notifyExpirations.js
import { prisma } from '../db/prisma.js'
import { createAndPublish as createNotification } from '../routes/notifications.routes.js'

function dateOnlyUTC(d) {
  const D = d instanceof Date ? d : new Date(d)
  return new Date(Date.UTC(D.getUTCFullYear(), D.getUTCMonth(), D.getUTCDate()))
}

function addDaysUTC(d, days) {
  const D = dateOnlyUTC(d)
  D.setUTCDate(D.getUTCDate() + Number(days))
  return D
}

function ymdUTC(d) {
  const D = dateOnlyUTC(d)
  // YYYY-MM-DD in UTC
  return D.toISOString().slice(0, 10)
}

// ✅ ทำวันที่แบบ "Local offset" สำหรับ label/date ของสรุปร้าน
// ค่าไทย = 420 นาที (7 ชั่วโมง)
const APP_TZ_OFFSET_MIN = Number(process.env.APP_TZ_OFFSET_MIN || 420)
function ymdWithOffset(v, offsetMin) {
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d)) return ymdUTC(new Date())
  const shifted = new Date(d.getTime() + Number(offsetMin || 0) * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

export async function runExpiryScanJob() {
  try {
    const now = new Date()

    // ✅ ใช้ UTC date-only สำหรับ logic/customer ตามเดิม (ไม่กระทบลูกค้า)
    const today = dateOnlyUTC(now)

    // ✅ ใช้วันที่แบบไทยสำหรับสรุปร้าน (แก้ปัญหาวันที่ 12/13)
    const todayStr = ymdWithOffset(now, APP_TZ_OFFSET_MIN)

    // scan items with expiry in the past .. next 90 days (so we catch newly-expired + nearing)
    const maxFuture = addDaysUTC(today, 90)

    const items = await prisma.warrantyItem.findMany({
      where: {
        expiryDate: { lte: maxFuture }
      },
      include: {
        warranty: {
          include: {
            store: { include: { storeProfile: true } },
            // ✅ เพิ่ม: ดึง customerProfile เพื่อใช้ notifyDaysArray
            customer: { include: { customerProfile: true } }
          }
        }
      }
    })

    // ✅ store daily summary accumulator
    // Map<storeId, { storeId, nearingCount, expiredCount }>
    const storeSummary = new Map()

    for (const it of items) {
      const exp = it.expiryDate ? dateOnlyUTC(it.expiryDate) : null
      if (!exp) continue

      const store = it.warranty?.store
      const storeId = store?.id ?? null
      const notifyDays = store?.storeProfile?.notifyDaysInAdvance ?? 14

      const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (24 * 3600 * 1000))

      // ---------- ✅ Accumulate store daily summary (NO per-item store notification anymore) ----------
      if (storeId) {
        const s = storeSummary.get(storeId) || { storeId, nearingCount: 0, expiredCount: 0 }
        // ✅ cutoff 1 วัน: นับ expired เฉพาะวันแรกที่หมด (daysLeft >= -1)
        if (daysLeft < 0 && daysLeft >= -1) {
          s.expiredCount += 1
        } else if (daysLeft >= 0 && daysLeft <= notifyDays) {
          s.nearingCount += 1
        }
        storeSummary.set(storeId, s)
      }

      // ---------- ✅ Customer notifications MUST NOT be affected ----------
      // If already expired (daysLeft < 0) → create an 'expired' notification for CUSTOMER (once in ~7 days)
      if (daysLeft < 0) {
        if (it.warranty?.customerUserId) {
          // ✅ เช็คว่าเคยส่ง notification "expired" ของ item นี้ไปแล้วหรือยัง (ตลอดกาล)
          const existsCustomerExpired = await prisma.notification.findFirst({
            where: {
              userId: it.warranty.customerUserId,
              data: { path: ['warrantyItemId'], equals: it.id },
              AND: [{ data: { path: ['type'], equals: 'expired' } }]
            }
          })

          if (!existsCustomerExpired) {
            const title = `รายการหมดประกันแล้ว`
            const body = `สินค้า "${it.productName}" (Serial: ${it.serial || '-'}) หมดประกันแล้ว`
            try {
              await createNotification({
                prisma,
                attrs: {
                  userId: it.warranty.customerUserId,
                  title,
                  body,
                  data: { type: 'expired', warrantyId: it.warrantyId, warrantyItemId: it.id },
                  sendEmail: true
                }
              })
            } catch (e) {
              console.warn('notify customer expired failed', e?.message || e)
            }
          }
        }

        // continue to next item — we don't also mark it as 'nearing'
        continue
      }

      // ✅ nearing expiration → notify CUSTOMER based on their preferred days
      // ถ้าลูกค้าไม่ได้ตั้งค่า → ใช้ default [15] (ครั้งเดียวตอน 15 วันก่อนหมด)
      if (it.warranty?.customerUserId) {
        const customerProfile = it.warranty?.customer?.customerProfile
        const customerNotifyDays = customerProfile?.notifyDaysArray?.length > 0
          ? customerProfile.notifyDaysArray
          : [15] // default: แจ้ง 15 วันก่อนหมด (ครั้งเดียว)

        // เช็คว่า daysLeft ตรงกับวันที่ลูกค้าต้องการแจ้งเตือนหรือไม่
        if (customerNotifyDays.includes(daysLeft)) {
          // เช็คว่าเคยส่ง notification ของ item นี้ + วันนี้หรือยัง
          const existsCustomerNearing = await prisma.notification.findFirst({
            where: {
              userId: it.warranty.customerUserId,
              data: { path: ['warrantyItemId'], equals: it.id },
              AND: [
                { data: { path: ['type'], equals: 'nearing_expiration' } },
                { data: { path: ['daysLeft'], equals: daysLeft } }
              ]
            }
          })

          if (!existsCustomerNearing) {
            const title = `รายการใกล้หมดประกัน (${daysLeft} วัน)`
            const body = `สินค้า "${it.productName}" (Serial: ${it.serial || '-'}) จะหมดประกันภายใน ${daysLeft} วัน`
            try {
              await createNotification({
                prisma,
                attrs: {
                  userId: it.warranty.customerUserId,
                  title,
                  body,
                  data: { type: 'nearing_expiration', warrantyId: it.warrantyId, warrantyItemId: it.id, daysLeft },
                  sendEmail: true
                }
              })
            } catch (e) {
              console.warn('notify customer nearing_expiration failed', e?.message || e)
            }
          }
        }
      }
    }

    // ใช้ช่วงเวลา “กว้างหน่อย” กันซ้ำ เพื่อไม่พลาดกรณีเที่ยงคืนไทย/UTC
    const sinceSummary = addDaysUTC(today, -2)

    // ---------- ✅ Create DAILY SUMMARY notification for each store (only if counts > 0) ----------
    for (const s of storeSummary.values()) {
      const total = (s.nearingCount || 0) + (s.expiredCount || 0)
      if (total <= 0) continue

      // ✅ avoid duplicate: 1 summary per store per "todayStr" (ตามเวลาไทย)
      const existsSummary = await prisma.notification.findFirst({
        where: {
          storeId: s.storeId,
          createdAt: { gte: sinceSummary },
          AND: [
            { data: { path: ['type'], equals: 'expiry_daily_summary' } },
            { data: { path: ['date'], equals: todayStr } }
          ]
        }
      })
      if (existsSummary) continue

      const title = `สรุปแจ้งเตือนประกันประจำวัน (${todayStr})`
      const body =
        `วันนี้มีรายการเข้าเงื่อนไข:\n` +
        `• ใกล้หมดอายุ: ${s.nearingCount || 0} รายการ\n` +
        `• หมดอายุแล้ว: ${s.expiredCount || 0} รายการ`

      try {
        await createNotification({
          prisma,
          attrs: {
            storeId: s.storeId,
            title,
            body,
            data: {
              type: 'expiry_daily_summary',
              date: todayStr,
              nearingCount: s.nearingCount || 0,
              expiredCount: s.expiredCount || 0
            },
            // ✅ ส่งเมลร้าน
            sendEmail: true
          }
        })
      } catch (e) {
        console.warn('create expiry_daily_summary notification failed', e?.message || e)
      }
    }
  } catch (e) {
    console.error('Expiry scan job error', e)
  }
}

export default runExpiryScanJob
