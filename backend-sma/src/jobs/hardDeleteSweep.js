import { prisma } from '../db/prisma.js'

// Hard-delete users and related data that were soft-deleted longer than grace period
export default async function runHardDeleteSweep() {
  try {
    // 1. ดึงค่าตั้งค่าจาก DB (ถ้าไม่มีให้ใช้ 30 วันเป็น default)
    let graceDays = 30;
    try {
      const dbSetting = await prisma.systemSetting.findUnique({
        where: { key: 'user_retention_days' }
      });
      if (dbSetting && dbSetting.value) {
        graceDays = Number(dbSetting.value);
      }
    } catch (err) {
      console.warn('Unable to fetch user_retention_days, using default 30', err.message);
    }

    const cutoff = new Date(Date.now() - Number(graceDays) * 24 * 3600 * 1000)

    // find users eligible for permanent deletion
    const users = await prisma.user.findMany({ where: { isDeleted: true, deletedAt: { lte: cutoff } } })
    if (!users || users.length === 0) return console.log(`Hard delete (grace=${graceDays}d): nothing to do`)

    console.log(`Hard delete (grace=${graceDays}d): found ${users.length} users to remove`)

    for (const u of users) {
      try {
        if (u.role === 'STORE') {
          // delete complaints and satisfactions linked to store
          await prisma.$transaction([
            prisma.complaint.deleteMany({ where: { userId: u.id } }),
            prisma.satisfaction.deleteMany({ where: { OR: [{ userId: u.id }, { storeId: u.id }] } }),
          ])

          // delete warranties for this store (cascade will remove warranty items)
          await prisma.warranty.deleteMany({ where: { storeId: u.id } })
        } else if (u.role === 'CUSTOMER') {
          // delete complaints and satisfactions linked to customer
          await prisma.$transaction([
            prisma.complaint.deleteMany({ where: { userId: u.id } }),
            prisma.satisfaction.deleteMany({ where: { OR: [{ userId: u.id }, { storeId: u.id }] } }),
          ])

          // delete warranties where this user was customer
          await prisma.warranty.deleteMany({ where: { customerUserId: u.id } })
        }

        // delete notifications, audit logs, security events related to user (optional)
        try {
          await prisma.$transaction([
            prisma.notification.deleteMany({ where: { userId: u.id } }),
            prisma.auditLog.deleteMany({ where: { actorUserId: u.id } }),
            prisma.securityEvent.deleteMany({ where: { userId: u.id } }),
          ])
        } catch (e) {
          console.warn('hard-delete cleanup non-critical tables failed', e?.message || e)
        }

        // finally delete the user row
        await prisma.user.delete({ where: { id: u.id } })
        console.log('Hard deleted user', u.id, u.email)
      } catch (e) {
        console.error('Failed to hard-delete user', u.id, e)
      }
    }
  } catch (e) {
    console.error('Hard delete sweep failed', e)
  }
}
