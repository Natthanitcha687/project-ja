import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { prisma } from "../db/prisma.js";
import { sendError, sendSuccess } from "../utils/http.js";
import { createAndPublish as createNotification } from "../routes/notifications.routes.js";
import { sendMail } from "../config/mail.js";

// ✅ NEW: ใช้เทมเพลต PDF หน้าใหม่ (ข้อ 1)
import { drawWarrantyCardPage } from "../pdf/warrantyCardTemplate_figma.js";

const DEFAULT_NOTIFY_DAYS = 14;

function currentStoreId(req) {
  const id = Number(req.user?.sub);
  return Number.isInteger(id) ? id : null;
}

// ✅ ทำ meta ให้เป็น JSON-safe (กัน Prisma Json ไม่รับ Date/Object พิเศษ)
function jsonSafe(v) {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return null;
  }
}

// ✅ best-effort audit log ตอนอัปเดตข้อมูลระดับ “ใบ” (ห้ามทำให้ระบบพัง)
async function auditUpdateWarrantyHeaderBestEffort(req, beforeHeader, afterHeader) {
  try {
    const actorUserId = Number(req.user?.id ?? req.user?.sub);
    const actorOk = Number.isInteger(actorUserId) ? actorUserId : null;

    const customerUserId = afterHeader?.customerUserId ?? null;
    const customerEmail = afterHeader?.customerEmail ?? null;

    const targetType = customerUserId ? "User" : customerEmail ? "CustomerEmail" : null;

    const targetId = customerUserId
      ? String(customerUserId)
      : customerEmail
        ? String(customerEmail)
        : null;

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

    const userAgent =
      (typeof req.get === "function" ? req.get("user-agent") : null) || null;

    await prisma.auditLog.create({
      data: {
        actorUserId: actorOk,
        action: "UPDATE_WARRANTY_HEADER",
        targetType,
        targetId,
        ip,
        userAgent,
        meta: {
          result: "SUCCESS",
          storeId: afterHeader?.storeId ?? null,
          warrantyId: afterHeader?.id ?? null,
          warrantyCode: afterHeader?.code ?? null,
          customerUserId,
          customerEmail,
          before: jsonSafe(beforeHeader),
          after: jsonSafe(afterHeader),
        },
      },
    });
  } catch (e) {
    console.warn("audit UPDATE_WARRANTY_HEADER failed (ignored):", e?.message || e);
  }
}

