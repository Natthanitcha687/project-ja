// backend-sma/src/controllers/admin.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma.js";
import { sendMail } from "../config/mail.js"; // มีอยู่แล้วในโปรเจกต์ (ส่งแบบ best-effort)
import { createAndPublish as createNotification } from "../routes/notifications.routes.js";
import { logAudit, clientInfo } from "../services/audit.service.js";
import { buildEmailShell } from "../services/email.js";

const ADMIN_CONTACT_EMAIL = process.env.ADMIN_EMAIL || "support@example.com";


function sign(user) {
  const payload = { sub: user.id, role: user.role, email: user.email };
  const secret = process.env.JWT_SECRET || "dev-secret";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { expiresIn });
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
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
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
 * Feedback (Satisfaction)
 * ========================= */

// GET /admin/feedback
// แสดงรายการแบบประเมินความพึงพอใจล่าสุด (จำกัดสูงสุด 200 แถว)
export async function listFeedback(req, res) {
  const takeRaw = Number(req.query.take || 100);
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 100;

  const where = {};
  const rating = Number(req.query.rating || 0);
  if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
    where.rating = rating;
  }

  const rows = await prisma.satisfaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: {
        select: { id: true, email: true, role: true },
      },
      store: {
        select: {
          id: true,
          storeProfile: { select: { storeName: true } },
        },
      },
    },
  });

  res.json({ feedback: rows });
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

/* =========================
 * Admin: create warranty for a store
 * ========================= */

function normalizeEmail(e) {
  return e ? String(e).trim().toLowerCase() : null;
}

function pad3(n) {
  const s = String(n);
  return s.length >= 3 ? s : "0".repeat(3 - s.length) + s;
}

// สุ่มสตริงตัวเลข+ตัวอักษรพิมพ์ใหญ่ ความยาวที่กำหนด
function randomAlnum(length = 7) {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function addMonths(date, m) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + m);
  return d;
}

function daysBetween(a, b) {
  const A = new Date(a);
  const B = new Date(b);
  return Math.ceil((B.getTime() - A.getTime()) / (24 * 3600 * 1000));
}

// สร้างรหัสใบรับประกันแบบสุ่มรูปแบบ WR-XXXXXX
// prefix สามารถส่งมาเป็น "WR" หรือ "WR-" ได้ จะถูก normalize ให้มีขีดกลางเสมอ
async function nextWarrantyCodeForStore(_tx, _storeId, { prefix = "WR" } = {}) {
  const normPrefix = prefix.endsWith("-") ? prefix : `${prefix}-`;
  const body = randomAlnum(7); // 6-8 ตัวอักษร: ใช้ 7 เป็นค่ากลาง
  return `${normPrefix}${body}`;
}

async function allocateWarrantyCode(tx, storeId, opts) {
  for (let i = 0; i < 5; i++) {
    const code = await nextWarrantyCodeForStore(tx, storeId, opts);
    const exists = await tx.warranty.findUnique({ where: { storeId_code: { storeId, code } } });
    if (!exists) return code;
  }
  throw new Error("Unable to allocate warranty code");
}

function mapWarrantyHeaderForResponse(header, notifyDays) {
  return {
    id: header.id,
    code: header.code,
    customerEmail: header.customerEmail ?? null,
    customerName: header.customerName ?? null,
    customerPhone: header.customerPhone ?? null,
    createdAt: header.createdAt,
    updatedAt: header.updatedAt,
    items: (header.items || []).map((w) => {
      const today = new Date();
      const exp = w.expiryDate ? new Date(w.expiryDate) : null;
      let statusCode = "active",
        statusTag = "ใช้งานได้",
        statusColor = "text-emerald-600 bg-emerald-50";
      if (exp) {
        const remain = daysBetween(today, exp);
        if (remain < 0) {
          statusCode = "expired";
          statusTag = "หมดอายุ";
          statusColor = "text-rose-600 bg-rose-50";
        } else if (remain <= (notifyDays ?? 14)) {
          statusCode = "nearing_expiration";
          statusTag = "ใกล้หมดอายุ";
          statusColor = "text-amber-700 bg-amber-50";
        }
      }
      return {
        id: w.id,
        productName: w.productName,
        model: w.model ?? null,
        serial: w.serial,
        purchaseDate: w.purchaseDate ? new Date(w.purchaseDate).toISOString().slice(0, 10) : null,
        expiryDate: w.expiryDate ? new Date(w.expiryDate).toISOString().slice(0, 10) : null,
        durationMonths: w.durationMonths ?? null,
        durationDays: w.durationDays ?? null,
        coverageNote: w.coverageNote ?? null,
        note: w.note ?? null,
        images: Array.isArray(w.images) ? w.images : w.images ? w.images : [],
        statusCode,
        statusTag,
        statusColor,
        daysLeft: exp ? daysBetween(today, exp) : null,
      };
    }),
  };
}

