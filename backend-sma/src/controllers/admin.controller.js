import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma.js";
import { sendMail } from "../config/mail.js"; // มีอยู่แล้วในโปรเจกต์ (ส่งแบบ best-effort)

function sign(user) {
  const payload = { sub: user.id, role: user.role, email: user.email };
  const secret = process.env.JWT_SECRET || "dev-secret";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { expiresIn });
}

function clientInfo(req) {
  return {
    ip: req.headers["x-forwarded-for"]?.toString()?.split(",")[0]?.trim() || req.ip,
    userAgent: req.get("user-agent") || null,
  };
}

async function logAudit(req, action, targetType = null, targetId = null, meta = null) {
  const { ip, userAgent } = clientInfo(req);
  await prisma.auditLog.create({
    data: {
      actorUserId: req.user?.id ? Number(req.user.id) : null,
      action,
      targetType,
      targetId: targetId ? String(targetId) : null,
      ip,
      userAgent,
      meta,
    },
  });
}

// ✅ ส่งเมลแบบ “พยายามส่ง” (ห้ามพังระบบถ้าไม่ได้ตั้งค่าเมล)
async function sendMailBestEffort({ to, subject, html, text }) {
  try {
    if (!to) return;
    await sendMail({ to, subject, html, text });
  } catch (e) {
    console.log("⚠️ sendMail failed (ignored):", e?.message || e);
  }
}

/* =========================
 * Auth (Admin)
 * ========================= */
export async function adminLogin(req, res) {
  const { email, password } = req.body || {};
  const { ip, userAgent } = clientInfo(req);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "ADMIN") {
    await prisma.securityEvent.create({
      data: { type: "ADMIN_LOGIN_FAIL", email: email || null, ip, userAgent },
    });
    return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  }

  if (user.status === "SUSPENDED") {
    // ถ้ามีวันหมดระงับและหมดอายุแล้ว -> ปลดอัตโนมัติ
    if (user.suspendedUntil && user.suspendedUntil <= new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          suspendedAt: null,
          suspendedUntil: null,
          suspendedReason: null,
        },
      });
    } else {
      return res.status(403).json({
        message: "บัญชีถูกระงับการใช้งาน",
        reason: user.suspendedReason || null,
        suspendedUntil: user.suspendedUntil || null,
      });
    }
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await prisma.securityEvent.create({
      data: { type: "ADMIN_LOGIN_FAIL", userId: user.id, email: user.email, ip, userAgent },
    });
    return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = sign(user);
  return res.json({ token });
}

export async function adminMe(req, res) {
  const u = await prisma.user.findUnique({ where: { id: Number(req.user.id) } });
  res.json({ user: u });
}

/* =========================
 * Dashboard stats
 * ========================= */
