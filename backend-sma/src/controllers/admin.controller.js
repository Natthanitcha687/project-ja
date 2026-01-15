// backend-sma/src/controllers/admin.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma.js";
import { sendMail } from "../config/mail.js"; // มีอยู่แล้วในโปรกต์ (ส่งแบบ best-effort)

function sign(user) {
  const payload = { sub: user.id, role: user.role, email: user.email };
  const secret = process.env.JWT_SECRET || "dev-secret";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { expiresIn });
}

function clientInfo(req) {
  const xf = req.headers["x-forwarded-for"];
  const ipFromXf =
    typeof xf === "string"
      ? xf.split(",")[0].trim()
      : Array.isArray(xf)
      ? String(xf[0]).split(",")[0].trim()
      : null;

  const ip =
    ipFromXf ||
    req.headers["x-real-ip"]?.toString()?.trim() ||
    req.headers["cf-connecting-ip"]?.toString()?.trim() ||
    req.ip ||
    null;

  return {
    ip,
    userAgent: req.get("user-agent") || null,
  };
}

/**
 * logAudit(req, action, targetType?, targetId?, meta?, actorUserIdOverride?)
 * - meta ควรเป็น object/Json
 * - actorUserIdOverride ใช้กรณี login (ยังไม่มี req.user)
 */
