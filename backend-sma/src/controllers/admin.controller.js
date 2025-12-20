import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma.js";

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
    return res.status(403).json({ message: "บัญชีถูกระงับการใช้งาน" });
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

  res.json({
    stores,
    customers,
    warranties,
    complaintsOpen,
  });
}

/* =========================
 * Users / Stores
 * ========================= */
export async function listStores(req, res) {
  const q = (req.query.q || "").toString().trim();

  const stores = await prisma.user.findMany({
    where: {
      role: "STORE",
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { storeProfile: { storeName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { storeProfile: true },
    orderBy: { id: "desc" },
  });

  res.json({ stores });
}

export async function listUsers(req, res) {
  const role = (req.query.role || "").toString().trim(); // CUSTOMER/STORE/ADMIN หรือว่าง
  const q = (req.query.q || "").toString().trim();

  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [{ email: { contains: q, mode: "insensitive" } }],
          }
        : {}),
    },
    include: { customerProfile: true, storeProfile: true },
    orderBy: { id: "desc" },
  });

  res.json({ users });
}

export async function setUserStatus(req, res) {
  const userId = Number(req.params.id);
  const { status, reason } = req.body || {};

  if (!["ACTIVE", "SUSPENDED"].includes(status)) {
    return res.status(400).json({ message: "status ต้องเป็น ACTIVE หรือ SUSPENDED" });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      status,
      suspendedAt: status === "SUSPENDED" ? new Date() : null,
      suspendedReason: status === "SUSPENDED" ? (reason || null) : null,
    },
  });

  await logAudit(req, "SET_USER_STATUS", "User", userId, { status, reason });

  res.json({ user: updated });
}

/* =========================
 * Security / Logs / Complaints
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

export async function listComplaints(req, res) {
  const status = (req.query.status || "").toString().trim(); // OPEN/IN_PROGRESS/RESOLVED/REJECTED
  const complaints = await prisma.complaint.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ complaints });
}

export async function setComplaintStatus(req, res) {
  const id = req.params.id;
  const { status } = req.body || {};

  if (!["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: { status },
  });

  await logAudit(req, "SET_COMPLAINT_STATUS", "Complaint", id, { status });

  res.json({ complaint: updated });
}
