// backend-sma/src/controllers/store.controller.js
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { createAndPublish as createNotification } from "../routes/notifications.routes.js";
import { sendError, sendSuccess } from "../utils/http.js";

const DEFAULT_NOTIFY_DAYS = 14;

/* ==================== Helpers ==================== */
const normalizeEmail = (e) => (e ? String(e).trim().toLowerCase() : null);

// ✅ เพิ่ม (ยึดรูปแบบเดียวกับ customer.controller.js)
function trimOrNull(s) {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t ? t : null;
}

function parseStoreId(req, res) {
  const storeId = Number(req.params.storeId);
  if (!Number.isInteger(storeId)) {
    sendError(res, 400, "Store id must be a number");
    return null;
  }
  if (Number(req.user?.sub) !== storeId) {
    sendError(res, 403, "คุณไม่มีสิทธิ์เข้าถึงร้านค้านี้");
    return null;
  }
  return storeId;
}

function mapStoreProfile(profile, userEmail) {
  if (!profile) {
    return {
      storeName: "",
      contactName: "",
      email: userEmail ?? "",
      phone: "",
      address: "",
      businessHours: "",
      avatarUrl: "",
      storeType: "",
      ownerName: "",
      notifyDaysInAdvance: DEFAULT_NOTIFY_DAYS,
    };
  }
  return {
    storeName: profile.storeName,
    contactName: profile.contactName ?? profile.ownerName ?? "",
    email: profile.email ?? userEmail ?? "",
    phone: profile.phone,
    address: profile.address,
    businessHours: profile.businessHours,
    avatarUrl: profile.avatarUrl ?? "",
    storeType: profile.storeType,
    ownerName: profile.ownerName,
    notifyDaysInAdvance: profile.notifyDaysInAdvance ?? DEFAULT_NOTIFY_DAYS,
  };
}

function pad3(n) {
  const s = String(n);
  return s.length >= 3 ? s : "0".repeat(3 - s.length) + s;
}
function daysBetween(a, b) {
  return Math.ceil((b.getTime() - a.getTime()) / (24 * 3600 * 1000));
}
function addMonths(date, m) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + m);
  return d;
}

// ✅ ทำ meta ให้เป็น JSON-safe (กัน Prisma Json ไม่รับ Date/Object พิเศษ)
function jsonSafe(v) {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return null;
  }
}

// ✅ best-effort audit log ตอนสร้างใบรับประกัน (ห้ามทำให้ระบบพัง)
async function auditCreateWarrantyBestEffort(req, storeId, createdHeader) {
  try {
    const actorUserId = Number(req.user?.id ?? req.user?.sub);
    const actorOk = Number.isInteger(actorUserId) ? actorUserId : null;

    const customerUserId = createdHeader?.customerUserId ?? null;
    const customerEmail = createdHeader?.customerEmail ?? null;

    const targetType = customerUserId
      ? "User"
      : customerEmail
      ? "CustomerEmail"
      : null;

    const targetId = customerUserId
      ? String(customerUserId)
      : customerEmail
      ? String(customerEmail)
      : null;

    const xf = req.headers["x-forwarded-for"];
    const ip =
      (typeof xf === "string" ? xf.split(",")[0].trim() : null) ||
      req.headers["x-real-ip"]?.toString()?.trim() ||
      req.headers["cf-connecting-ip"]?.toString()?.trim() ||
      req.ip ||
      null;

    const userAgent =
      (typeof req.get === "function" ? req.get("user-agent") : null) || null;

    await prisma.auditLog.create({
      data: {
        actorUserId: actorOk,
        action: "CREATE_WARRANTY",
        targetType,
        targetId,
        ip,
        userAgent,
        meta: {
          result: "SUCCESS",
          storeId,
          warrantyId: createdHeader?.id ?? null,
          warrantyCode: createdHeader?.code ?? null,
          customerUserId,
          customerEmail,
          after: jsonSafe(createdHeader),
        },
      },
    });
  } catch (e) {
    console.warn("audit CREATE_WARRANTY failed (ignored):", e?.message || e);
  }
}