export async function adminStats(_req, res) {
  const [stores, customers, warranties, complaintsOpen] = await Promise.all([
    prisma.user.count({ where: { role: "STORE" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.warranty.count(),
    prisma.complaint.count({ where: { status: "OPEN" } }),
  ]);

  res.json({ stores, customers, warranties, complaintsOpen });
}

/* =========================
 * Stores
 * ========================= */

// ✅ list stores + ใส่ warrantyCount / customerCount ให้ในการ์ด
export async function listStores(req, res) {
  const q = (req.query.q || "").toString().trim();
  const status = (req.query.status || "").toString().trim(); // ACTIVE/SUSPENDED/""(all)

  const where = {
    role: "STORE",
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { storeProfile: { storeName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const stores = await prisma.user.findMany({
    where,
    include: { storeProfile: true },
    orderBy: { id: "desc" },
    take: 200,
  });

  const storeIds = stores.map((s) => s.id);
  if (storeIds.length === 0) return res.json({ stores: [] });

  const grouped = await prisma.warranty.groupBy({
    by: ["storeId"],
    where: { storeId: { in: storeIds } },
    _count: { _all: true },
  });
  const warrantyCountMap = new Map(grouped.map((g) => [g.storeId, g._count._all]));

  const wRows = await prisma.warranty.findMany({
    where: { storeId: { in: storeIds } },
    select: { storeId: true, customerUserId: true, customerEmail: true },
  });

  const custSetByStore = new Map();
  for (const r of wRows) {
    if (!custSetByStore.has(r.storeId)) custSetByStore.set(r.storeId, new Set());
    const set = custSetByStore.get(r.storeId);
    if (r.customerUserId) set.add(`u:${r.customerUserId}`);
    else if (r.customerEmail) set.add(`e:${String(r.customerEmail).toLowerCase()}`);
  }

  const enriched = stores.map((s) => ({
    ...s,
    warrantiesCount: warrantyCountMap.get(s.id) || 0,
    customersCount: custSetByStore.get(s.id)?.size || 0,
  }));

  res.json({ stores: enriched });
}

// ✅ Portal modal: ข้อมูลร้าน + สถิติ + กิจกรรมล่าสุด
export async function getStorePortal(req, res) {
  const storeId = Number(req.params.id);
  if (!storeId) return res.status(400).json({ message: "store id ไม่ถูกต้อง" });

  const store = await prisma.user.findUnique({
    where: { id: storeId },
    include: { storeProfile: true },
  });
  if (!store || store.role !== "STORE") return res.status(404).json({ message: "ไม่พบร้านค้า" });

  const warrantyCount = await prisma.warranty.count({ where: { storeId } });

  const wRows = await prisma.warranty.findMany({
    where: { storeId },
    select: { customerUserId: true, customerEmail: true },
  });
  const cset = new Set();
  for (const r of wRows) {
    if (r.customerUserId) cset.add(`u:${r.customerUserId}`);
    else if (r.customerEmail) cset.add(`e:${String(r.customerEmail).toLowerCase()}`);
  }
  const customerCount = cset.size;

  const agg = await prisma.satisfaction.aggregate({
    where: { storeId },
    _avg: { rating: true },
  });
  const successRatePct =
    typeof agg?._avg?.rating === "number" && !isNaN(agg._avg.rating)
      ? Math.round((agg._avg.rating / 5) * 100)
      : null;

  const latest = await prisma.warranty.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { code: true, createdAt: true },
  });
  const activities = latest.map((w) => ({
    action: "สร้างใบรับประกันใหม่",
    subject: w.code,
    at: w.createdAt,
  }));

  res.json({
    store: {
      id: store.id,
      email: store.email,
      status: store.status,
      createdAt: store.createdAt,
      storeProfile: store.storeProfile,
    },
    stats: { warrantyCount, customerCount, successRatePct, avgResponseHours: null },
    activities,
  });
}

// ✅ Delete store
export async function deleteStoreAccount(req, res) {
  const storeId = Number(req.params.id);
  const { reason } = req.body || {};
  if (!storeId) return res.status(400).json({ message: "store id ไม่ถูกต้อง" });

  const store = await prisma.user.findUnique({ where: { id: storeId } });
  if (!store || store.role !== "STORE") return res.status(404).json({ message: "ไม่พบร้านค้า" });

  await logAudit(req, "DELETE_STORE_ACCOUNT", "User", storeId, { reason: reason || null });

  await sendMailBestEffort({
    to: store.email,
    subject: "แจ้งเตือน: บัญชีร้านถูกลบโดยผู้ดูแลระบบ",
    text: `บัญชีร้านของคุณถูกลบโดยผู้ดูแลระบบ\nเหตุผล: ${reason || "-"}`,
    html: `<div style="font-family:system-ui,Arial">
      <h3>บัญชีร้านถูกลบ</h3><p>เหตุผล: ${reason || "-"}</p></div>`,
  });

  await prisma.user.delete({ where: { id: storeId } });
  res.json({ ok: true });
}

/* =========================
 * Users / Status Control
 * ========================= */
export async function listUsers(req, res) {
  const role = (req.query.role || "").toString().trim();
  const q = (req.query.q || "").toString().trim();

  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: { customerProfile: true, storeProfile: true },
    orderBy: { id: "desc" },
  });

  res.json({ users });
}

// ✅ ระงับ / ปลด / ระงับชั่วคราว (days)
export async function setUserStatus(req, res) {
  const userId = Number(req.params.id);
  const { status, reason, days } = req.body || {};

  if (!["ACTIVE", "SUSPENDED"].includes(status))
    return res.status(400).json({ message: "status ต้องเป็น ACTIVE หรือ SUSPENDED" });

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
  if (target.role === "ADMIN") return res.status(400).json({ message: "ไม่อนุญาตให้เปลี่ยนสถานะ ADMIN" });

  const daysNum = days != null && days !== "" ? Number(days) : null;
  const suspendedUntil =
    status === "SUSPENDED" && Number.isFinite(daysNum) && daysNum > 0
      ? new Date(Date.now() + daysNum * 86400_000)
      : null;

  const meta = { status, reason: reason || null, days: daysNum ?? null, suspendedUntil };

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      status,
      suspendedAt: status === "SUSPENDED" ? new Date() : null,
      suspendedReason: status === "SUSPENDED" ? reason || null : null,
      suspendedUntil,
    },
  });

  await logAudit(req, "SET_USER_STATUS", "User", userId, meta);

  // แจ้งเมลถ้าเป็นร้าน
  if (updated.role === "STORE") {
    const subj =
      status === "SUSPENDED"
        ? "แจ้งเตือน: บัญชีร้านถูกระงับ"
        : "แจ้งเตือน: บัญชีร้านของคุณถูกปลดระงับ";
    const html =
      status === "SUSPENDED"
        ? `<div style="font-family:system-ui,Arial">
            <h3>บัญชีร้านถูกระงับ</h3>
            <p><b>ระยะเวลา(วัน):</b> ${daysNum ?? "-"}</p>
            <p><b>หมดระงับ:</b> ${
              suspendedUntil ? new Date(suspendedUntil).toLocaleString("th-TH") : "-"
            }</p>
            <p><b>เหตุผล:</b> ${reason || "-"}</p>
          </div>`
        : `<div style="font-family:system-ui,Arial">
            <h3>บัญชีร้านของคุณถูกปลดระงับแล้ว</h3>
          </div>`;

    await sendMailBestEffort({
      to: updated.email,
      subject: subj,
      html,
      text: subj,
    });
  }

  res.json({ user: updated });
}

