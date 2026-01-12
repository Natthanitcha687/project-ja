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

export async function runExpiryScanJob() {
  try {
    const today = dateOnlyUTC(new Date())
    const todayStr = ymdUTC(today)
    const tomorrow = addDaysUTC(today, 1)

    // scan items with expiry in the past .. next 90 days (so we catch newly-expired + nearing)
    const maxFuture = addDaysUTC(today, 90)

    const items = await prisma.warrantyItem.findMany({
      where: {
        expiryDate: { lte: maxFuture }
      },
      include: {
        warranty: { include: { store: { include: { storeProfile: true } } } }
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
        if (daysLeft < 0) {
          s.expiredCount += 1
        } else if (daysLeft <= notifyDays) {
          s.nearingCount += 1
        }
        storeSummary.set(storeId, s)
      }

      // ---------- ✅ Customer notifications MUST NOT be affected ----------
      // If already expired (daysLeft < 0) → create an 'expired' notification for CUSTOMER (once in ~7 days)
      if (daysLeft < 0) {
        if (it.warranty?.customerUserId) {
          const since = addDaysUTC(today, -7)
          const existsCustomerExpired = await prisma.notification.findFirst({
            where: {
              userId: it.warranty.customerUserId,
              data: { path: ['warrantyItemId'], equals: it.id },
              AND: [{ data: { path: ['type'], equals: 'expired' } }, { createdAt: { gte: since } }]
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

      // nearing expiration → notify CUSTOMER (avoid duplicates similar window)
      if (daysLeft <= notifyDays) {
        if (it.warranty?.customerUserId) {
          const since = addDaysUTC(today, -(notifyDays + 1))
          const existsCustomerNearing = await prisma.notification.findFirst({
            where: {
              userId: it.warranty.customerUserId,
              data: { path: ['warrantyItemId'], equals: it.id },
              AND: [{ data: { path: ['type'], equals: 'nearing_expiration' } }, { createdAt: { gte: since } }]
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

    // ---------- ✅ Create DAILY SUMMARY notification for each store (only if counts > 0) ----------
    for (const s of storeSummary.values()) {
      const total = (s.nearingCount || 0) + (s.expiredCount || 0)
      if (total <= 0) continue

      // avoid duplicate: only 1 summary per store per day
      const existsSummary = await prisma.notification.findFirst({
        where: {
          storeId: s.storeId,
          createdAt: { gte: today, lt: tomorrow },
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
            // ✅ flag ไว้ให้ส่งเมลร้าน (จะไปทำจริงใน notifications.routes.js ต่อ)
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