/* ==================== Allocate WR (per store) ==================== */
async function nextWarrantyCodeForStore(tx, storeId, { prefix = "WR" } = {}) {
  const last = await tx.warranty.findFirst({
    where: { storeId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let lastNum = 0;
  if (last?.code) {
    const m = last.code.match(/\d+$/);
    if (m) lastNum = Number(m[0]);
  }
  return `${prefix}${pad3(lastNum + 1)}`;
}
async function allocateWarrantyCode(tx, storeId, opts) {
  for (let i = 0; i < 5; i++) {
    const code = await nextWarrantyCodeForStore(tx, storeId, opts);
    const exists = await tx.warranty.findUnique({
      where: { storeId_code: { storeId, code } },
    });
    if (!exists) return code;
  }
  throw new Error("Unable to allocate warranty code");
}

/* ==================== Mapper ==================== */
function mapWarrantyHeaderForResponse(header, notifyDays) {
  return {
    id: header.id,
    code: header.code,
    customerEmail: header.customerEmail ?? null,
    customerName: header.customerName ?? null,
    customerPhone: header.customerPhone ?? null,
    customerAddress: header.customerAddress ?? null, // ✅ เพิ่ม: ที่อยู่ลูกค้า
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
        } else if (remain <= (notifyDays ?? DEFAULT_NOTIFY_DAYS)) {
          statusCode = "nearing_expiration";
          statusTag = "ใกล้หมดอายุ";
          statusColor = "text-amber-700 bg-amber-50";
        }
      }
      return {
        id: w.id,
        productName: w.productName,
        // ⬇️ เพิ่ม model ลงใน response
        model: w.model ?? null,
        serial: w.serial,
        purchaseDate: w.purchaseDate
          ? new Date(w.purchaseDate).toISOString().slice(0, 10)
          : null,
        expiryDate: w.expiryDate
          ? new Date(w.expiryDate).toISOString().slice(0, 10)
          : null,
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

/* ==================== Controllers ==================== */
export async function getStoreDashboard(req, res) {
  const storeId = parseStoreId(req, res);
  if (storeId == null) return;
  try {
    const store = await prisma.user.findUnique({
      where: { id: storeId },
      include: { storeProfile: true },
    });
    if (!store || store.role !== "STORE") {
      return sendError(res, 404, "ไม่พบบัญชีร้านค้า");
    }
    const notifyDays = store.storeProfile?.notifyDaysInAdvance ?? DEFAULT_NOTIFY_DAYS;

    const headers = await prisma.warranty.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { createdAt: "desc" } } },
    });

    const mapped = headers.map((h) => mapWarrantyHeaderForResponse(h, notifyDays));

    // สรุปสถานะรวม
    const allItems = headers.flatMap((h) => h.items);
    const now = new Date();
    let active = 0,
      nearing = 0,
      expired = 0;
    for (const it of allItems) {
      const exp = it.expiryDate ? new Date(it.expiryDate) : null;
      if (!exp) active++;
      else {
        const remain = daysBetween(now, exp);
        if (remain < 0) expired++;
        else if (remain <= notifyDays) nearing++;
        else active++;
      }
    }

    return sendSuccess(res, {
      storeProfile: mapStoreProfile(store.storeProfile, store.email),
      warranties: mapped,
      filters: {
        statuses: [
          { code: "active", label: "ใช้งานได้", count: active },
          { code: "nearing_expiration", label: "ใกล้หมดอายุ", count: nearing },
          { code: "expired", label: "หมดอายุ", count: expired },
        ],
      },
    });
  } catch (error) {
    console.error("getStoreDashboard error", error);
    return sendError(res, 500, "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้");
  }
}

