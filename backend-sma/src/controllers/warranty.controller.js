import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { prisma } from "../db/prisma.js";
import { sendError, sendSuccess } from "../utils/http.js";
import { createAndPublish as createNotification } from '../routes/notifications.routes.js'

const DEFAULT_NOTIFY_DAYS = 14;

function currentStoreId(req) {
  const id = Number(req.user?.sub);
  return Number.isInteger(id) ? id : null;
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
        try { if (p && fs.existsSync(p)) return p; } catch {}
      }
      return null;
    }

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
      return sendError(
        res,
        500,
        "Unknown font format: โปรดใช้ไฟล์ TTF แบบ static"
      );
    }

    doc.pipe(res);

    function headerTitle(left, top, width) {
      doc.font(boldPath ? "THAI_BOLD" : "THAI").fontSize(18).fillColor("#000")
        .text("ใบรับประกัน", left, top, { width: width / 2, align: "left" });
      doc.font("THAI").fontSize(14).text("WARRANTY", left, top + mm(8), {
        width: width / 2,
        align: "left",
      });
      doc.font("THAI").fontSize(12).text("สำหรับผู้ซื้อ", left + width / 2, top, {
        width: width / 2,
        align: "right",
      });
    }

    function cell(x, y, w, h, th, en, value, pad = mm(3.5)) {
      doc.rect(x, y, w, h).stroke();
      doc.font("THAI").fontSize(10).fillColor("#000")
        .text(th, x + pad, y + pad, { width: w - pad * 2 });
      doc.font("THAI").fontSize(9).fillColor("#555")
        .text(en, x + pad, y + pad + mm(5), { width: w - pad * 2 });
      doc.font("THAI").fontSize(11).fillColor("#000")
        .text(T(value), x + pad, y + pad + mm(11), {
          width: w - pad * 2,
          height: h - pad * 2 - mm(11),
        });
    }

    function drawWarrantyPage(base, item) {
      doc.addPage({
        size: [mm(210), mm(297)],
        margins: { top: mm(12), left: mm(12), right: mm(12), bottom: mm(12) },
      });

      const pageW = mm(210);
      const left = mm(12);
      const top = mm(12);
      const width = pageW - mm(12) * 2;

      headerTitle(left, top, width);

      const tableTop = top + mm(22);
      const tableW = width;
      const colL = Math.round(tableW * 0.55);
      const colR = tableW - colL;

      // ลำดับใหม่ตามที่ขอ:
      // 1) เลขที่/สินค้า
      // 2) รุ่น/Serial
      // 3) วันที่ซื้อ / วันหมดอายุ      ← ย้ายขึ้นมาก่อนชื่อลูกค้า
      // 4) ชื่อลูกค้า / โทรลูกค้า
      // 5) เงื่อนไขการรับประกัน (เต็มแถว)
      // 6) ชื่อร้าน (ซ้าย) / เบอร์โทรร้านค้า (ขวา)
      // 7) ที่อยู่ร้านค้า (เต็มแถว)

      const rowH1 = mm(22);
      const rowH2 = mm(22);
      const rowH3 = mm(22);
      const rowH4 = mm(28);
      const rowH5 = mm(30);
      const rowH6 = mm(22);
      const rowH7 = mm(28);
      const totalH = rowH1 + rowH2 + rowH3 + rowH4 + rowH5 + rowH6 + rowH7;

      // กรอบรวม
      doc.rect(left, tableTop, tableW, totalH).stroke();

      let y = tableTop;

      // แถว 1 — เลขที่ / สินค้า
      cell(left, y, colL, rowH1, "เลขที่", "Card No.", base.cardNo);
      cell(left + colL, y, colR, rowH1, "สินค้า", "Product", item.productName);
      y += rowH1;

      // แถว 2 — รุ่น / Serial
      cell(left, y, colL, rowH2, "รุ่น", "Model", item.model || "-");
      cell(left + colL, y, colR, rowH2, "หมายเลขเครื่อง", "Serial No.", item.serialNumber);
      y += rowH2;

      // เตรียมวันที่ (UTC)
      const purchaseTxt = item.purchaseDate
        ? dateOnlyUTC(item.purchaseDate).toLocaleDateString("th-TH", { timeZone: "UTC" })
        : "-";
      const expiryTxt = item.expiryDate
        ? dateOnlyUTC(item.expiryDate).toLocaleDateString("th-TH", { timeZone: "UTC" })
        : "-";

      // แถว 3 — วันที่ซื้อ / วันหมดอายุ (แยกสองช่อง)
      cell(left, y, colL, rowH3, "วันที่ซื้อ", "Purchase Date", purchaseTxt);
      cell(left + colL, y, colR, rowH3, "วันหมดอายุ", "Expiry Date", expiryTxt);
      y += rowH3;

      // แถว 4 — ชื่อลูกค้า / โทรลูกค้า
      cell(left, y, colL, rowH4, "ชื่อ-นามสกุล", "Customer's Name", base.customerName);
      cell(left + colL, y, colR, rowH4, "โทรศัพท์", "Tel.", base.customerTel);
      y += rowH4;

      // แถว 5 (เต็มแถว) — เงื่อนไขการรับประกัน
      doc.rect(left, y, tableW, rowH5).stroke();
      doc.font("THAI").fontSize(10).fillColor("#000")
        .text("เงื่อนไขการรับประกัน", left + mm(3.5), y + mm(3.5));
      doc.font("THAI").fontSize(9).fillColor("#555")
        .text("Warranty Terms", left + mm(3.5), y + mm(8.5));
      doc.font("THAI").fontSize(11).fillColor("#000")
        .text(T(item.coverageNote), left + mm(3.5), y + mm(14), {
          width: tableW - mm(7),
        });
      y += rowH5;

      // แถว 6 — ชื่อร้าน / เบอร์โทรร้านค้า (ไม่รวมกัน)
      cell(left, y, colL, rowH6, "ชื่อจากบริษัทฯ/ตัวแทนจำหน่าย", "Dealer' Name", T(base.dealerName));
      cell(left + colL, y, colR, rowH6, "โทรศัพท์", "Tel.", T(base.dealerPhone));
      y += rowH6;

      // แถว 7 (เต็มแถว) — ที่อยู่ร้านค้า
      doc.rect(left, y, tableW, rowH7).stroke();
      doc.font("THAI").fontSize(10).fillColor("#000")
        .text("ที่อยู่ร้านค้า", left + mm(3.5), y + mm(3.5));
      doc.font("THAI").fontSize(9).fillColor("#555")
        .text("Store Address", left + mm(3.5), y + mm(8.5));
      doc.font("THAI").fontSize(11).fillColor("#000")
        .text(T(base.company?.address || "-"), left + mm(3.5), y + mm(14), {
          width: tableW - mm(7),
        });
      y += rowH7;

      // หมายเหตุท้ายหน้า
      doc.font("THAI").fontSize(11).fillColor("#000").text(
        T(base.footerNote, "โปรดนำใบรับประกันฉบับนี้มาแสดงเป็นหลักฐานทุกครั้งเมื่อใช้บริการ"),
        left,
        y + mm(8),
        { width, align: "left" }
      );

      // ข้อมูลบริษัท (ล่างซ้าย)
      const companyLines = [
        T(base.company?.name, ""),
        T(base.company?.address, ""),
        ["โทร.", T(base.company?.tel, ""), base.company?.fax ? `แฟกซ์ ${base.company.fax}` : ""]
          .filter(Boolean)
          .join(" "),
      ].filter(Boolean);

      if (companyLines.length) {
        doc.font("THAI").fontSize(10).fillColor("#000")
          .text(companyLines.join("\n"), left + mm(22), mm(297) - mm(44), {
            width: width - mm(22),
          });
      }
    }

    // map header → base & items
    const base = {
      cardNo: header.code || header.id,
      customerName: header.customerName || "-",
      customerTel: header.customerPhone || "-",
      dealerName: profile?.storeName || "-",
      dealerPhone: profile?.phone || "", // ใช้ในช่อง "เบอร์โทรศัพท์ร้านค้า"
      purchaseDate: header.createdAt,
      footerNote: "โปรดนำใบรับประกันฉบับนี้มาแสดงเป็นหลักฐานทุกครั้งเมื่อใช้บริการ",
      company: {
        name: profile?.storeName || "",
        address: profile?.address || "",
        tel: profile?.phone || "",
        fax: "",
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
      : [{
          productName: "-",
          model: "-",
          serialNumber: "-",
          purchaseDate: header.createdAt,
          expiryDate: null,
          coverageNote: null,
        }];

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

    const body = req.body || {};
    const normEmail = body.customerEmail
      ? String(body.customerEmail).trim().toLowerCase()
      : null;

    let customerUserId = header.customerUserId;
    let customerName = header.customerName;
    let customerPhone = header.customerPhone;

    // เปลี่ยนอีเมล → ผูกกับบัญชีลูกค้าโดยอัตโนมัติถ้ามี
    if (normEmail) {
      const user = await prisma.user.findUnique({ where: { email: normEmail } });
      if (user) {
        customerUserId = user.id;
        const cp = await prisma.customerProfile.findUnique({
          where: { userId: user.id },
          select: { firstName: true, lastName: true, phone: true },
        });
        const nm = `${(cp?.firstName || "").trim()} ${(cp?.lastName || "").trim()}`.trim();
        if (nm) customerName = nm;
        if (cp?.phone) customerPhone = cp.phone;
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
    try {
      const changed = (
        header.customerEmail !== updated.customerEmail ||
        header.customerUserId !== updated.customerUserId ||
        header.customerName !== updated.customerName ||
        header.customerPhone !== updated.customerPhone
      );
      if (changed) {
        const title = `มีการแก้ไขข้อมูลใบรับประกัน ${updated.code || ''}`
        const body = `ข้อมูลใบรับประกัน ${updated.code || ''} ถูกแก้ไข`;
        await createNotification({ prisma, attrs: { storeId: updated.storeId, title, body, data: { type: 'warranty_header_updated', warrantyId: updated.id } } })
        if (updated.customerUserId) {
          await createNotification({ prisma, attrs: { userId: updated.customerUserId, title, body, data: { type: 'warranty_header_updated', warrantyId: updated.id } } })
        }
      }
    } catch (e) {
      console.warn('notify warranty header update failed', e?.message || e)
    }

    return sendSuccess(res, { warranty: updated });
  } catch (e) {
    console.error("updateWarrantyHeader error", e);
    return sendError(res, 500, "ไม่สามารถแก้ไขข้อมูลใบได้");
  }
}
