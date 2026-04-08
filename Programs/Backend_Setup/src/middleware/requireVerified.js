// backend-sma/src/middleware/requireVerified.js
import { prisma } from '../db/prisma.js'

export async function requireVerified(req, res, next) {
  try {
    // รองรับทั้ง id และ sub จาก JWT (บางที่ sign เป็น sub)
    const userIdRaw = req.user?.id ?? req.user?.sub ?? req.userId
    const userId = Number(userIdRaw)

    if (!Number.isInteger(userId)) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    if (!user.emailVerifiedAt) {
      return res.status(403).json({ message: 'ต้องยืนยันอีเมลก่อนใช้งาน' })
    }

    // ผูก userId ให้ middleware/handler ถัดไปใช้ได้เสมอ
    req.userId = userId
    next()
  } catch (e) {
    next(e)
  }
}