// ---------- UTC-safe helpers ----------
function dateOnlyUTC(v) {
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function daysBetween(a, b) {
  const A = dateOnlyUTC(a);
  const B = dateOnlyUTC(b);
  if (!A || !B) return 0;
  return Math.ceil((B.getTime() - A.getTime()) / (24 * 3600 * 1000));
}

function statusForItem(item, notifyDays) {
  const today = dateOnlyUTC(new Date());
  const exp = item.expiryDate ? dateOnlyUTC(item.expiryDate) : null;

  let statusCode = "active";
  let statusTag = "ใช้งานได้";
  if (exp) {
    const remain = daysBetween(today, exp);
    if (remain < 0) {
      statusCode = "expired";
      statusTag = "หมดอายุ";
    } else if (remain <= (notifyDays ?? DEFAULT_NOTIFY_DAYS)) {
      statusCode = "nearing_expiration";
      statusTag = "ใกล้หมดอายุ";
    }
  }
  return { statusCode, statusTag, daysLeft: exp ? daysBetween(today, exp) : null };
}

/**
 * GET /warranties/:warrantyId/pdf
 * GET /customer/warranties/:warrantyId/pdf
 * สร้าง PDF ระดับ “ใบ” (หน้า/รายการ)
 */
export async function downloadWarrantyPdf(req, res) {
  try {
    const role = req.user?.role;
    if (!role) return sendError(res, 401, "ต้องเข้าสู่ระบบก่อน");

    const warrantyId = String(req.params.warrantyId);

    const header = await prisma.warranty.findUnique({
      where: { id: warrantyId },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        store: { include: { storeProfile: true } },
      },
    });
    if (!header) return sendError(res, 404, "ไม่พบใบรับประกัน");

    // ตรวจสิทธิ์
    if (role === "STORE") {
      const storeId = currentStoreId(req);
      if (storeId == null || header.storeId !== storeId) {
        return sendError(res, 404, "ไม่พบใบรับประกัน");
      }
    } else if (role === "CUSTOMER") {
      const isOwner =
        header.customerUserId === req.user.id ||
        (header.customerEmail && header.customerEmail === req.user.email);
      if (!isOwner) return sendError(res, 403, "Forbidden");
    } else {
      return sendError(res, 403, "Forbidden");
    }

    const profile = header.store?.storeProfile;

    // ==== สร้าง PDF (Buffer) เพื่อหา Content-Length สำหรับ Safari ====
    const chunks = [];
    const doc = new PDFDocument({ autoFirstPage: false });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      const result = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="warranty-${header.code || header.id}.pdf"`
      );
      res.setHeader("Content-Length", result.length); // ✅ Critical for Safari
      res.send(result);
    });

    const mm = (v) => v * 2.83464567;
    const T = (v, f = "-") =>
      v === undefined || v === null || String(v).trim() === "" ? f : String(v);

    const fontCandidatesRegular = [
      process.env.THAI_FONT_REGULAR,
      path.resolve(process.cwd(), "src/assets/fonts/Sarabun-Regular.ttf"),
      path.resolve(process.cwd(), "src/assets/fonts/NotoSansThai-Regular.ttf"),
    ].filter(Boolean);

    const fontCandidatesBold = [
      process.env.THAI_FONT_BOLD,
      path.resolve(process.cwd(), "src/assets/fonts/Sarabun-Bold.ttf"),
      path.resolve(process.cwd(), "src/assets/fonts/NotoSansThai-Bold.ttf"),
    ].filter(Boolean);

    function firstExistingFile(paths) {
      for (const p of paths) {
        try {
          if (p && fs.existsSync(p)) return p;
        } catch { }
      }
      return null;
    }

    // --- address formatter (ทำให้เป็นภาษาไทย ไม่โชว์ JSON) ---
    function safeJsonParseMaybe(v) {
      if (v == null) return null;
      if (typeof v === "object") return v;
      const s = String(v).trim();
      if (!s) return null;
      if (!(s.startsWith("{") || s.startsWith("["))) return null;
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    }

    // prefer the shared formatter in src/pdf/warrantyTemplate_v2 when available
    let formatThaiAddress = async function (addr) {
      if (!addr) return "-";
      const obj = safeJsonParseMaybe(addr);
      if (!obj) return String(addr).trim() || "-";
      const street = (obj.street || obj.address || obj.line1 || obj.line || obj.address_line || "").toString().trim();
      const subdistrict = (obj.subdistrict || obj.subDistrict || obj.tambon || obj.subdistrict_id || obj.subdistrictId || obj.subdistrictCode || obj.subdistrict_code || "").toString().trim();
      const district = (obj.district || obj.amphoe || obj.district_id || obj.districtId || obj.district_code || "").toString().trim();
      const province = (obj.province || obj.state || obj.province_id || obj.provinceId || obj.province_code || obj.provinceCode || "").toString().trim();
      const postcode = (obj.postcode || obj.zip || obj.zipcode || obj.postalCode || obj.postal_code || "").toString().trim();

      // best-effort: if numeric ids present, try resolve via frontend json files
      try {
        const mapsModulePath = path.resolve(process.cwd(), "src/pdf/warrantyTemplate_v2.js");
        if (fs.existsSync(mapsModulePath)) {
          const w2 = await import(pathToFileURL(mapsModulePath).href);
          if (w2 && typeof w2.formatThaiAddress === "function") {
            return w2.formatThaiAddress(addr);
          }
        }
      } catch (e) {
        // fallback to simple formatting below
      }

      const isBkk = province.includes("กรุงเทพ") || province.toLowerCase().includes("bangkok");

      const parts = [];
      if (street) parts.push(street);
      if (subdistrict) parts.push(isBkk ? `แขวง${subdistrict}` : `ตำบล${subdistrict}`);
      if (district) parts.push(isBkk ? `เขต${district}` : `อำเภอ${district}`);
      if (province) parts.push(isBkk ? province : `จังหวัด${province}`);
      if (postcode) parts.push(postcode);

      const out = parts.join(" ").replace(/\s+/g, " ").trim();
      return out || "-";
    };

    // --- logo helper ---
    const logoCandidates = [
      process.env.PDF_APP_LOGO,
      path.resolve(process.cwd(), "src/assets/logo.png"),
      path.resolve(process.cwd(), "../frontend-sma/public/home-assets/logo.png"),
      path.resolve(process.cwd(), "src/assets/app-logo.png"),
      path.resolve(process.cwd(), "src/assets/images/logo.png"),
      path.resolve(process.cwd(), "src/assets/logo/logo.png"),
    ].filter(Boolean);

    const logoPath = firstExistingFile(logoCandidates);

    // NOTE: doc created above (buffered)

    const regPath = firstExistingFile(fontCandidatesRegular);
    const boldPath = firstExistingFile(fontCandidatesBold);
    if (!regPath || !/\.ttf$/i.test(regPath)) {
      return sendError(
        res,
        500,
        "THAI_FONT_NOT_FOUND: กรุณาวาง Sarabun-Regular.ttf (หรือ NotoSansThai-Regular.ttf) ไว้ที่ src/assets/fonts/"
      );
    }
    try {
      doc.registerFont("THAI", fs.readFileSync(regPath));
      if (boldPath && /\.ttf$/i.test(boldPath)) {
        doc.registerFont("THAI_BOLD", fs.readFileSync(boldPath));
      }
      doc.font("THAI");
    } catch (e) {
      console.error("Font load error:", e);
      return sendError(res, 500, "Unknown font format: โปรดใช้ไฟล์ TTF แบบ static");
    }

    // doc.pipe(res); // ❌ REMOVE for buffering

    // -------------------------------
    // (เดิม) ฟังก์ชันวาดตาราง/โลโก้/ช่องต่าง ๆ ยังอยู่ (ไม่ได้ลบ)
    // แต่จากนี้จะ “ใช้เทมเพลตใหม่” แทน เพื่อให้เหมือนรูป Figma มากที่สุด
    // -------------------------------

    // ✅ ที่อยู่ร้าน (ใช้ในส่วนข้อมูลบริษัท/ร้าน)
    const storeAddressThai = await formatThaiAddress(
      profile?.address || profile?.addressText || profile?.storeAddress
    );

    // ✅ ที่อยู่ลูกค้า (ใช้ในช่อง "ที่อยู่" ของใบรับประกัน)
    const customerAddressThai = await formatThaiAddress(header.customerAddress);

    const base = {
      // cardNo ไม่จำเป็นต้องโชว์ในดีไซน์ใหม่ (แต่ยังเก็บไว้ได้)
      cardNo: header.code || header.id,
      customerName: header.customerName || "-",
      customerTel: header.customerPhone || "-",
      address: customerAddressThai || "-", // ✅ ที่อยู่ลูกค้า
      dealerName: profile?.storeName || "-",
      footerNote: "โปรดนำใบรับประกันฉบับนี้มาแสดงเป็นหลักฐานทุกครั้งเมื่อใช้บริการ",
      company: {
        name: profile?.storeName || "แอปของเรา",
        email: header.store?.email || "", // ✅ เพิ่มให้ตรงดีไซน์ (ถ้ามี)
        address: storeAddressThai || "", // ✅ ที่อยู่ร้าน
        tel: profile?.phone || "",
      },
    };

    const items =
      (header.items || []).length
        ? header.items.map((it) => ({
          productName: it.productName || "-",
          model: it.model || "-",
          serialNumber: it.serial || "-",
          serial: it.serial || "-", // เผื่อเรียกชื่อ field แบบอื่น
          purchaseDate: it.purchaseDate || header.createdAt,
          expiryDate: it.expiryDate || null,
          coverageNote: it.coverageNote || null,
          // ✅ สำหรับ checkbox เงื่อนไข (ใช้ใน PDF template)
          selectedConditions: Array.isArray(it.selectedConditions) ? it.selectedConditions : [],
          customCondition: it.customCondition || null,
        }))
        : [
          {
            productName: "-",
            model: "-",
            serialNumber: "-",
            serial: "-",
            purchaseDate: header.createdAt,
            expiryDate: null,
            coverageNote: null,
          },
        ];

    // ✅ ใช้เทมเพลตใหม่ (ข้อ 1) เพื่อให้หน้า PDF เหมือนรูปมากที่สุด
    for (const it of items) {
      drawWarrantyCardPage(doc, base, it, {
        header: {
          // ค่า default ใน template ตรงกับรูปอยู่แล้ว (จะไม่ใส่ก็ได้)
          titleTH: "ใบรับประกันสินค้า",
          titleEN: "Warranty Card",
          rightTH: "สำหรับลูกค้า",
          rightEN: "For Customer",
        },
        exclusions: [
          "ความเสียหายจากน้ำ ของเหลว หรือความชื้น",
          "ความเสียหายจากการตกหล่น กระแทก หรืออุบัติเหตุ",
          "การแกะ ดัดแปลง หรือซ่อมแซมโดยบุคคลที่ไม่ได้รับอนุญาต",
          "ความเสียหายจากการใช้งานผิดวิธี",
        ],
      });
    }

    doc.end();
  } catch (error) {
    console.error("downloadWarrantyPdf error", error);
    if (!res.headersSent) {
      return sendError(res, 500, "ไม่สามารถสร้างไฟล์ PDF ได้");
    }
  }
}

/** อ่านรายละเอียดใบแบบ JSON */
export async function getWarrantyHeader(req, res) {
  const storeId = currentStoreId(req);
  if (storeId == null) {
    return sendError(res, 401, "ต้องเข้าสู่ระบบร้านค้าก่อน");
  }

  try {
    const warrantyId = String(req.params.warrantyId);
    const header = await prisma.warranty.findUnique({
      where: { id: warrantyId },
      include: { items: true },
    });
    if (!header || header.storeId !== storeId) {
      return sendError(res, 404, "ไม่พบใบรับประกัน");
    }
    return sendSuccess(res, { warranty: header });
  } catch (e) {
    console.error("getWarrantyHeader error", e);
    return sendError(res, 500, "โหลดข้อมูลใบรับประกันไม่สำเร็จ");
  }
}

/**
 * PATCH /warranties/:warrantyId
 * แก้ไขข้อมูลระดับ “ใบ” (เช่น อีเมลลูกค้า) และผูกกับ user ถ้ามีอีเมลตรงกัน
 */
export async function updateWarrantyHeader(req, res) {
  const storeId = currentStoreId(req);
  if (storeId == null) {
    return sendError(res, 401, "ต้องเข้าสู่ระบบร้านค้าก่อน");
  }

  try {
    const warrantyId = String(req.params.warrantyId);
    const header = await prisma.warranty.findUnique({ where: { id: warrantyId } });
    if (!header || header.storeId !== storeId) {
      return sendError(res, 404, "ไม่พบใบรับประกัน");
    }

    // ✅ เก็บ before snapshot (รวม items) เพื่อทำ before/after ใน Activity Logs
    const beforeSnap = await prisma.warranty.findUnique({
      where: { id: warrantyId },
      include: { items: true },
    });

    const body = req.body || {};

    const normEmail = body.customerEmail ? String(body.customerEmail).trim().toLowerCase() : null;

    const inputPhone =
      body.customerPhone != null && String(body.customerPhone).trim() !== ""
        ? String(body.customerPhone).trim()
        : null;

    let inputName = null;
    if (body.customerName != null && String(body.customerName).trim() !== "") {
      inputName = String(body.customerName).trim();
    } else if (body.customerFirstName != null || body.customerLastName != null) {
      const fn = (body.customerFirstName != null ? String(body.customerFirstName) : "").trim();
      const ln = (body.customerLastName != null ? String(body.customerLastName) : "").trim();
      const nm = `${fn} ${ln}`.trim();
      inputName = nm || null;
    }

    let customerUserId = header.customerUserId;
    let customerName = inputName ?? header.customerName;
    let customerPhone = inputPhone ?? header.customerPhone;

    // เปลี่ยนอีเมล → ผูกกับบัญชีลูกค้าโดยอัตโนมัติถ้ามี (✅ case-insensitive + เฉพาะ CUSTOMER)
    if (normEmail) {
      const user = await prisma.user.findFirst({
        where: { email: { equals: normEmail, mode: "insensitive" }, role: "CUSTOMER" },
        select: { id: true },
      });

      if (user) {
        customerUserId = user.id;

        // ถ้าไม่ได้ส่งชื่อ/เบอร์มาเอง → เติมจาก CustomerProfile (คงเจตนาเดิม)
        const cp = await prisma.customerProfile.findUnique({
          where: { userId: user.id },
          select: { firstName: true, lastName: true, phone: true },
        });

        if (!inputName) {
          const nm = `${(cp?.firstName || "").trim()} ${(cp?.lastName || "").trim()}`.trim();
          if (nm) customerName = nm;
        }
        if (!inputPhone && cp?.phone) {
          customerPhone = cp.phone;
        }
      } else {
        customerUserId = null;
      }
    }

    const updated = await prisma.warranty.update({
      where: { id: warrantyId },
      data: {
        customerEmail: normEmail ?? header.customerEmail,
        customerUserId,
        customerName,
        customerPhone,
      },
      include: { items: true },
    });

    // if header fields changed, create in-app notifications (✅ keep customer only; remove store notify)
    let changed = false;
    try {
      changed =
        header.customerEmail !== updated.customerEmail ||
        header.customerUserId !== updated.customerUserId ||
        header.customerName !== updated.customerName ||
        header.customerPhone !== updated.customerPhone;

      if (changed) {
        const codeLabel = updated.code ? `#${updated.code}` : "ของคุณ";
        const title = `[แก้ไขข้อมูล] ใบรับประกัน ${codeLabel}`;
        const bodyText =
          "รายละเอียดใบรับประกันของคุณได้รับการอัปเดตเรียบร้อยแล้ว สามารถตรวจสอบข้อมูลล่าสุดได้ในระบบ";

        // ✅ ตาม requirement ใหม่: "ร้าน" ไม่ต้องได้รับแจ้งเตือนประเภทนี้อีก
        // (คงไว้เฉพาะ expiry_daily_summary และ complaint_created ที่อื่น)
        // ❌ remove store notification:
        // await createNotification({ prisma, attrs: { storeId: updated.storeId, ... } })

        // ✅ ลูกค้ายังต้องได้แจ้งเตือน (ไม่กระทบลูกค้า) + ส่งเมลเหมือนเดิม
        if (updated.customerUserId) {
          await createNotification({
            prisma,
            attrs: {
              userId: updated.customerUserId,
              title,
              body: bodyText,
              data: { type: "warranty_header_updated", warrantyId: updated.id },
              sendEmail: true,
            },
          });
        }
      }
    } catch (e) {
      console.warn("notify warranty header update failed", e?.message || e);
    }

    // ✅ AuditLog: UPDATE_WARRANTY_HEADER (best-effort) เฉพาะตอนมีการเปลี่ยนจริง
    if (changed) {
      await auditUpdateWarrantyHeaderBestEffort(req, beforeSnap || header, updated);
    }

    return sendSuccess(res, { warranty: updated });
  } catch (e) {
    console.error("updateWarrantyHeader error", e);
    return sendError(res, 500, "ไม่สามารถแก้ไขข้อมูลใบได้");
  }
}