async function logAudit(
  req,
  action,
  targetType = null,
  targetId = null,
  meta = null,
  actorUserIdOverride = null
) {
  const { ip, userAgent } = clientInfo(req);

  const actorUserId =
    actorUserIdOverride != null
      ? Number(actorUserIdOverride)
      : req.user?.id
      ? Number(req.user.id)
      : null;

  await prisma.auditLog.create({
    data: {
      actorUserId,
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

function fmtTH(v) {
  if (!v) return "-";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return "-";
  return d.toLocaleString("th-TH");
}

/* =========================
 * Auth (Admin)
 * ========================= */
export async function adminLogin(req, res) {
  const { email, password } = req.body || {};
  const { ip, userAgent } = clientInfo(req);

  const user = await prisma.user.findUnique({ where: { email } });

  // ❌ ไม่เจอหรือไม่ใช่ ADMIN
  if (!user || user.role !== "ADMIN") {
    await prisma.securityEvent.create({
      data: {
        type: "ADMIN_LOGIN_FAIL",
        email: email || null,
        ip,
        userAgent,
        meta: { reason: "NOT_ADMIN_OR_NOT_FOUND" },
      },
    });

    // ✅ Audit (actor ยังไม่รู้ว่าเป็นใคร)
    await logAudit(
      req,
      "ADMIN_LOGIN",
      "User",
      null,
      { result: "FAIL", email: email || null, reason: "NOT_ADMIN_OR_NOT_FOUND" },
      null
    );

    return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  }

  // ❌ ถูกระงับ
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
      await prisma.securityEvent.create({
        data: {
          type: "ADMIN_LOGIN_BLOCKED",
          userId: user.id,
          email: user.email,
          ip,
          userAgent,
          meta: { reason: "SUSPENDED", suspendedUntil: user.suspendedUntil || null },
        },
      });

      await logAudit(
        req,
        "ADMIN_LOGIN",
        "User",
        user.id,
        {
          result: "FAIL",
          reason: "SUSPENDED",
          suspendedUntil: user.suspendedUntil || null,
        },
        null
      );

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
      data: {
        type: "ADMIN_LOGIN_FAIL",
        userId: user.id,
        email: user.email,
        ip,
        userAgent,
        meta: { reason: "BAD_PASSWORD" },
      },
    });

    await logAudit(
      req,
      "ADMIN_LOGIN",
      "User",
      user.id,
      { result: "FAIL", reason: "BAD_PASSWORD" },
      null
    );

    return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // ✅ Audit: login success (ระบุ actor ได้แล้ว)
  await logAudit(req, "ADMIN_LOGIN", "User", user.id, { result: "SUCCESS" }, user.id);

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

  const before = { id: store.id, email: store.email, status: store.status, role: store.role };

  await logAudit(req, "DELETE_STORE_ACCOUNT", "User", storeId, {
    result: "SUCCESS",
    reason: reason || null,
    before,
  });

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

// ✅ Delete customer (ส่งเมล + AuditLog แบบเดียวฝั่งร้าน)
export async function deleteCustomerAccount(req, res) {
  const customerId = Number(req.params.id);
  const { reason } = req.body || {};
  if (!customerId) return res.status(400).json({ message: "customer id ไม่ถูกต้อง" });

  const user = await prisma.user.findUnique({ where: { id: customerId } });
  if (!user || user.role !== "CUSTOMER") return res.status(404).json({ message: "ไม่พบลูกค้า" });

  const before = { id: user.id, email: user.email, status: user.status, role: user.role };

  await logAudit(req, "DELETE_CUSTOMER_ACCOUNT", "User", customerId, {
    result: "SUCCESS",
    reason: reason || null,
    before,
  });

  await sendMailBestEffort({
    to: user.email,
    subject: "แจ้งเตือน: บัญชีของคุณถูกลบโดยผู้ดูแลระบบ",
    text: `บัญชีของคุณถูกลบโดยผู้ดูแลระบบ\nเหตุผล: ${reason || "-"}`,
    html: `<div style="font-family:system-ui,Arial">
      <h3>บัญชีของคุณถูกลบ</h3>
      <p><b>เหตุผล:</b> ${reason || "-"}</p>
      <p>หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ</p>
    </div>`,
  });

  await prisma.user.delete({ where: { id: customerId } });
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

// ✅ ระงับ / ปลด / ระงับชั่วคราว (days) + เมล “ปลดระงับแบบละเอียด” ให้ทั้ง STORE/CUSTOMER
export async function setUserStatus(req, res) {
  const userId = Number(req.params.id);
  const { status, reason, days } = req.body || {};

  if (!["ACTIVE", "SUSPENDED"].includes(status))
    return res.status(400).json({ message: "status ต้องเป็น ACTIVE หรือ SUSPENDED" });

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
  if (target.role === "ADMIN") return res.status(400).json({ message: "ไม่อนุญาตให้เปลี่ยนสถานะ ADMIN" });

  const before = {
    status: target.status,
    suspendedAt: target.suspendedAt,
    suspendedUntil: target.suspendedUntil,
    suspendedReason: target.suspendedReason,
  };

  const daysNum = days != null && days !== "" ? Number(days) : null;
  const suspendedUntil =
    status === "SUSPENDED" && Number.isFinite(daysNum) && daysNum > 0
      ? new Date(Date.now() + daysNum * 86400_000)
      : null;

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        status,
        suspendedAt: status === "SUSPENDED" ? new Date() : null,
        suspendedReason: status === "SUSPENDED" ? reason || null : null,
        suspendedUntil,
      },
    });

    const after = {
      status: updated.status,
      suspendedAt: updated.suspendedAt,
      suspendedUntil: updated.suspendedUntil,
      suspendedReason: updated.suspendedReason,
    };

    await logAudit(req, "SET_USER_STATUS", "User", userId, {
      result: "SUCCESS",
      reason: reason || null,
      days: daysNum ?? null,
      suspendedUntil,
      before,
      after,
    });

    // ✅ ส่งเมลทั้ง STORE และ CUSTOMER
    if (updated.role === "STORE" || updated.role === "CUSTOMER") {
      const roleLabel = updated.role === "STORE" ? "ร้านค้า" : "ลูกค้า";
      const whoText = updated.role === "STORE" ? "บัญชีร้านของคุณ" : "บัญชีลูกค้าของคุณ";

      if (status === "SUSPENDED") {
        const daysTxt = Number.isFinite(daysNum) && daysNum > 0 ? String(daysNum) : "-";
        const untilTxt = suspendedUntil ? fmtTH(suspendedUntil) : "-";
        const reasonTxt = (reason || "-").toString();

        await sendMailBestEffort({
          to: updated.email,
          subject: `แจ้งเตือน: ${whoText}ถูกระงับ`,
          text:
            `${whoText}ถูกระงับโดยผู้ดูแลระบบ\n` +
            `ประเภทบัญชี: ${roleLabel}\n` +
            `ระยะเวลา(วัน): ${daysTxt}\n` +
            `หมดระงับ: ${untilTxt}\n` +
            `เหตุผล: ${reasonTxt}\n` +
            `หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ`,
          html: `<div style="font-family:system-ui,Arial">
            <h3>${whoText}ถูกระงับ</h3>
            <p><b>ประเภทบัญชี:</b> ${roleLabel}</p>
            <p><b>ระยะเวลา(วัน):</b> ${daysTxt}</p>
            <p><b>หมดระงับ:</b> ${untilTxt}</p>
            <p><b>เหตุผล:</b> ${reasonTxt}</p>
            <p style="color:#64748b">หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ</p>
          </div>`,
        });
      } else {
        // ✅ ปลดระงับ “แบบละเอียด”
        const prevAt = before?.suspendedAt ? fmtTH(before.suspendedAt) : "-";
        const prevUntil = before?.suspendedUntil ? fmtTH(before.suspendedUntil) : "-";
        const prevReason = before?.suspendedReason ? String(before.suspendedReason) : "-";

        const earlyUnsuspend =
          before?.suspendedUntil && new Date(before.suspendedUntil).getTime() > Date.now();

        await sendMailBestEffort({
          to: updated.email,
          subject: `แจ้งเตือน: ${whoText}ถูกปลดระงับแล้ว`,
          text:
            `${whoText}ถูกปลดระงับแล้ว\n` +
            `ประเภทบัญชี: ${roleLabel}\n` +
            `รายละเอียดการระงับเดิม:\n` +
            `- เริ่มระงับ: ${prevAt}\n` +
            `- เดิมหมดระงับ: ${prevUntil}\n` +
            `- เหตุผลเดิม: ${prevReason}\n` +
            (earlyUnsuspend ? `*หมายเหตุ: ปลดระงับก่อนกำหนด\n` : "") +
            `ขณะนี้คุณสามารถเข้าใช้งานระบบได้ตามปกติ`,
          html: `<div style="font-family:system-ui,Arial">
            <h3>${whoText}ถูกปลดระงับแล้ว</h3>
            <p><b>ประเภทบัญชี:</b> ${roleLabel}</p>

            <div style="margin:12px 0;padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc">
              <div style="font-weight:600;margin-bottom:6px">รายละเอียดการระงับเดิม</div>
              <p style="margin:4px 0"><b>เริ่มระงับ:</b> ${prevAt}</p>
              <p style="margin:4px 0"><b>เดิมหมดระงับ:</b> ${prevUntil}</p>
              <p style="margin:4px 0"><b>เหตุผลเดิม:</b> ${prevReason}</p>
              ${earlyUnsuspend ? `<p style="margin:8px 0;color:#b45309"><b>หมายเหตุ:</b> ปลดระงับก่อนกำหนด</p>` : ""}
            </div>

            <p>ขณะนี้คุณสามารถเข้าใช้งานระบบได้ตามปกติ</p>
          </div>`,
        });
      }
    }

    return res.json({ user: updated });
  } catch (e) {
    await logAudit(req, "SET_USER_STATUS", "User", userId, {
      result: "FAIL",
      reason: reason || null,
      days: daysNum ?? null,
      suspendedUntil,
      before,
      error: e?.message || String(e),
    });
    return res.status(500).json({ message: "อัปเดตสถานะผู้ใช้ไม่สำเร็จ" });
  }
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

// ✅ include actor เพื่อให้ UI โชว์ Who ได้ + เติม targetUser (กรณี targetType=User) + เติม targetComplaintUser (กรณี targetType=Complaint)
export async function listAuditLogs(_req, res) {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: {
        select: { id: true, email: true, role: true },
      },
    },
  });

  // เก็บ target user ids ที่เป็นตัวเลขเท่านั้น (targetId ใน AuditLog เก็บเป็น String)
  const userTargetIds = Array.from(
    new Set(
      (logs || [])
        .filter(
          (l) =>
            (l.targetType || "").toLowerCase() === "user" &&
            l.targetId &&
            /^\d+$/.test(String(l.targetId))
        )
        .map((l) => Number(l.targetId))
    )
  );

  let userMap = new Map(); // key เป็น "id" แบบ string
  if (userTargetIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: userTargetIds } },
      select: { id: true, email: true, role: true },
    });
    userMap = new Map(users.map((u) => [String(u.id), u]));
  }

  // ✅ เก็บ complaint ids (เป็น string/cuid) เพื่อ map ไปเป็น user ของ complaint
  const complaintIds = Array.from(
    new Set(
      (logs || [])
        .filter(
          (l) =>
            (l.targetType || "").toLowerCase() === "complaint" &&
            l.targetId
        )
        .map((l) => String(l.targetId))
    )
  );

  let complaintUserMap = new Map(); // key = complaintId, value = {id,email,role} | null
  if (complaintIds.length) {
    // Explicitly select fields (exclude `images`) and include user info
    const complaints = await prisma.complaint.findMany({
      where: { id: { in: complaintIds } },
      take: 200,
      select: {
        id: true,
        userId: true,
        category: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, email: true, role: true } },
      },
    });
    complaintUserMap = new Map(
      (complaints || []).map((c) => [String(c.id), c.user || null])
    );
  }

  const enriched = (logs || []).map((l) => {
    const ttype = (l.targetType || "").toLowerCase();

    const isUserTarget = ttype === "user";
    const tu = isUserTarget && l.targetId ? userMap.get(String(l.targetId)) : null;

    const isComplaintTarget = ttype === "complaint";
    const cu = isComplaintTarget && l.targetId ? complaintUserMap.get(String(l.targetId)) : null;

    return {
      ...l,
      targetUser: tu || null,
      targetComplaintUser: cu || null,
    };
  });

  res.json({ logs: enriched });
}

