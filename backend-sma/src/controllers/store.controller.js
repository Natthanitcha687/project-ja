// backend-sma/src/controllers/store.controller.js
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { createAndPublish as createNotification } from '../routes/notifications.routes.js'
import { sendNotificationEmail } from '../services/email.js'
import { sendError, sendSuccess } from "../utils/http.js";

const DEFAULT_NOTIFY_DAYS = 14;

/* ==================== Helpers ==================== */
const normalizeEmail = (e) => (e ? String(e).trim().toLowerCase() : null);

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
        images: Array.isArray(w.images) ? w.images : (w.images ? w.images : []),
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
    const notifyDays =
      store.storeProfile?.notifyDaysInAdvance ?? DEFAULT_NOTIFY_DAYS;

    const headers = await prisma.warranty.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { createdAt: "desc" } } },
    });

    const mapped = headers.map((h) =>
      mapWarrantyHeaderForResponse(h, notifyDays),
    );

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
      create: { ...updatable, userId: storeId, isConsent: existingProfile?.isConsent ?? true },
    });

    // Notify the store user about profile update
    try {
      await createNotification({ prisma, attrs: {
        storeId: storeId,
        title: 'อัปเดตโปรไฟล์ร้าน',
        body: 'ข้อมูลโปรไฟล์ร้านของคุณได้รับการอัปเดตแล้ว',
        data: { type: 'store_profile_updated' }
      } })
    } catch (e) {
      console.warn('notify store profile update failed', e?.message || e)
    }

    // Notify customers who have warranties with this store
    try {
      const warrs = await prisma.warranty.findMany({ where: { storeId }, select: { customerUserId: true, customerEmail: true } })
      const userIds = [...new Set((warrs || []).map(w => w.customerUserId).filter(Boolean))]
      const emails = [...new Set((warrs || []).filter(w => !w.customerUserId && w.customerEmail).map(w => w.customerEmail))]

      const title = `ข้อมูลร้านค้า ${nextProfile.storeName || 'ร้านค้า'} ถูกอัปเดต`
      const body = `ร้านค้าได้อัปเดตข้อมูลโปรไฟล์ โปรดตรวจสอบข้อมูลการรับประกันและข้อมูลผู้ติดต่อของคุณ`

      for (const uid of userIds) {
        try {
          await createNotification({ prisma, attrs: {
            userId: uid,
            title,
            body,
            data: { type: 'store_profile_updated', storeId }
          } })
        } catch (e) {
          console.warn('notify customer user failed', uid, e?.message || e)
        }
      }

      for (const em of emails) {
        try {
          // if there is a user account for this email, notify via in-app
          const u = await prisma.user.findFirst({ where: { email: em } })
          if (u) {
            try {
              await createNotification({ prisma, attrs: {
                userId: u.id,
                title,
                body,
                data: { type: 'store_profile_updated', storeId }
              } })
            } catch (e) { console.warn('notify customer by userId failed', e?.message || e) }
          } else {
            // send as email if no user account
            try {
              await sendNotificationEmail({ to: em, subject: title, text: body })
            } catch (e) { console.warn('send email to customer failed', em, e?.message || e) }
          }
        } catch (e) {
          console.warn('notify customer email handling failed', em, e?.message || e)
        }
      }
    } catch (e) {
      console.warn('notify customers for store profile update failed', e?.message || e)
    }

    // Notify customers who have warranties at this store (if any)
    try {
      const customers = await prisma.warranty.findMany({
        where: { storeId, customerUserId: { not: null } },
        distinct: ['customerUserId'],
        select: { customerUserId: true },
        take: 200,
      })
      for (const c of customers) {
        if (!c.customerUserId) continue
        try {
          await createNotification({ prisma, attrs: {
            userId: c.customerUserId,
            title: 'ข้อมูลร้านค้ามีการอัปเดต',
            body: `ร้าน "${nextProfile.storeName || 'ร้านค้า'}" ได้ปรับปรุงข้อมูล โปรดตรวจสอบ`,
            data: { type: 'store_profile_updated', storeId }
          } })
        } catch (e) { /* ignore per-user failures */ }
      }
    } catch (e) {
      console.warn('notify customers store profile update failed', e?.message || e)
    }

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
    await prisma.user.update({ where: { id: storeId }, data: { passwordHash: newHash } });

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
    const storeProfile = await prisma.storeProfile.findUnique({ where: { userId: storeId } });
    const notifyDays = storeProfile?.notifyDaysInAdvance ?? DEFAULT_NOTIFY_DAYS;

    const createdHeader = await prisma.$transaction(async (tx) => {
      let code = await allocateWarrantyCode(tx, storeId, { prefix: "WR" });

      // helper ระบุ email/user/name/phone จากอีเมล
      async function resolveCustomer(rawEmail, nameFromPayload, phoneFromPayload) {
        const normEmail = normalizeEmail(rawEmail);
        if (!normEmail) {
          return { email: null, userId: null, name: nameFromPayload ?? null, phone: phoneFromPayload ?? null };
        }

        // หา user แบบไม่สน case และต้องเป็น CUSTOMER
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

      // ===== payload หลายรายการ =====
      if (Array.isArray(body.items) && body.items.length > 0) {
        const first = body.items[0] || {};
        const { email, userId, name, phone } = await resolveCustomer(
          first.customer_email ?? first.customerEmail,
          first.customer_name ?? first.customerName,
          first.customer_phone ?? first.customerPhone
        );

        const usedSerial = new Set(); let seq = 1;
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
            if (e?.code === "P2002" && (e.meta?.target?.includes?.("storeId_code") || e.meta?.target?.includes?.("code"))) {
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

      // ===== payload เดิม (รายการเดียว) =====
      const { email, userId, name, phone } = await resolveCustomer(
        body.customer_email ?? body.customerEmail,
        body.customer_name ?? body.customerName,
        body.customer_phone ?? body.customerPhone
      );

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
              items: {
                create: [{
                  productName: String(body.product_name || body.productName || "").trim(),
                  // ⬇️ เพิ่ม model ใน single-item payload
                  model: String(body.model || body.product_model || "").trim() || null,
                  serial: serialOne,
                  purchaseDate: purchase,
                  expiryDate: expiry,
                  durationMonths: dm || null,
                  durationDays: expiry ? daysBetween(purchase, expiry) : null,
                  coverageNote: String(body.warranty_terms || body.coverageNote || "").trim() || null,
                  note: String(body.note || "").trim() || null,
                  images: [],
                }],
              },
            },
            include: { items: true },
          });
        } catch (e) {
          if (e?.code === "P2002" && (e.meta?.target?.includes?.("storeId_code") || e.meta?.target?.includes?.("code"))) {
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

    // create in-app notification for store (and customer if linked)
    try {
      const title = `สร้างใบรับประกัน ${createdHeader.code || ''}`
      const body = `สร้างใบรับประกัน ${createdHeader.code || ''} จำนวน ${createdHeader.items?.length || 0} รายการ`;
      await createNotification({ prisma, attrs: {
        storeId,
        title,
        body,
        data: { type: 'warranty_created', warrantyId: createdHeader.id }
      } })

      // notify customer user if linked
      if (createdHeader.customerUserId) {
        await createNotification({ prisma, attrs: {
          userId: createdHeader.customerUserId,
          title,
          body,
          data: { type: 'warranty_created', warrantyId: createdHeader.id }
        } })
      }
    } catch (e) { console.warn('notify warranty created failed', e?.message || e) }

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
    if (error?.code === "P2002" && (error.meta?.target?.includes?.("storeId_code") || error.meta?.target?.includes?.("code"))) {
      return sendError(res, 409, "รหัสใบรับประกันซ้ำ กรุณาลองใหม่");
    }
    console.error("createWarranty error", error);
    return sendError(res, 500, "ไม่สามารถสร้างใบรับประกันได้");
  }
}
