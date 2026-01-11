import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { prisma } from "../db/prisma.js";
import { sendError, sendSuccess } from "../utils/http.js";
import { createAndPublish as createNotification } from "../routes/notifications.routes.js";

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

    const userAgent = (typeof req.get === "function" ? req.get("user-agent") : null) || null;

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

    // HTTP headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="warranty-${header.code || header.id}.pdf"`
    );

    // ==== สร้าง PDF ====
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
        } catch {}
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

    function formatThaiAddress(addr) {
      if (!addr) return "-";

      const obj = safeJsonParseMaybe(addr);
      if (!obj) {
        return String(addr).trim() || "-";
      }

      const street = (obj.street || obj.address || obj.line1 || "").toString().trim();
      const subdistrict = (obj.subdistrict || obj.subDistrict || obj.tambon || "").toString().trim();
      const district = (obj.district || obj.amphoe || "").toString().trim();
      const province = (obj.province || obj.state || "").toString().trim();
      const postcode = (obj.postcode || obj.zip || obj.postalCode || "").toString().trim();

      const isBkk = province.includes("กรุงเทพ") || province.toLowerCase().includes("bangkok");

      const parts = [];
      if (street) parts.push(street);
      if (subdistrict) parts.push(isBkk ? `แขวง${subdistrict}` : `ตำบล${subdistrict}`);
      if (district) parts.push(isBkk ? `เขต${district}` : `อำเภอ${district}`);
      if (province) parts.push(isBkk ? province : `จังหวัด${province}`);
      if (postcode) parts.push(postcode);

      const out = parts.join(" ").replace(/\s+/g, " ").trim();
      return out || "-";
    }

    // --- logo helper ---
    const logoCandidates = [
      process.env.PDF_APP_LOGO,
      path.resolve(process.cwd(), "src/assets/logo.png"),
      path.resolve(process.cwd(), "src/assets/app-logo.png"),
      path.resolve(process.cwd(), "src/assets/images/logo.png"),
      path.resolve(process.cwd(), "src/assets/logo/logo.png"),
    ].filter(Boolean);

    const logoPath = firstExistingFile(logoCandidates);

    const doc = new PDFDocument({ autoFirstPage: false });

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

    doc.pipe(res);

    function headerTitle(left, top, width) {
      doc
        .font(boldPath ? "THAI_BOLD" : "THAI")
        .fontSize(18)
        .fillColor("#000")
        .text("ใบรับประกัน", left, top, { width: width / 2, align: "left" });

      doc
        .font("THAI")
        .fontSize(14)
        .fillColor("#000")
        .text("WARRANTY", left, top + mm(8), { width: width / 2, align: "left" });

      doc
        .font("THAI")
        .fontSize(12)
        .fillColor("#000")
        .text("สำหรับผู้ซื้อ", left + width / 2, top, {
          width: width / 2,
          align: "right",
        });
    }

    function drawCellBilingual(x, y, w, h, thLabel, enLabel, value, opts = {}) {
      const pad = opts.pad ?? mm(3.5);
      const valueY = opts.valueY ?? (y + pad + mm(11));

      doc.lineWidth(1).rect(x, y, w, h).stroke();

      doc.font("THAI").fontSize(10).fillColor("#000").text(thLabel, x + pad, y + pad, {
        width: w - pad * 2,
      });

      doc.font("THAI").fontSize(9).fillColor("#555").text(enLabel, x + pad, y + pad + mm(5), {
        width: w - pad * 2,
      });

      doc.font("THAI").fontSize(11).fillColor("#000").text(T(value), x + pad, valueY, {
        width: w - pad * 2,
        height: h - (valueY - y) - pad,
      });
    }

    function drawCellFullWidth(x, y, w, h, thLabel, enLabel, value) {
      const pad = mm(3.5);
      doc.lineWidth(1).rect(x, y, w, h).stroke();

      doc.font("THAI").fontSize(10).fillColor("#000").text(thLabel, x + pad, y + pad);
      doc.font("THAI").fontSize(9).fillColor("#555").text(enLabel, x + pad, y + pad + mm(5));

      doc.font("THAI").fontSize(11).fillColor("#000").text(T(value), x + pad, y + pad + mm(11), {
        width: w - pad * 2,
        height: h - pad * 2 - mm(11),
      });
    }

    function drawBottomBrandArea(left, bottomY, width, company, footerNote) {
      // ข้อความหมายเหตุ
      doc.font("THAI").fontSize(11).fillColor("#000").text(
        T(footerNote, "โปรดนำใบรับประกันฉบับนี้มาแสดงเป็นหลักฐานทุกครั้งเมื่อใช้บริการ"),
        left,
        bottomY,
        { width, align: "left" }
      );

      const brandY = bottomY + mm(14);
      const logoSize = mm(14);

      const logoX = left;
      const logoY = brandY;

      if (logoPath) {
        try {
          const buf = fs.readFileSync(logoPath);
          doc.image(buf, logoX, logoY, { fit: [logoSize, logoSize] });
        } catch {
          doc.save();
          doc.fillColor("#E11D48").rect(logoX, logoY, logoSize, logoSize).fill();
          doc.fillColor("#fff")
            .font(boldPath ? "THAI_BOLD" : "THAI")
            .fontSize(10)
            .text("APP", logoX, logoY + mm(4), { width: logoSize, align: "center" });
          doc.restore();
        }
      } else {
        doc.save();
        doc.fillColor("#E11D48").rect(logoX, logoY, logoSize, logoSize).fill();
        doc.fillColor("#fff")
          .font(boldPath ? "THAI_BOLD" : "THAI")
          .fontSize(10)
          .text("APP", logoX, logoY + mm(4), { width: logoSize, align: "center" });
        doc.restore();
      }

      const infoX = logoX + logoSize + mm(6);
      const lines = [
        T(company?.name, ""),
        T(company?.address, ""),
        company?.tel ? `โทร. ${company.tel}` : "",
      ].filter(Boolean);

      doc.font("THAI").fontSize(10).fillColor("#000").text(lines.join("\n"), infoX, logoY, {
        width: width - (infoX - left),
      });
    }

    function drawWarrantyPage(base, item) {
      // ✅ A3 แนวนอน: 420 x 297 mm
      doc.addPage({
        size: [mm(420), mm(297)],
        margins: { top: mm(12), left: mm(12), right: mm(12), bottom: mm(12) },
      });

      const pageW = mm(420);
      const pageH = mm(297);
      const left = mm(12);
      const top = mm(12);
      const width = pageW - mm(12) * 2;

      headerTitle(left, top, width);

      // ตารางแบบ “รูปที่ 1”
      const tableTop = top + mm(22);
      const tableW = width;

      const colL = Math.round(tableW * 0.55);
      const colR = tableW - colL;

      const row1 = mm(22); // เลขที่ / สินค้า
      const row2 = mm(22); // รุ่น / หมายเลขเครื่อง
      const row3 = mm(24); // ชื่อ-นามสกุล / โทรศัพท์
      const row4 = mm(28); // ที่อยู่ (เต็มแถว)
      const row5 = mm(22); // ผู้จำหน่าย / วันที่ซื้อ
      const tableH = row1 + row2 + row3 + row4 + row5;

      doc.lineWidth(1).rect(left, tableTop, tableW, tableH).stroke();

      let y = tableTop;

      // Row 1
      drawCellBilingual(left, y, colL, row1, "เลขที่:", "Card No.", base.cardNo);
      drawCellBilingual(left + colL, y, colR, row1, "สินค้า:", "Product", item.productName);
      y += row1;

      // Row 2
      drawCellBilingual(left, y, colL, row2, "รุ่น:", "Model", item.model || "-");
      drawCellBilingual(left + colL, y, colR, row2, "หมายเลขเครื่อง:", "Serial No.", item.serialNumber);
      y += row2;

      // Row 3
      drawCellBilingual(left, y, colL, row3, "ชื่อ-นามสกุล", "Customer's Name", base.customerName);
      drawCellBilingual(left + colL, y, colR, row3, "โทรศัพท์", "Tel.", base.customerTel);
      y += row3;

      // Row 4 (Address full row)
      drawCellFullWidth(left, y, tableW, row4, "ที่อยู่", "Address", base.address);
      y += row4;

      // Row 5
      const purchaseTxt = item.purchaseDate
        ? dateOnlyUTC(item.purchaseDate).toLocaleDateString("th-TH", { timeZone: "UTC" })
        : "-";

      drawCellBilingual(
        left,
        y,
        colL,
        row5,
        "ชื่อจากบริษัทฯ/ตัวแทนจำหน่าย",
        "Dealer' Name",
        T(base.dealerName)
      );
      drawCellBilingual(left + colL, y, colR, row5, "วันที่ซื้อ", "Purchase Date", purchaseTxt);

      // ✅ วาง footer ชิดล่างหน้า (สำคัญมากสำหรับ A3 แนวนอน)
      const footerNoteY = pageH - mm(52); // ปรับได้เล็กน้อยถ้าต้องการ
      drawBottomBrandArea(left, footerNoteY, width, base.company, base.footerNote);
    }

    // map header → base & items
    const storeAddressThai = formatThaiAddress(profile?.address || profile?.addressText || profile?.storeAddress);

    const base = {
      cardNo: header.code || header.id,
      customerName: header.customerName || "-",
      customerTel: header.customerPhone || "-",

      // ไม่มี customerAddress → ใช้ที่อยู่ร้าน (ภาษาไทย)
      address: storeAddressThai || "-",

      dealerName: profile?.storeName || "-",

      footerNote: "โปรดนำใบรับประกันฉบับนี้มาแสดงเป็นหลักฐานทุกครั้งเมื่อใช้บริการ",
      company: {
        name: profile?.storeName || "แอปของเรา",
        address: storeAddressThai || "",
        tel: profile?.phone || "",
      },
    };

    const items = (header.items || []).length
      ? header.items.map((it) => ({
          productName: it.productName || "-",
          model: it.model || "-",
          serialNumber: it.serial || "-",
          purchaseDate: it.purchaseDate || header.createdAt,
          expiryDate: it.expiryDate || null,
          coverageNote: it.coverageNote || null,
        }))
      : [
          {
            productName: "-",
            model: "-",
            serialNumber: "-",
            purchaseDate: header.createdAt,
            expiryDate: null,
            coverageNote: null,
          },
        ];

    for (const it of items) {
      drawWarrantyPage(base, it);
    }

    doc.end();
  } catch (error) {
    console.error("downloadWarrantyPdf error", error);
    return sendError(res, 500, "ไม่สามารถสร้างไฟล์ PDF ได้");
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
    } else if (
      body.customerFirstName != null ||
      body.customerLastName != null
    ) {
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

    // if header fields changed, create in-app notifications for store and customer
    let changed = false;
    try {
      changed =
        header.customerEmail !== updated.customerEmail ||
        header.customerUserId !== updated.customerUserId ||
        header.customerName !== updated.customerName ||
        header.customerPhone !== updated.customerPhone;

      if (changed) {
        const title = `มีการแก้ไขข้อมูลใบรับประกัน ${updated.code || ""}`;
        const bodyText = `ข้อมูลใบรับประกัน ${updated.code || ""} ถูกแก้ไข`;

        await createNotification({
          prisma,
          attrs: {
            storeId: updated.storeId,
            title,
            body: bodyText,
            data: { type: "warranty_header_updated", warrantyId: updated.id },
          },
        });

        if (updated.customerUserId) {
          await createNotification({
            prisma,
            attrs: {
              userId: updated.customerUserId,
              title,
              body: bodyText,
              data: { type: "warranty_header_updated", warrantyId: updated.id },
              sendEmail: true, // ✅ เพิ่ม: ส่งเมลด้วย
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