/**
 * include user + profile เพื่อให้ฝั่ง Admin UI แสดง "ผู้ส่ง" ได้
 */
export async function listComplaints(req, res) {
  const status = (req.query.status || "").toString().trim();

  // Select complaint scalar fields explicitly (exclude `images`) and include user/profile info
  const complaints = await prisma.complaint.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      userId: true,
      category: true,
      subject: true,
      message: true,
      status: true,
      createdAt: true,
      updatedAt: true,
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

  res.json({ complaints });
}

/**
 * update แล้ว include user กลับไปด้วย (กัน UI หลุดข้อมูลผู้ส่งใน modal/list)
 */
export async function setComplaintStatus(req, res) {
  const id = req.params.id;
  const { status } = req.body || {};

  if (!["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"].includes(status))
    return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });

  // Only fetch minimal fields to avoid selecting `images` column when missing
  const beforeRow = await prisma.complaint.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!beforeRow) return res.status(404).json({ message: "ไม่พบข้อมูลการแจ้งปัญหา" });

  const before = { status: beforeRow.status };

  try {
    // Explicit select to avoid returning `images` column if DB not migrated
    const updated = await prisma.complaint.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        userId: true,
        category: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
        updatedAt: true,
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

    const after = { status: updated.status };

    await logAudit(req, "SET_COMPLAINT_STATUS", "Complaint", id, {
      result: "SUCCESS",
      before,
      after,
    });

    res.json({ complaint: updated });
  } catch (e) {
    await logAudit(req, "SET_COMPLAINT_STATUS", "Complaint", id, {
      result: "FAIL",
      before,
      error: e?.message || String(e),
    });
    return res.status(500).json({ message: "อัปเดตสถานะไม่สำเร็จ" });
  }
}