export async function updateStoreProfile(req, res) {
  const storeId = parseStoreId(req, res);
  if (storeId == null) return;
  try {
    const body = req.body ?? {};
    const [storeUser, existingProfile] = await Promise.all([
      prisma.user.findUnique({ where: { id: storeId } }),
      prisma.storeProfile.findUnique({ where: { userId: storeId } }),
    ]);
    if (!storeUser || storeUser.role !== "STORE") {
      return sendError(res, 404, "ไม่พบข้อมูลร้านค้า");
    }

    const updatable = {
      storeName: body.storeName,
      contactName:
        body.contactName ??
        existingProfile?.contactName ??
        existingProfile?.ownerName ??
        null,
      ownerName:
        body.ownerName ??
        existingProfile?.ownerName ??
        body.contactName ??
        existingProfile?.contactName ??
        body.storeName,
      storeType: body.storeType ?? existingProfile?.storeType ?? "ทั่วไป",
      phone: body.phone,
      email: body.email || existingProfile?.email || storeUser.email,
      address: body.address,
      businessHours: body.businessHours ?? existingProfile?.businessHours ?? "",
      avatarUrl: body.avatarUrl ?? existingProfile?.avatarUrl,
      notifyDaysInAdvance:
        body.notifyDaysInAdvance ??
        existingProfile?.notifyDaysInAdvance ??
        DEFAULT_NOTIFY_DAYS,
    };
    if (!updatable.businessHours) updatable.businessHours = "ระบุเวลาทำการ";
    if (!updatable.ownerName) updatable.ownerName = body.storeName;

    const nextProfile = await prisma.storeProfile.upsert({
      where: { userId: storeId },
      update: updatable,
      create: {
        ...updatable,
        userId: storeId,
        isConsent: existingProfile?.isConsent ?? true,
      },
    });

    // ✅ ตาม requirement ใหม่: ร้าน "ไม่ต้อง" ได้แจ้งเตือนเรื่องอื่นนอกเหนือจาก
    // - expiry_daily_summary (job)
    // - complaint_created (ตอนแจ้งปัญหา)
    // ดังนั้น "store_profile_updated" ตัดออก

    return sendSuccess(res, {
      storeProfile: mapStoreProfile(nextProfile, storeUser.email),
    });
  } catch (error) {
    console.error("updateStoreProfile error", error);
    return sendError(res, 500, "ไม่สามารถบันทึกข้อมูลร้านได้");
  }
}

export async function changeStorePassword(req, res) {
  const storeId = parseStoreId(req, res);
  if (storeId == null) return;
  try {
    const body = req.body ?? {};
    const storeUser = await prisma.user.findUnique({ where: { id: storeId } });
    if (!storeUser || storeUser.role !== "STORE") {
      return sendError(res, 404, "ไม่พบข้อมูลร้านค้า");
    }
    const valid = await bcrypt.compare(body.old_password, storeUser.passwordHash);
    if (!valid) return sendError(res, 400, "รหัสผ่านเดิมไม่ถูกต้อง");

    const newHash = await bcrypt.hash(body.new_password, 12);
    await prisma.user.update({
      where: { id: storeId },
      data: { passwordHash: newHash },
    });

    return sendSuccess(res, { message: "เปลี่ยนรหัสผ่านเรียบร้อย" });
  } catch (error) {
    console.error("changeStorePassword error", error);
    return sendError(res, 500, "ไม่สามารถเปลี่ยนรหัสผ่านได้");
  }
}

/**
 * สร้างใบรับประกัน
 * - อีเมลลูกค้า: บังคับเป็น lower-case
 * - ค้นหา/ผูก customerUserId แบบ case-insensitive (เฉพาะ role CUSTOMER)
 * - ถ้าไม่ส่งชื่อ/เบอร์มา จะเติมจาก CustomerProfile อัตโนมัติ
 * - กันรหัส WR และ Serial ซ้ำเหมือนเดิม
 */