/**
 * DELETE /warranties/:warrantyId
 * ลบใบรับประกัน (รวมทั้งรายการภายใน) สำหรับร้านเจ้าของเท่านั้น
 */
export async function deleteWarrantyHeader(req, res) {
  const storeId = currentStoreId(req);
  if (storeId == null) {
    return sendError(res, 401, "ต้องเข้าสู่ระบบร้านค้าก่อน");
  }

  try {
    const warrantyId = String(req.params.warrantyId);

    const header = await prisma.warranty.findUnique({
      where: { id: warrantyId },
      include: {
        items: { orderBy: { createdAt: "asc" }, take: 1 },
        store: { include: { storeProfile: true } },
      },
    });
    if (!header || header.storeId !== storeId) {
      return sendError(res, 404, "ไม่พบใบรับประกัน");
    }

    const code = header.code || "";
    const customerEmail = header.customerEmail || null;
    const customerName = header.customerName || "ลูกค้า";

    const storeName =
      header.store?.storeProfile?.storeName ||
      header.store?.name ||
      "ร้านของเรา";

    const storePhone =
      header.store?.storeProfile?.phone ||
      header.store?.phone ||
      "-";

    const firstProductName =
      (Array.isArray(header.items) && header.items[0]?.productName) ||
      "สินค้า";

    // หา userId ฝั่งลูกค้าจาก customerUserId หรือ email (กรณีเดิมยังไม่ผูก)
    let customerUserIdForNotify = header.customerUserId || null;
    if (!customerUserIdForNotify && customerEmail) {
      try {
        const foundUser = await prisma.user.findFirst({
          where: {
            email: { equals: String(customerEmail).trim(), mode: "insensitive" },
          },
          select: { id: true },
        });
        if (foundUser) {
          customerUserIdForNotify = foundUser.id;
        }
      } catch (lookupErr) {
        console.warn(
          "deleteWarrantyHeader: lookup customer by email failed (ignored)",
          lookupErr?.message || lookupErr
        );
      }
    }
    console.log("Customer ID for Notify:", customerUserIdForNotify);

    // In-app notification ฝั่งร้านค้า + ลูกค้า (กระดิ่ง)
    try {
      // ฝั่งร้านค้า
      await createNotification({
        prisma,
        attrs: {
          storeId: header.storeId,
          title: code
            ? `ลบใบรับประกันรหัส ${code} เรียบร้อยแล้ว`
            : "ลบใบรับประกันเรียบร้อยแล้ว",
          body: `ได้ทำการลบใบรับประกันรหัส ${code || "-"} ของคุณ ${
            customerName || ""
          } เรียบร้อยแล้ว`,
          // ไม่ผูก warrantyId กับแจ้งเตือน เพื่อกันปัญหาอ้างอิงใบรับประกันที่ถูกลบแล้ว
          data: { type: "warranty_deleted" },
          sendEmail: false,
        },
      });

      // ฝั่งลูกค้า (In-app notification กระดิ่ง)
      if (customerUserIdForNotify) {
        const customerTitle = `[แจ้งยกเลิก] ใบรับประกันรหัส ${code || "-"} ถูกลบออกจากระบบ`;
        const customerBody = `ใบรับประกันสินค้า ${firstProductName} ของคุณได้ถูกยกเลิกโดยร้านค้า ${storeName} เรียบร้อยแล้ว หากมีข้อสงสัยโปรดติดต่อร้านค้าโดยตรง`;

        await createNotification({
          prisma,
          attrs: {
            userId: customerUserIdForNotify,
            title: customerTitle,
            body: customerBody,
            // ไม่ผูก warrantyId เพื่อหลีกเลี่ยงปัญหากับใบรับประกันที่ถูกลบไปแล้ว
            data: { type: "warranty_deleted" },
            sendEmail: false,
          },
        });
      }
    } catch (e) {
      console.warn(
        "deleteWarrantyHeader: store/customer notification failed (ignored)",
        e?.message || e
      );
    }

    // ส่งอีเมลแจ้งลูกค้า (ใช้ email โดยตรง แม้ไม่มี customerUserId)
    if (customerEmail) {
      const subject = code
        ? `แจ้งยกเลิกใบรับประกันสินค้า รหัส ${code}`
        : "แจ้งยกเลิกใบรับประกันสินค้า";

      const safeName = customerName || "ลูกค้า";

      const baseFrontend =
        process.env.FRONTEND_URL ||
        process.env.CLIENT_URL ||
        "http://localhost:5173";
      const trimmedBase = baseFrontend.replace(/\/+$/, "");
      const customerWarrantiesUrl = `${trimmedBase}/customer/warranties`;

      const html = `
        <div style="font-family: system-ui, Arial, sans-serif; background:#f3f4f6; padding:24px;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px 28px;border:1px solid #e5e7eb;">
            <h2 style="margin:0 0 12px 0;font-size:20px;color:#111827;">แจ้งยกเลิกใบรับประกันสินค้า</h2>
            <p style="margin:0 0 8px 0;">เรียนคุณ ${safeName},</p>
            <p style="margin:0 0 12px 0;">
              ทางร้าน <b>${storeName}</b> ขอแจ้งให้ทราบว่า ใบรับประกันสินค้ารหัส
              <b>${code || "-"}</b>
              (รายการสินค้า: <b>${firstProductName}</b>) ของท่าน ได้ถูกยกเลิกออกจากระบบเรียบร้อยแล้ว
            </p>
            <p style="margin:0 0 20px 0;">คุณยังสามารถเข้าสู่ระบบเพื่อตรวจสอบสถานะการรับประกันอื่น ๆ ได้ที่ปุ่มด้านล่าง</p>

            <div style="text-align:center;margin:24px 0;">
              <a href="${customerWarrantiesUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:600;">
                ตรวจสอบสถานะการรับประกัน
              </a>
            </div>

            <p style="margin:0 0 12px 0;font-size:12px;color:#6b7280;">
              ถ้าปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br />
              <a href="${customerWarrantiesUrl}" style="color:#2563eb;">${customerWarrantiesUrl}</a>
            </p>

            <p style="margin:16px 0 0 0;">หากมีข้อสงสัยเพิ่มเติมสามารถติดต่อทางร้าน <b>${storeName}</b> (เบอร์ติดต่อ: <b>${storePhone}</b>)</p>
          </div>
        </div>
      `;

      try {
        await sendMail({
          to: customerEmail,
          subject,
          html,
          text: `เรียนคุณ ${safeName}, ทางร้าน ${storeName} ขอแจ้งให้ทราบว่า ใบรับประกันสินค้ารหัส ${
            code || "-"
          } (รายการสินค้า: ${firstProductName}) ของท่าน ได้ถูกยกเลิกออกจากระบบแล้ว สามารถตรวจสอบสถานะการรับประกันได้ที่ ${customerWarrantiesUrl}`,
        });
      } catch (e) {
        console.warn("deleteWarrantyHeader: sendMail to customer failed (ignored)", e?.message || e);
      }
    }

    await prisma.warranty.delete({ where: { id: warrantyId } });

    return sendSuccess(res, { ok: true });
  } catch (e) {
    console.error("deleteWarrantyHeader error", e);
    return sendError(res, 500, "ลบใบรับประกันไม่สำเร็จ");
  }
}