/* =========================
 * Logs & Complaints
 * ========================= */
export async function listSecurityEvents(_req, res) {
  const events = await prisma.securityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ events });
}

export async function listAuditLogs(_req, res) {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ logs });
}

/**
 * ✅ FIX: include user + profile เพื่อให้ฝั่ง Admin UI แสดง "ผู้ส่ง" ได้
 */
export async function listComplaints(req, res) {
  const status = (req.query.status || "").toString().trim();

  const complaints = await prisma.complaint.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          customerProfile: {
            select: { firstName: true, lastName: true, phone: true },
          },
          storeProfile: {
            select: { storeName: true, phone: true },
          },
        },
      },
    },
  });

  res.json({ complaints });
}

/**
 * ✅ FIX: update แล้ว include user กลับไปด้วย (กัน UI หลุดข้อมูลผู้ส่งใน modal/list)
 */
export async function setComplaintStatus(req, res) {
  const id = req.params.id;
  const { status } = req.body || {};

  if (!["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"].includes(status))
    return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });

  const updated = await prisma.complaint.update({
    where: { id },
    data: { status },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          customerProfile: { select: { firstName: true, lastName: true, phone: true } },
          storeProfile: { select: { storeName: true, phone: true } },
        },
      },
    },
  });

  await logAudit(req, "SET_COMPLAINT_STATUS", "Complaint", id, { status });
  res.json({ complaint: updated });
}