export async function createWarranty(req, res) {
  const storeId = parseStoreId(req, res);
  if (storeId == null) return;

  // รวมชื่อจากโปรไฟล์
  const fullNameFromCP = (cp) => {
    if (!cp) return null;
    const fn = (cp.firstName || "").trim();
    const ln = (cp.lastName || "").trim();
    const nm = `${fn} ${ln}`.trim();
    return nm || null;
  };

  try {
    const body = req.body ?? {};
    const storeProfile = await prisma.storeProfile.findUnique({
      where: { userId: storeId },
    });
    const notifyDays = storeProfile?.notifyDaysInAdvance ?? DEFAULT_NOTIFY_DAYS;

    const createdHeader = await prisma.$transaction(async (tx) => {
      let code = await allocateWarrantyCode(tx, storeId, { prefix: "WR" });

      // helper ระบุ email/user/name/phone จากอีเมล
      async function resolveCustomer(rawEmail, nameFromPayload, phoneFromPayload) {
        const normEmail = normalizeEmail(rawEmail);
        if (!normEmail) {
          return {
            email: null,
            userId: null,
            name: nameFromPayload ?? null,
            phone: phoneFromPayload ?? null,
          };
        }

        // หา user แบบไม่สน case และต้องเป็น CUSTOMER
        const user = await tx.user.findFirst({
          where: { email: { equals: normEmail, mode: "insensitive" }, role: "CUSTOMER" },
          select: { id: true },
        });

        // ✅ บังคับ: ถ้ามีการกรอกอีเมล แต่ไม่พบลูกค้าในระบบ -> ไม่ให้ออกใบ
        if (!user) {
          throw Object.assign(
            new Error("ไม่พบอีเมลลูกค้าในระบบ กรุณาให้ลูกค้าสมัครสมาชิกก่อน"),
            { status: 400 }
          );
        }

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

      // ===== payload หลายรายการ =====
      if (Array.isArray(body.items) && body.items.length > 0) {
        const first = body.items[0] || {};
        const { email, userId, name, phone } = await resolveCustomer(
          first.customer_email ?? first.customerEmail,
          first.customer_name ?? first.customerName,
          first.customer_phone ?? first.customerPhone
        );

        // ✅ เพิ่ม: ที่อยู่ลูกค้า (ร้านกรอกตอนออกใบ) - ยึดจากรายการแรก
        const customerAddress = trimOrNull(
          first.customer_address ?? first.customerAddress
        );

        const usedSerial = new Set();
        let seq = 1;
        const itemsToCreate = body.items.map((it) => {
          const purchase = it.purchase_date ? new Date(it.purchase_date) : new Date();
          let expiry = it.expiry_date ? new Date(it.expiry_date) : null;
          const dm = Number(it.duration_months ?? it.durationMonths ?? 0);
          if (!expiry && dm > 0) expiry = addMonths(purchase, dm);

          let serial = String(it.serial || "").trim();
          if (!serial || usedSerial.has(serial)) {
            while (usedSerial.has(`SN${pad3(seq)}`)) seq++;
            serial = `SN${pad3(seq++)}`;
          }
          usedSerial.add(serial);

          return {
            productName: String(it.product_name || it.productName || "").trim(),
            // ⬇️ เพิ่ม model ในการสร้าง
            model: (it.model || it.product_model || "").trim() || null,
            serial,
            purchaseDate: purchase,
            expiryDate: expiry,
            durationMonths: dm || null,
            durationDays: expiry ? daysBetween(purchase, expiry) : null,
            coverageNote:
              String(it.warranty_terms || it.coverageNote || "").trim() || null,
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
                customerAddress, // ✅ เพิ่ม: ที่อยู่ลูกค้า
                items: { create: itemsToCreate },
              },
              include: { items: true },
            });
          } catch (e) {
            if (
              e?.code === "P2002" &&
              (e.meta?.target?.includes?.("storeId_code") ||
                e.meta?.target?.includes?.("code"))
            ) {
              code = await allocateWarrantyCode(tx, storeId, { prefix: "WR" });
              continue;
            }
            if (e?.code === "P2002" && e.meta?.target?.includes?.("warrantyId_serial")) {
              throw Object.assign(new Error("Serial number duplicated within the warranty"), {
                status: 409,
              });
            }
            throw e;
          }
        }
        throw new Error("Failed to create warranty after retries");
      }

      // ===== payload เดิม (รายการเดียว) =====
      const { email, userId, name, phone } = await resolveCustomer(
        body.customer_email ?? body.customerEmail,
        body.customer_name ?? body.customerName,
        body.customer_phone ?? body.customerPhone
      );

      // ✅ เพิ่ม: ที่อยู่ลูกค้า (ร้านกรอกตอนออกใบ)
      const customerAddress = trimOrNull(body.customer_address ?? body.customerAddress);

      const purchase = body.purchase_date ? new Date(body.purchase_date) : new Date();
      let expiry = body.expiry_date ? new Date(body.expiry_date) : null;
      const dm = Number(body.duration_months ?? body.durationMonths ?? 0);
      if (!expiry && dm > 0) expiry = addMonths(purchase, dm);

      const serialOne = String(body.serial || "").trim() || `SN${pad3(1)}`;

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
              customerAddress, // ✅ เพิ่ม: ที่อยู่ลูกค้า
              items: {
                create: [
                  {
                    productName: String(body.product_name || body.productName || "").trim(),
                    // ⬇️ เพิ่ม model ใน single-item payload
                    model: String(body.model || body.product_model || "").trim() || null,
                    serial: serialOne,
                    purchaseDate: purchase,
                    expiryDate: expiry,
                    durationMonths: dm || null,
                    durationDays: expiry ? daysBetween(purchase, expiry) : null,
                    coverageNote:
                      String(body.warranty_terms || body.coverageNote || "").trim() || null,
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
            (e.meta?.target?.includes?.("storeId_code") ||
              e.meta?.target?.includes?.("code"))
          ) {
            code = await allocateWarrantyCode(tx, storeId, { prefix: "WR" });
            continue;
          }
          if (e?.code === "P2002" && e.meta?.target?.includes?.("warrantyId_serial")) {
            throw Object.assign(new Error("Serial number duplicated within the warranty"), {
              status: 409,
            });
          }
          throw e;
        }
      }
      throw new Error("Failed to create warranty after retries");
    });

    // ✅ ตาม requirement ใหม่: ร้านไม่ต้องได้แจ้งเตือน "warranty_created"
    // ❌ ตัด notify store ออก แต่ "ลูกค้า" ยังได้เหมือนเดิม (ไม่กระทบลูกค้า)
    try {
      const title = `สร้างใบรับประกัน ${createdHeader.code || ""}`;
      const bodyText = `สร้างใบรับประกัน ${createdHeader.code || ""} จำนวน ${
        createdHeader.items?.length || 0
      } รายการ`;

      // notify customer user if linked (✅ keep)
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
      console.warn("notify warranty created failed", e?.message || e);
    }

    // ✅ AuditLog: CREATE_WARRANTY (best-effort)
    await auditCreateWarrantyBestEffort(req, storeId, createdHeader);

    return sendSuccess(
      res,
      {
        message: "สร้างใบรับประกันเรียบร้อย",
        warranty: mapWarrantyHeaderForResponse(createdHeader, notifyDays),
      },
      201
    );
  } catch (error) {
    if (error?.status) return sendError(res, error.status, error.message);
    if (error?.code === "P2002" && error.meta?.target?.includes?.("warrantyId_serial")) {
      return sendError(res, 409, "Serial ซ้ำภายในใบรับประกัน");
    }
    if (
      error?.code === "P2002" &&
      (error.meta?.target?.includes?.("storeId_code") || error.meta?.target?.includes?.("code"))
    ) {
      return sendError(res, 409, "รหัสใบรับประกันซ้ำ กรุณาลองใหม่");
    }
    console.error("createWarranty error", error);
    return sendError(res, 500, "ไม่สามารถสร้างใบรับประกันได้");
  }
}

