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

    // find all soft-deleted users
    const users = await prisma.user.findMany({ where: { isDeleted: true, deletedAt: { not: null } } })
    if (!users || users.length === 0) return console.log(`Hard delete sweep: nothing to do`)

    const now = new Date();
    let sweepCount = 0;

    for (const u of users) {
      // ✅ คำนวณวันที่จะลบถาวร: ใช้ของส่วนตัวก่อน (User) ถ้าไม่มีค่อยใช้ส่วนกลาง (Global)
      const userGrace = u.retentionDays != null ? u.retentionDays : graceDays;
      const thresholdDate = new Date(u.deletedAt);
      thresholdDate.setDate(thresholdDate.getDate() + userGrace);

      // ✅ ถ้าถึงกำหนดแล้ว -> ลบถาวร (Hard Delete)
      if (thresholdDate <= now) {
        sweepCount++;
        try {
          console.log(`[Sweep] Hard-deleting user ${u.id} (${u.email}) - scheduled for ${thresholdDate.toISOString()} (grace was ${userGrace}d)`);
          
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
    }
    if (sweepCount > 0) console.log(`[Sweep] Completed hard-delete of ${sweepCount} users`);
  } catch (e) {
    console.error('Hard delete sweep failed', e)
  }
}
