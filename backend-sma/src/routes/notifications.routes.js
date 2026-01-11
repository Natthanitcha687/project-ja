import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { prisma } from '../db/prisma.js'
import { subscribe, publishNotification } from '../utils/notificationBroker.js'
import { sendNotificationEmail } from '../services/email.js'

const router = Router()

// SSE stream for notifications
router.get('/stream', requireAuth, (req, res) => {
  const userId = Number(req.user?.id || req.user?.sub || null)
  // if user is also a store, include storeId
  const storeId = req.user?.role === 'STORE' ? userId : null
  subscribe({ userId, storeId, res })
})

// GET /notifications - notifications for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const uid = Number(req.user?.id || req.user?.sub || null)
    const isStore = req.user?.role === 'STORE'
    const where = isStore ? { OR: [{ storeId: uid }, { userId: uid }] } : { userId: uid }
    const list = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json(list)
  } catch (err) {
    console.error('GET /notifications error', err)
    res.status(500).json({ message: 'Unable to load notifications' })
  }
})

// GET /store/:id/notifications is handled by store route, but provide here for convenience
router.get('/store/:storeId', requireAuth, async (req, res) => {
  try {
    const storeId = Number(req.params.storeId)
    const list = await prisma.notification.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json(list)
  } catch (err) {
    console.error('GET /store/:id/notifications error', err)
    res.status(500).json({ message: 'Unable to load notifications' })
  }
})

// PATCH /notifications/:id/read - mark single notification as read
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ message: 'Invalid id' })

    // find notification
    const n = await prisma.notification.findUnique({ where: { id } })
    if (!n) return res.status(404).json({ message: 'Not found' })

    const uid = Number(req.user?.id || req.user?.sub)
    const storeId = req.user?.role === 'STORE' ? uid : null

    // authorize: either notification.userId matches uid OR notification.storeId matches storeId
    // allow if notification belongs to the user OR belongs to the store
    if (!(n.userId === uid || (n.storeId && storeId && n.storeId === storeId))) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const updated = await prisma.notification.update({ where: { id }, data: { read: true } })
    res.json({ ok: true, notification: updated })
  } catch (err) {
    console.error('PATCH /notifications/:id/read error', err)
    res.status(500).json({ message: 'Unable to mark read' })
  }
})

// POST /notifications/mark-all-read - mark all notifications for current user/store as read
router.post('/mark-all-read', requireAuth, async (req, res) => {
  try {
    const uid = Number(req.user?.id || req.user?.sub)
    const isStore = req.user?.role === 'STORE'
    const where = isStore ? { storeId: uid, read: false } : { userId: uid, read: false }
    const result = await prisma.notification.updateMany({ where, data: { read: true } })
    res.json({ ok: true, updated: result.count })
  } catch (err) {
    console.error('POST /notifications/mark-all-read error', err)
    res.status(500).json({ message: 'Unable to mark notifications read' })
  }
})

// DELETE /notifications/:id - allow deletion of a notification by owner/store
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ message: 'Invalid id' })
    const n = await prisma.notification.findUnique({ where: { id } })
    if (!n) return res.status(404).json({ message: 'Not found' })

    const uid = Number(req.user?.id || req.user?.sub)
    const isStore = req.user?.role === 'STORE'
    if (!(n.userId === uid || (isStore && n.storeId === uid))) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    await prisma.notification.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) {
    console.error('DELETE /notifications/:id error', err)
    res.status(500).json({ message: 'Unable to delete notification' })
  }
})

// POST /notifications/cleanup-warranty - store-only endpoint to delete notifications related to a warranty code
router.post('/cleanup-warranty', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'STORE') return res.status(403).json({ message: 'Forbidden' })
    const storeId = Number(req.user?.id || req.user?.sub)
    const { code, deleteWarranty } = req.body || {}
    if (!code || typeof code !== 'string') return res.status(400).json({ message: 'code required' })

    const warranty = await prisma.warranty.findFirst({ where: { storeId, code } })
    if (!warranty) return res.status(404).json({ message: 'Warranty not found for this store' })

    const deleted = await prisma.notification.deleteMany({
      where: {
        storeId,
        OR: [
          { title: { contains: code } },
          { body: { contains: code } },
          { data: { path: ['warrantyId'], equals: warranty.id } },
        ],
      },
    })

    if (deleteWarranty) {
      await prisma.warranty.delete({ where: { id: warranty.id } })
    }

    res.json({ ok: true, deletedCount: deleted.count })
  } catch (err) {
    console.error('POST /notifications/cleanup-warranty error', err)
    res.status(500).json({ message: 'Unable to cleanup' })
  }
})

// helper to create notification and publish
export async function createAndPublish({ prisma, attrs }) {
  // strip non-DB fields to avoid Prisma errors
  const { sendEmail, ...dbAttrs } = attrs || {}

  // create DB notification and publish via SSE
  const n = await prisma.notification.create({ data: dbAttrs })
  console.log(
    `createAndPublish: created notification id=${n.id} userId=${n.userId || ''} storeId=${n.storeId || ''} title=${n.title || ''}`
  )
  await publishNotification({ prisma, notification: n })

  // Only send email if explicitly requested AND is CUSTOMER AND type is allowlisted
  try {
    const allowTypes = new Set([
      'nearing_expiration',
      'expired',
      'warranty_created',
      'complaint_created',
      'warranty_header_updated', // ร้านอัปเดตใบ (หัวใบ)
      'warranty_updated', // เผื่อมีการใช้ชื่อรวมในอนาคต
    ])

    const type = n?.data?.type

    if (sendEmail === true && n.userId && allowTypes.has(type)) {
      const u = await prisma.user.findUnique({
        where: { id: n.userId },
        select: { email: true, role: true },
      })

      const toEmail = u?.role === 'CUSTOMER' ? u?.email || null : null

      if (toEmail) {
        const subject = n.title || 'การแจ้งเตือน'
        const bodyText = n.body || ''
        console.log(`createAndPublish: sending email to ${toEmail} subject=${subject}`)
        await sendNotificationEmail({ to: toEmail, subject, text: bodyText })
      }
    }
  } catch (e) {
    console.warn('send notification email failed', e?.message || e)
  }

  return n
}

export default router