/* =========================
 * Complaints (Store) (NEW)
 * ========================= */

// POST /store/:storeId/complaints
export async function createStoreComplaint(req, res) {
  const storeId = parseStoreId(req, res);
  if (storeId == null) return;

  try {
    const me = await prisma.user.findUnique({ where: { id: Number(storeId) } });
    if (!me || me.role !== "STORE") {
      return sendError(res, 404, "ไม่พบบัญชีร้านค้า");
    }

    const body = req.body ?? {};
    const category = trimOrNull(body.category);
    const subject = trimOrNull(body.subject);
    const message = trimOrNull(body.message);

    if (!subject) return sendError(res, 400, "กรุณากรอกหัวข้อ (subject)");
    if (!message) return sendError(res, 400, "กรุณากรอกรายละเอียด (message)");

    if (subject.length > 200) {
      return sendError(res, 400, "subject ยาวเกินไป (สูงสุด 200 ตัวอักษร)");
    }
    if (message.length > 5000) {
      return sendError(res, 400, "message ยาวเกินไป (สูงสุด 5000 ตัวอักษร)");
    }

    // ✅ รับไฟล์แนบจาก multer (field: images)
    const uploaded = [];
    const files = req.files;
    if (Array.isArray(files)) {
      uploaded.push(...files);
    } else if (files && typeof files === "object") {
      for (const v of Object.values(files)) {
        if (Array.isArray(v)) uploaded.push(...v);
      }
    }

    const imagePaths = uploaded
      .filter((f) => f && f.filename)
      .map((f) => `/uploads/complaints/${f.filename}`);

    let complaint;
    try {
      complaint = await prisma.complaint.create({
        data: {
          userId: me.id,
          category,
          subject,
          message,
          images: imagePaths,
        },
      });
    } catch (err) {
      // Fallback: ถ้า prisma client ยังไม่ได้ generate/migrate field images
      const msg = String(err?.message || "");
      if (
        msg.includes("images") ||
        msg.includes("Unknown argument") ||
        msg.includes("Invalid `prisma.complaint.create()` invocation")
      ) {
        complaint = await prisma.complaint.create({
          data: {
            userId: me.id,
            category,
            subject,
            message,
          },
        });
      } else {
        throw err;
      }
    }

    // ✅ คงไว้ตาม requirement: แจ้งเตือนตอนร้านส่งแจ้งปัญหา (complaint_created)
    try {
      await createNotification({
        prisma,
        attrs: {
          storeId: storeId,
          title: "ส่งคำแจ้งปัญหาแล้ว",
          body: `เราได้รับเรื่อง: ${complaint.subject}`,
          data: { type: "complaint_created", complaintId: complaint.id },
        },
      });
    } catch (e) {
      console.warn("notify complaint_created failed", e?.message || e);
    }

    return res.status(201).json({ message: "รับแจ้งปัญหาเรียบร้อย", complaint });
  } catch (error) {
    console.error("createStoreComplaint error", error);
    return sendError(res, 500, "ไม่สามารถส่งคำแจ้งปัญหาได้");
  }
}

// GET /store/:storeId/complaints
export async function listStoreComplaints(req, res) {
  const storeId = parseStoreId(req, res);
  if (storeId == null) return;

  try {
    // Explicitly select scalar fields (exclude `images`) to avoid DB errors
    // when the DB hasn't been migrated to include the `images` column.
    const complaints = await prisma.complaint.findMany({
      where: { userId: Number(storeId) },
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
      },
    });

    return res.json({ complaints });
  } catch (error) {
    console.error("listStoreComplaints error", error);
    return sendError(res, 500, "ไม่สามารถโหลดรายการแจ้งปัญหาได้");
  }
}
