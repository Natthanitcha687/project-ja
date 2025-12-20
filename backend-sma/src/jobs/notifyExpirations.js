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

export async function runExpiryScanJob() {
  try {
    const today = dateOnlyUTC(new Date())
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

    for (const it of items) {
      const exp = it.expiryDate ? dateOnlyUTC(it.expiryDate) : null
      if (!exp) continue

      const store = it.warranty?.store
      const notifyDays = store?.storeProfile?.notifyDaysInAdvance ?? 14

      const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (24 * 3600 * 1000))

      // If already expired (daysLeft < 0) → create an 'expired' notification (once)
      if (daysLeft < 0) {
        const since = addDaysUTC(today, -7)
        const existsExpired = await prisma.notification.findFirst({
          where: {
            storeId: store?.id ?? null,
            data: { path: ['warrantyItemId'], equals: it.id },
            AND: [{ data: { path: ['type'], equals: 'expired' } }, { createdAt: { gte: since } }]
          }
        })
        if (!existsExpired) {
          const title = `รายการหมดประกันแล้ว`
          const body = `สินค้า "${it.productName}" (Serial: ${it.serial || '-'}) หมดประกันแล้ว`;
          try {
            await createNotification({ prisma, attrs: {
              storeId: store?.id ?? null,
              title,
              body,
              data: { type: 'expired', warrantyId: it.warrantyId, warrantyItemId: it.id }
            } })
          } catch (e) { console.warn('create expired notification failed', e?.message || e) }

          if (it.warranty?.customerUserId) {
            try {
              await createNotification({ prisma, attrs: {
                userId: it.warranty.customerUserId,
                title,
                body,
                data: { type: 'expired', warrantyId: it.warrantyId, warrantyItemId: it.id }
              } })
            } catch (e) { console.warn('notify customer expired failed', e?.message || e) }
          }
        }
        // continue to next item — we don't also mark it as 'nearing'
        continue
      }

      if (daysLeft <= notifyDays) {
        // check recent similar notification exists (avoid duplicates)
        const since = addDaysUTC(today, - (notifyDays + 1))
        const exists = await prisma.notification.findFirst({
          where: {
            storeId: store?.id ?? null,
            data: { path: ['warrantyItemId'], equals: it.id },
            AND: [{ data: { path: ['type'], equals: 'nearing_expiration' } }, { createdAt: { gte: since } }]
          }
        })

        if (exists) continue

        // create notification for store
        const title = `รายการใกล้หมดประกัน (${daysLeft} วัน)`
        const body = `สินค้า "${it.productName}" (Serial: ${it.serial || '-'}) จะหมดประกันภายใน ${daysLeft} วัน`;
        try {
          await createNotification({ prisma, attrs: {
            storeId: store?.id ?? null,
            title,
            body,
            data: { type: 'nearing_expiration', warrantyId: it.warrantyId, warrantyItemId: it.id, daysLeft }
          } })
        } catch (e) {
          console.warn('create nearing_expiration notification failed', e?.message || e)
        }

        // also notify customer user if linked
        if (it.warranty?.customerUserId) {
          try {
            await createNotification({ prisma, attrs: {
              userId: it.warranty.customerUserId,
              title,
              body,
              data: { type: 'nearing_expiration', warrantyId: it.warrantyId, warrantyItemId: it.id, daysLeft }
            } })
          } catch (e) {
            console.warn('notify customer nearing_expiration failed', e?.message || e)
          }
        }
      }
    }
  } catch (e) {
    console.error('Expiry scan job error', e)
  }
}

export default runExpiryScanJob