export async function createStoreWarranty(req, res) {
  const storeId = Number(req.params.id);
  if (!storeId) return res.status(400).json({ message: "store id ไม่ถูกต้อง" });

  const storeUser = await prisma.user.findUnique({ where: { id: storeId } });
  if (!storeUser || storeUser.role !== "STORE") {
    return res.status(404).json({ message: "ไม่พบบัญชีร้านค้า" });
  }

  try {
    const storeProfile = await prisma.storeProfile.findUnique({ where: { userId: storeId } });
    const notifyDays = storeProfile?.notifyDaysInAdvance ?? 14;

    const createdHeader = await prisma.$transaction(async (tx) => {
      let code = await allocateWarrantyCode(tx, storeId, { prefix: "WR" });

      const fullNameFromCP = (cp) => {
        if (!cp) return null;
        const fn = (cp.firstName || "").trim();
        const ln = (cp.lastName || "").trim();
        const nm = `${fn} ${ln}`.trim();
        return nm || null;
      };

      async function resolveCustomer(rawEmail, nameFromPayload, phoneFromPayload) {
        const normEmail = normalizeEmail(rawEmail);
        if (!normEmail) {
          return { email: null, userId: null, name: nameFromPayload ?? null, phone: phoneFromPayload ?? null };
        }
        const user = await tx.user.findFirst({
          where: { email: { equals: normEmail, mode: "insensitive" }, role: "CUSTOMER" },
          select: { id: true },
        });
        let name = nameFromPayload ?? null;
        let phone = phoneFromPayload ?? null;
        if (user) {
          const cp = await tx.customerProfile.findUnique({
            where: { userId: user.id },
            select: { firstName: true, lastName: true, phone: true },
          });
          if (!name) name = fullNameFromCP(cp);
          if (!phone && cp?.phone) phone = cp.phone;
        }
        return { email: normEmail, userId: user?.id ?? null, name, phone };
      }

      const body = req.body ?? {};

      if (Array.isArray(body.items) && body.items.length > 0) {
        const first = body.items[0] || {};
        const { email, userId, name, phone } = await resolveCustomer(
          first.customer_email ?? first.customerEmail,
          first.customer_name ?? first.customerName,
          first.customer_phone ?? first.customerPhone
        );

        const usedSerial = new Set();
        let seq = 1;
        const itemsToCreate = body.items.map((it) => {
          const purchase = it.purchase_date ? new Date(it.purchase_date) : new Date();
          let expiry = it.expiry_date ? new Date(it.expiry_date) : null;
          const dm = Number(it.duration_months ?? it.durationMonths ?? 0);
          if (!expiry && dm > 0) expiry = addMonths(purchase, dm);


          // Log the incoming serial for debugging
          console.log('[DEBUG] Incoming serial from frontend:', it.serial);
          let serial = String(it.serial || "").trim();
          if (!serial || usedSerial.has(serial)) {
            serial = null;
          } else {
            usedSerial.add(serial);
          }

          return {
            productName: String(it.product_name || it.productName || "").trim(),
            model: (it.model || it.product_model || "").trim() || null,
            serial,
            purchaseDate: purchase,
            expiryDate: expiry,
            durationMonths: dm || null,
            durationDays: expiry ? daysBetween(purchase, expiry) : null,
            coverageNote: String(it.warranty_terms || it.coverageNote || "").trim() || null,
            note: String(it.note || "").trim() || null,
            images: [],
          };
        });

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await tx.warranty.create({
              data: {
                storeId,
                code,
                customerEmail: email,
                customerUserId: userId,
                customerName: name,
                customerPhone: phone,
                items: { create: itemsToCreate },
              },
              include: { items: true },
            });
          } catch (e) {
            if (
              e?.code === "P2002" &&
              (e.meta?.target?.includes?.("storeId_code") || e.meta?.target?.includes?.("code"))
            ) {
              code = await allocateWarrantyCode(tx, storeId, { prefix: "WR" });
              continue;
            }
            if (e?.code === "P2002" && e.meta?.target?.includes?.("warrantyId_serial")) {
              throw Object.assign(new Error("Serial number duplicated within the warranty"), { status: 409 });
            }
            throw e;
          }
        }
        throw new Error("Failed to create warranty after retries");
      }

      // single item payload
      const { email, userId, name, phone } = await resolveCustomer(
        body.customer_email ?? body.customerEmail,
        body.customer_name ?? body.customerName,
        body.customer_phone ?? body.customerPhone
      );

      const purchase = body.purchase_date ? new Date(body.purchase_date) : new Date();
      let expiry = body.expiry_date ? new Date(body.expiry_date) : null;
      const dm = Number(body.duration_months ?? body.durationMonths ?? 0);
      if (!expiry && dm > 0) expiry = addMonths(purchase, dm);
      let serialOne = body.serial;
      if (serialOne === undefined || serialOne === null) serialOne = '';
      serialOne = String(serialOne).trim();
      if (!serialOne) serialOne = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await tx.warranty.create({
            data: {
              storeId,
              code,
              customerEmail: email,
              customerUserId: userId,
              customerName: name,
              customerPhone: phone,
              items: {
                create: [
                  {
                    productName: String(body.product_name || body.productName || "").trim(),
                    model: String(body.model || body.product_model || "").trim() || null,
                    serial: serialOne,
                    purchaseDate: purchase,
                    expiryDate: expiry,
                    durationMonths: dm || null,
                    durationDays: expiry ? daysBetween(purchase, expiry) : null,
                    coverageNote: String(body.warranty_terms || body.coverageNote || "").trim() || null,
                    note: String(body.note || "").trim() || null,
                    images: [],
                  },
                ],
              },
            },
            include: { items: true },
          });
        } catch (e) {
          if (
            e?.code === "P2002" &&
            (e.meta?.target?.includes?.("storeId_code") || e.meta?.target?.includes?.("code"))
          ) {
            code = await allocateWarrantyCode(tx, storeId, { prefix: "WR" });
            continue;
          }
          if (e?.code === "P2002" && e.meta?.target?.includes?.("warrantyId_serial")) {
            throw Object.assign(new Error("Serial number duplicated within the warranty"), { status: 409 });
          }
          throw e;
        }
      }
      throw new Error("Failed to create warranty after retries");
    });

    // notify customer user if linked
    try {
      const title = `สร้างใบรับประกัน ${createdHeader.code || ""}`;
      const bodyText = `สร้างใบรับประกัน ${createdHeader.code || ""} จำนวน ${createdHeader.items?.length || 0} รายการ`;
      if (createdHeader.customerUserId) {
        await createNotification({
          prisma,
          attrs: {
            userId: createdHeader.customerUserId,
            title,
            body: bodyText,
            data: { type: "warranty_created", warrantyId: createdHeader.id },
            sendEmail: true,
          },
        });
      }
    } catch (e) {
      console.warn("notify warranty created failed (admin)", e?.message || e);
    }

    // audit
    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: Number(req.user?.id ?? req.user?.sub) || null,
          action: "CREATE_WARRANTY",
          targetType: "Store",
          targetId: String(storeId),
          ip: req.ip || null,
          userAgent: req.get ? req.get("user-agent") : null,
          meta: {
            result: "SUCCESS",
            storeId,
            warrantyId: createdHeader.id,
            warrantyCode: createdHeader.code,
            after: createdHeader,
          },
        },
      });
    } catch (e) {
      console.warn("audit CREATE_WARRANTY failed (ignored):", e?.message || e);
    }

    return res.status(201).json({
      message: "สร้างใบรับประกันเรียบร้อย",
      data: { warranty: mapWarrantyHeaderForResponse(createdHeader, notifyDays) },
    });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ message: error.message });
    if (error?.code === "P2002" && error.meta?.target?.includes?.("warrantyId_serial")) {
      return res.status(409).json({ message: "Serial ซ้ำภายในใบรับประกัน" });
    }
    if (
      error?.code === "P2002" &&
      (error.meta?.target?.includes?.("storeId_code") || error.meta?.target?.includes?.("code"))
    ) {
      return res.status(409).json({ message: "รหัสใบรับประกันซ้ำ กรุณาลองใหม่" });
    }
    console.error("createStoreWarranty error", error);
    return res.status(500).json({ message: "ไม่สามารถสร้างใบรับประกันได้" });
  }
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

  const html = buildEmailShell({
    title: "บัญชีร้านถูกลบโดยผู้ดูแลระบบ",
    messageHtml: `
      <p style="font-size:16px;font-weight:bold;color:#1f2937;">เรียน เจ้าของร้านค้า,</p>
      <p>บัญชีร้านค้าของคุณถูกลบออกจากระบบโดยผู้ดูแลระบบ</p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px;margin:16px 0;border-radius:4px;">
        <p style="margin:0;font-weight:bold;color:#991b1b;">เหตุผล:</p>
        <p style="margin:4px 0 0 0;color:#b91c1c;">${reason || "-"}</p>
      </div>
      <p>หากคุณมีข้อสงสัยหรือต้องการยื่นอุทธรณ์ สามารถกรอกแบบฟอร์มได้ที่:</p>
      <p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/appeal-suspension?email=${store.email}" style="color:#2563eb;font-weight:600;text-decoration:none;">
          📝 ยื่นอุทธรณ์ / ขอปลดระงับ
        </a>
      </p>
    `,
    footerNote: "ระบบจัดการใบรับประกันอัจฉริยะ",
  });

  await sendMailBestEffort({
    to: store.email,
    subject: "แจ้งเตือน: บัญชีร้านถูกลบโดยผู้ดูแลระบบ",
    text: `บัญชีร้านของคุณถูกลบโดยผู้ดูแลระบบ\nเหตุผล: ${reason || "-"}\nติดต่อ: ${ADMIN_CONTACT_EMAIL}`,
    html,
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

  // ✅ 1. ล้างข้อมูลในใบรับประกันที่ผูกกับ User นี้ (Unlink warranties)
  // เพื่อไม่ให้ใบรับประกันเก่ากลับมาแสดงผลหากลูกค้าสมัครใหม่ด้วยอีเมลเดิม
  await prisma.warranty.updateMany({
    where: { customerUserId: customerId },
    data: {
      customerEmail: null,
      customerPhone: null,
      customerName: null,
      customerAddress: null,
    },
  });

  await logAudit(req, "DELETE_CUSTOMER_ACCOUNT", "User", customerId, {
    result: "SUCCESS",
    reason: reason || null,
    before,
  });

  const html = buildEmailShell({
    title: "บัญชีของคุณถูกลบโดยผู้ดูแลระบบ",
    messageHtml: `
      <p style="font-size:16px;font-weight:bold;color:#1f2937;">เรียน ลูกค้าผู้ใช้งาน,</p>
      <p>บัญชีผู้ใช้งานของคุณถูกลบออกจากระบบโดยผู้ดูแลระบบ</p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px;margin:16px 0;border-radius:4px;">
        <p style="margin:0;font-weight:bold;color:#991b1b;">เหตุผล:</p>
        <p style="margin:4px 0 0 0;color:#b91c1c;">${reason || "-"}</p>
      </div>
      <p>หากคุณคิดว่าเป็นความผิดพลาด สามารถยื่นอุทธรณ์ได้ที่:</p>
      <p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/appeal-suspension?email=${user.email}" style="color:#2563eb;font-weight:600;text-decoration:none;">
          📝 ยื่นอุทธรณ์ / ขอปลดระงับ
        </a>
      </p>
    `,
    footerNote: "ระบบจัดการใบรับประกันอัจฉริยะ",
  });

  await sendMailBestEffort({
    to: user.email,
    subject: "แจ้งเตือน: บัญชีของคุณถูกลบโดยผู้ดูแลระบบ",
    text: `บัญชีของคุณถูกลบโดยผู้ดูแลระบบ\nเหตุผล: ${reason || "-"}\nติดต่อ: ${ADMIN_CONTACT_EMAIL}`,
    html,
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

        const html = buildEmailShell({
          title: `${whoText}ถูกระงับการใช้งาน`,
          messageHtml: `
            <p style="font-size:16px;font-weight:bold;color:#1f2937;">เรียน ผู้ใช้งาน (${roleLabel}),</p>
            <p>บัญชีของคุณถูกระงับการใช้งานชั่วคราวโดยผู้ดูแลระบบ</p>
            
            <table style="width:100%;margin:16px 0;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px;color:#6b7280;width:140px;">ระยะเวลา (วัน):</td>
                <td style="padding:8px;font-weight:600;color:#111827;">${daysTxt}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px;color:#6b7280;">หมดระงับวันที่:</td>
                <td style="padding:8px;font-weight:600;color:#111827;">${untilTxt}</td>
              </tr>
              <tr>
                <td style="padding:8px;color:#6b7280;vertical-align:top;">เหตุผล:</td>
                <td style="padding:8px;font-weight:600;color:#b91c1c;">${reasonTxt}</td>
              </tr>
            </table>

            <p>หากคุณมีข้อสงสัยหรือต้องการยื่นอุทธรณ์ สามารถกรอกแบบฟอร์มได้ที่:</p>
            <p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/appeal-suspension?email=${updated.email}" style="color:#2563eb;font-weight:600;text-decoration:none;">
                📝 ยื่นอุทธรณ์ / ขอปลดระงับ
              </a>
            </p>
          `,
          footerNote: "ระบบจัดการใบรับประกันอัจฉริยะ",
        });

        await sendMailBestEffort({
          to: updated.email,
          subject: `แจ้งเตือน: ${whoText}ถูกระงับ`,
          text:
            `${whoText}ถูกระงับโดยผู้ดูแลระบบ\n` +
            `ประเภทบัญชี: ${roleLabel}\n` +
            `ระยะเวลา(วัน): ${daysTxt}\n` +
            `หมดระงับ: ${untilTxt}\n` +
            `เหตุผล: ${reasonTxt}\n` +
            `ติดต่อ: ${ADMIN_CONTACT_EMAIL}`,
          html,
        });
      } else {
        // ✅ ปลดระงับ “แบบละเอียด”
        const prevAt = before?.suspendedAt ? fmtTH(before.suspendedAt) : "-";
        const prevUntil = before?.suspendedUntil ? fmtTH(before.suspendedUntil) : "-";
        const prevReason = before?.suspendedReason ? String(before.suspendedReason) : "-";

        const earlyUnsuspend =
          before?.suspendedUntil && new Date(before.suspendedUntil).getTime() > Date.now();

        const html = buildEmailShell({
          title: `${whoText}ถูกปลดระงับแล้ว`,
          messageHtml: `
            <p style="font-size:16px;font-weight:bold;color:#1f2937;">เรียน ผู้ใช้งาน (${roleLabel}),</p>
            <p style="color:#059669;font-weight:600;">ยินดีด้วย! บัญชีของคุณได้รับการปลดระงับเรียบร้อยแล้ว</p>
            <p>คุณสามารถกลับเข้าใช้งานระบบได้ตามปกติทันที</p>
            
            ${earlyUnsuspend ? `
              <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:12px;margin:16px 0;border-radius:4px;">
                <p style="margin:0;font-size:14px;color:#065f46;">
                  * บัญชีนี้ได้รับปลดระงับก่อนกำหนดเดิม (${prevUntil})
                </p>
              </div>
            ` : ""}

            <p style="font-size:13px;color:#6b7280;margin-top:20px;">
              ประวัติการระงับเดิม:<br>
              - วันที่เริ่ม: ${prevAt}<br>
              - เหตุผล: ${prevReason}
            </p>
          `,
          ctaUrl: process.env.FRONTEND_URL || "http://localhost:5173",
          ctaText: "เข้าสู่ระบบ",
          footerNote: "ระบบจัดการใบรับประกันอัจฉริยะ",
        });

        await sendMailBestEffort({
          to: updated.email,
          subject: `แจ้งเตือน: ${whoText}ถูกปลดระงับแล้ว`,
          text:
            `${whoText}ถูกปลดระงับแล้ว\n` +
            `สามารถกลับเข้าใช้งานได้ทันที\n` +
            `\n(เดิมระงับเมื่อ: ${prevAt}, เหตุผล: ${prevReason})`,
          html,
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
        .filter((l) => (l.targetType || "").toLowerCase() === "complaint" && l.targetId)
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
    complaintUserMap = new Map((complaints || []).map((c) => [String(c.id), c.user || null]));
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

/* =========================
 * Complaints helpers (safe images)
 * ========================= */

function isMissingImagesColumnError(err) {
  // Prisma: P2022 = Column does not exist
  if (err?.code === "P2022") return true;

  const msg = String(err?.message || "").toLowerCase();
  // postgres: column "images" of relation "Complaint" does not exist
  // mysql: unknown column 'images' ...
  return (
    msg.includes("images") &&
    (msg.includes("does not exist") || msg.includes("unknown column") || msg.includes("column"))
  );
}

function normalizeComplaintImages(row) {
  const imgs = row?.images;
  return { ...row, images: Array.isArray(imgs) ? imgs : [] };
}

function extractWarrantyCodeFromMessage(message) {
  if (!message) return null;
  const m = message.match(/รหัสใบรับประกัน[:：]\s*([^\s]+)/);
  return m?.[1] || null;
}

/**
 * include user + profile เพื่อให้ฝั่ง Admin UI แสดง "ผู้ส่ง" ได้
 * ✅ เพิ่ม images แบบ fallback-safe (ถ้า DB ยังไม่มีคอลัมน์ images จะไม่พัง)
 */
export async function listComplaints(req, res) {
  const status = (req.query.status || "").toString().trim();

  const userSelect = {
    select: {
      id: true,
      email: true,
      role: true,
      customerProfile: { select: { firstName: true, lastName: true, phone: true } },
      storeProfile: { select: { storeName: true, phone: true } },
    },
  };

  const selectWithImages = {
    id: true,
    userId: true,
    category: true,
    subject: true,
    message: true,
    status: true,
    images: true, // ✅ images
    createdAt: true,
    updatedAt: true,
    user: userSelect,
  };

  const selectWithoutImages = {
    id: true,
    userId: true,
    category: true,
    subject: true,
    message: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    user: userSelect,
  };

  let complaints = [];
  try {
    complaints = await prisma.complaint.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      select: selectWithImages,
    });
    complaints = (complaints || []).map(normalizeComplaintImages);
  } catch (e) {
    if (isMissingImagesColumnError(e)) {
      complaints = await prisma.complaint.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: "desc" },
        take: 200,
        select: selectWithoutImages,
      });
      complaints = (complaints || []).map((c) => ({ ...c, images: [] }));
    } else {
      throw e;
    }
  }

  res.json({ complaints });
}

export async function restoreWarrantyFromComplaint(req, res) {
  const id = req.params.id;

  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!complaint) {
    return res.status(404).json({ message: "ไม่พบคำร้องนี้" });
  }

  if (!complaint.user || !["STORE", "CUSTOMER"].includes(complaint.user.role)) {
    return res
      .status(400)
      .json({ message: "สามารถกู้คืนอัตโนมัติได้เฉพาะคำร้องที่ส่งโดยร้านค้าหรือลูกค้าเท่านั้น" });
  }

  const code = complaint.warrantyCode || extractWarrantyCodeFromMessage(complaint.message);

  if (!code) {
    return res.status(400).json({ message: "ไม่พบรหัสใบรับประกันในคำร้อง" });
  }

  let snapshotRow;

  if (complaint.user.role === "STORE") {
    const storeId = complaint.user.id;
    const [row] = await prisma.$queryRaw`
      SELECT "data"
      FROM "Notification"
      WHERE "storeId" = ${storeId}
        AND "data"->>'type' = 'warranty_deleted'
        AND "data"->'warrantySnapshot'->>'code' = ${code}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    snapshotRow = row;
  } else {
    const customerUserId = complaint.user.id;
    const [row] = await prisma.$queryRaw`
      SELECT "data"
      FROM "Notification"
      WHERE "userId" = ${customerUserId}
        AND "data"->>'type' = 'warranty_deleted'
        AND "data"->'warrantySnapshot'->>'code' = ${code}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    snapshotRow = row;
  }

  const snapshot = snapshotRow?.data?.warrantySnapshot;

  if (!snapshot) {
    return res
      .status(404)
      .json({ message: "ไม่พบข้อมูลใบรับประกันเดิมสำหรับรหัสนี้ในประวัติการแจ้งเตือน" });
  }

  // หา storeId ของใบรับประกันจาก snapshot หรือจาก Notification อื่น (รองรับเคสเก่า ๆ)
  let storeId = snapshot.storeId || (complaint.user.role === "STORE" ? complaint.user.id : null);
  if (!storeId) {
    try {
      const [storeRow] = await prisma.$queryRaw`
        SELECT "storeId"
        FROM "Notification"
        WHERE "data"->>'type' = 'warranty_deleted'
          AND "data"->'warrantySnapshot'->>'code' = ${code}
          AND "storeId" IS NOT NULL
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;
      if (storeRow?.storeId) {
        storeId = storeRow.storeId;
      }
    } catch (e) {
      console.warn(
        "restoreWarrantyFromComplaint: lookup storeId by code failed (ignored)",
        e?.message || e
      );
    }
  }

  if (!storeId) {
    return res
      .status(400)
      .json({ message: "ไม่พบข้อมูลร้านเจ้าของใบรับประกัน จึงไม่สามารถกู้คืนอัตโนมัติได้" });
  }

  const existing = await prisma.warranty.findFirst({ where: { storeId, code } });
  if (existing) {
    return res
      .status(409)
      .json({ message: "มีใบรับประกันรหัสนี้ในระบบอยู่แล้ว ไม่สามารถกู้ซ้ำได้" });
  }

  const purchaseDate = snapshot.purchaseDate ? new Date(snapshot.purchaseDate) : new Date();
  const expiryDate = snapshot.expiryDate ? new Date(snapshot.expiryDate) : null;

  // ✅ หาลูกค้าจาก snapshot เพื่อผูก customerUserId ให้ใบที่กู้คืน (ถ้ามีอีเมล)
  const snapshotEmail = snapshot.customerEmail ? String(snapshot.customerEmail).trim() : null;
  let resolvedCustomerUserId = snapshot.customerUserId || null;
  if (!resolvedCustomerUserId && snapshotEmail) {
    try {
      const found = await prisma.user.findFirst({
        where: {
          email: { equals: snapshotEmail, mode: "insensitive" },
          role: "CUSTOMER",
        },
        select: { id: true },
      });
      if (found) resolvedCustomerUserId = found.id;
    } catch (e) {
      console.warn(
        "restoreWarrantyFromComplaint: resolve customerUserId from email failed (ignored)",
        e?.message || e
      );
    }
  }

  // เตรียมข้อมูล items สำหรับกู้คืน
  let itemsToCreate = [];

  if (Array.isArray(snapshot.items) && snapshot.items.length > 0) {
    itemsToCreate = snapshot.items.map((it) => ({
      productName: it.productName || "ไม่ระบุ",
      model: it.model || null,
      serial: it.serial || null,
      price: typeof it.price === "number" ? it.price : null,
      purchaseDate: it.purchaseDate ? new Date(it.purchaseDate) : purchaseDate,
      expiryDate: it.expiryDate ? new Date(it.expiryDate) : expiryDate,
      durationMonths:
        typeof it.durationMonths === "number" ? it.durationMonths : null,
      durationDays:
        typeof it.durationDays === "number" ? it.durationDays : null,
      coverageNote: it.coverageNote || null,
      note: it.note || null,
      documents: it.documents ?? null,
      images: it.images ?? null,
      selectedConditions: it.selectedConditions ?? null,
      customCondition: it.customCondition ?? null,
      customerNote: it.customerNote ?? null,
    }));
  } else {
    // backward-compatible: ใช้รูปแบบ snapshot เดิมที่มีแค่ฟิลด์บนหัวใบ + รายการแรก
    itemsToCreate = [
      {
        productName: snapshot.productName || "ไม่ระบุ",
        model: snapshot.model || null,
        serial: snapshot.serial || null,
        price: typeof snapshot.price === "number" ? snapshot.price : null,
        purchaseDate,
        expiryDate,
        durationMonths:
          typeof snapshot.durationMonths === "number"
            ? snapshot.durationMonths
            : null,
        durationDays:
          typeof snapshot.durationDays === "number"
            ? snapshot.durationDays
            : null,
        coverageNote: snapshot.coverageNote || null,
        note: snapshot.note || null,
      },
    ];
  }

  try {
    const [warranty] = await prisma.$transaction([
      prisma.warranty.create({
        data: {
          storeId,
          code: snapshot.code || code,
          customerEmail: snapshot.customerEmail || null,
          customerName: snapshot.customerName || null,
          customerPhone: snapshot.customerPhone || null,
          customerAddress: snapshot.customerAddress || null,
          customerUserId: resolvedCustomerUserId || null,
          items: {
            create: itemsToCreate,
          },
        },
      }),
      prisma.complaint.update({
        where: { id },
        data: { status: "RESOLVED" },
      }),
    ]);

    // In-app notifications: ร้าน + ลูกค้า (ถ้ามี user)
    try {
      const codeLabel = warranty.code || code;
      const productLabel = snapshot.productName || "สินค้า";

      // ฝั่งร้านค้า (ใช้ storeId เพื่อให้ไปโผล่ใน Dashboard ร้าน)
      await createNotification({
        prisma,
        attrs: {
          storeId,
          title: `กู้คืนใบรับประกันรหัส ${codeLabel} แล้ว`,
          body: `ระบบได้กู้คืนใบรับประกันรหัส ${codeLabel} สำหรับสินค้า ${productLabel} ให้กลับมาอยู่ในรายการของร้านเรียบร้อยแล้ว`,
          data: {
            type: "warranty_restored",
            warrantyId: warranty.id,
            warrantyCode: codeLabel,
            warrantySnapshot: snapshot,
            complaintId: id,
          },
          sendEmail: false,
        },
      });

      // ฝั่งลูกค้า (ใช้ customerUserId จากใบที่กู้คืนเป็นหลัก ถ้ายังไม่มีค่อย fallback หาอีเมลใน snapshot)
      let customerUserIdForNotify = warranty.customerUserId || null;
      const customerEmail = snapshot.customerEmail || warranty.customerEmail || null;
      if (!customerUserIdForNotify && customerEmail) {
        try {
          const foundUser = await prisma.user.findFirst({
            where: {
              email: { equals: String(customerEmail).trim(), mode: "insensitive" },
            },
            select: { id: true },
          });
          if (foundUser) customerUserIdForNotify = foundUser.id;
        } catch (lookupErr) {
          console.warn(
            "restoreWarrantyFromComplaint: lookup customer by email failed (ignored)",
            lookupErr?.message || lookupErr
          );
        }
      }

      if (customerUserIdForNotify) {
        await createNotification({
          prisma,
          attrs: {
            userId: customerUserIdForNotify,
            title: `[คืนสถานะ] ใบรับประกันรหัส ${codeLabel} ถูกกู้คืนแล้ว`,
            body: `ใบรับประกันสินค้า ${productLabel} ของคุณ (รหัส ${codeLabel}) ถูกกู้คืนกลับเข้าสู่ระบบเรียบร้อยแล้ว สามารถตรวจสอบได้ในเมนูใบรับประกันของฉัน`,
            data: {
              type: "warranty_restored",
              warrantyId: warranty.id,
              warrantyCode: codeLabel,
              warrantySnapshot: snapshot,
              complaintId: id,
            },
            sendEmail: false,
          },
        });
      }

        // ✅ ทำเครื่องหมาย notification ลบใบรับประกันเดิมว่าถูกกู้คืนแล้ว (recovered)
        try {
          await prisma.$executeRaw`
            UPDATE "Notification"
            SET "data" = jsonb_set(COALESCE("data", '{}'::jsonb), '{recovered}', 'true'::jsonb, true)
            WHERE "data"->>'type' = 'warranty_deleted'
              AND "data"->'warrantySnapshot'->>'code' = ${code};
          `;
        } catch (markErr) {
          console.warn(
            "restoreWarrantyFromComplaint: mark warranty_deleted as recovered failed (ignored)",
            markErr?.message || markErr
          );
        }
    } catch (notifyErr) {
      console.warn(
        "restoreWarrantyFromComplaint: create notification failed (ignored)",
        notifyErr?.message || notifyErr
      );
    }

    return res.json({
      message: "กู้คืนใบรับประกันเรียบร้อยแล้ว",
      warranty,
    });
  } catch (e) {
    console.error("restoreWarrantyFromComplaint error", e);
    return res.status(500).json({ message: "ไม่สามารถกู้คืนใบรับประกันได้" });
  }
}

/**
 * update แล้ว include user กลับไปด้วย (กัน UI หลุดข้อมูลผู้ส่งใน modal/list)
 * ✅ เพิ่ม images แบบ fallback-safe (ถ้า DB ยังไม่มีคอลัมน์ images จะไม่พัง)
 */
export async function setComplaintStatus(req, res) {
  const id = req.params.id;
  const { status } = req.body || {};

  if (!["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"].includes(status))
    return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });

  // Only fetch minimal fields to avoid selecting `images` column when missing
  const beforeRow = await prisma.complaint.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!beforeRow) return res.status(404).json({ message: "ไม่พบข้อมูลการแจ้งปัญหา" });

  const before = { status: beforeRow.status };

  const userSelect = {
    select: {
      id: true,
      email: true,
      role: true,
      customerProfile: { select: { firstName: true, lastName: true, phone: true } },
      storeProfile: { select: { storeName: true, phone: true } },
    },
  };

  const selectWithImages = {
    id: true,
    userId: true,
    category: true,
    subject: true,
    message: true,
    status: true,
    images: true, // ✅ images
    createdAt: true,
    updatedAt: true,
    user: userSelect,
  };

  const selectWithoutImages = {
    id: true,
    userId: true,
    category: true,
    subject: true,
    message: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    user: userSelect,
  };

  try {
    let updated;

    try {
      updated = await prisma.complaint.update({
        where: { id },
        data: { status },
        select: selectWithImages,
      });
      updated = normalizeComplaintImages(updated);
    } catch (e) {
      if (isMissingImagesColumnError(e)) {
        updated = await prisma.complaint.update({
          where: { id },
          data: { status },
          select: selectWithoutImages,
        });
        updated = { ...updated, images: [] };
      } else {
        throw e;
      }
    }

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
