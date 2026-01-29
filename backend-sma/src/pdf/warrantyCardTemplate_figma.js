// backend-sma/src/pdf/warrantyCardTemplate_figma.js
// PDF Template: Warranty Card (Figma-like)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { formatThaiAddress } from "./warrantyTemplate_v2.js";

// ---------- helpers ----------
const mm = (v) => v * 2.83464567;

// ✅ FIX: กัน [object Object] — แปลง object เป็นข้อความที่เหมาะสมก่อน
function toText(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (typeof v === "object") {
    const cand =
      v.name_th ??
      v.nameTh ??
      v.name ??
      v.label ??
      v.text ??
      v.title ??
      v.value; // เผื่อเป็น dropdown {value,label}
    if (cand !== undefined && cand !== null && String(cand).trim() !== "") return String(cand).trim();

    // fallback: พยายาม stringify (ดีกว่า [object Object])
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }

  return String(v);
}

const T = (v, fallback = "-") => {
  const s = toText(v).trim();
  return s ? s : fallback;
};

function resolveFirstExisting(candidates) {
  for (const p of candidates) {
    try {
      if (!p) continue;
      const abs = p.startsWith("file:")
        ? fileURLToPath(p)
        : path.isAbsolute(p)
        ? p
        : path.resolve(p);
      if (fs.existsSync(abs)) return abs;
    } catch {}
  }
  return null;
}

function safeDateTH(v) {
  if (!v) return "-";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return "-";
  return d.toLocaleDateString("th-TH");
}

function loadThaiFonts(doc) {
  const envReg = process.env.THAI_FONT_REGULAR;
  const envBold = process.env.THAI_FONT_BOLD;

  const regular = resolveFirstExisting([
    envReg,
    path.resolve(process.cwd(), "src/assets/fonts/Sarabun-Regular.ttf"),
    path.resolve(process.cwd(), "src/assets/fonts/NotoSansThai-Regular.ttf"),
    new URL("../assets/fonts/Sarabun-Regular.ttf", import.meta.url).href,
    new URL("../assets/fonts/NotoSansThai-Regular.ttf", import.meta.url).href,
  ]);

  const bold = resolveFirstExisting([
    envBold,
    path.resolve(process.cwd(), "src/assets/fonts/Sarabun-Bold.ttf"),
    path.resolve(process.cwd(), "src/assets/fonts/NotoSansThai-Bold.ttf"),
    new URL("../assets/fonts/Sarabun-Bold.ttf", import.meta.url).href,
    new URL("../assets/fonts/NotoSansThai-Bold.ttf", import.meta.url).href,
  ]);

  if (!regular) {
    throw new Error(
      "THAI_FONT_NOT_FOUND: กรุณาวาง Sarabun-Regular.ttf (หรือ NotoSansThai-Regular.ttf) ไว้ที่ backend-sma/src/assets/fonts/"
    );
  }

  try {
    doc.registerFont("THAI", fs.readFileSync(regular));
    if (bold) doc.registerFont("THAI_BOLD", fs.readFileSync(bold));
  } catch (e) {
    throw new Error("FONT_LOAD_ERROR: โปรดใช้ไฟล์ฟอนต์ .ttf แบบ static");
  }

  return { regular: "THAI", bold: bold ? "THAI_BOLD" : "THAI" };
}

function roundedBox(doc, x, y, w, h, r, { fill, stroke, lineWidth } = {}) {
  if (lineWidth != null) doc.lineWidth(lineWidth);
  if (fill) doc.fillColor(fill).roundedRect(x, y, w, h, r).fill();
  if (stroke) doc.strokeColor(stroke).roundedRect(x, y, w, h, r).stroke();
}

function drawHeaderBar(doc, x, y, w, h, fonts, opts = {}) {
  const bg = opts.bg || "#2f2f2f";
  const titleTH = opts.titleTH || "ใบรับประกันสินค้า";
  const titleEN = opts.titleEN || "Warranty Card";
  const rightTH = opts.rightTH || "สำหรับลูกค้า";
  const rightEN = opts.rightEN || "For Customer";

  doc.save();
  doc.fillColor(bg).rect(0, 0, doc.page.width, h).fill();
  doc.restore();

  const logoCandidates = [
    process.env.PDF_APP_LOGO,
    path.resolve(process.cwd(), "../frontend-sma/public/home-assets/logo.png"),
    path.resolve(process.cwd(), "src/assets/logo.png"),
    new URL("../../frontend-sma/public/home-assets/logo.png", import.meta.url).href,
  ].filter(Boolean);
  const logoPath = resolveFirstExisting(logoCandidates);

  const logoSize = mm(14);
  const logoX = x;
  const logoY = y + (h - logoSize) / 2;

  if (logoPath) {
    try {
      const buf = fs.readFileSync(logoPath);
      doc.image(buf, logoX, logoY, { fit: [logoSize, logoSize] });
    } catch {
      doc.save();
      doc.fillColor("#60a5fa")
        .circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2)
        .fill();
      doc.restore();
    }
  } else {
    doc.save();
    doc.fillColor("#60a5fa")
      .circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2)
      .fill();
    doc.restore();
  }

  const textX = logoX + logoSize + mm(6);

  doc.font(fonts.bold).fontSize(18).fillColor("#ffffff")
    .text(titleTH, textX, y + mm(4), { width: w * 0.62, align: "left" });
  doc.font(fonts.regular).fontSize(12).fillColor("#e5e7eb")
    .text(titleEN, textX, y + mm(12), { width: w * 0.62, align: "left" });

  doc.font(fonts.bold).fontSize(12).fillColor("#ffffff")
    .text(rightTH, x + w * 0.62, y + mm(5), { width: w * 0.38, align: "right" });
  doc.font(fonts.regular).fontSize(11).fillColor("#e5e7eb")
    .text(rightEN, x + w * 0.62, y + mm(12), { width: w * 0.38, align: "right" });
}

function drawSectionBar(doc, x, y, w, label, fonts) {
  const h = mm(10);
  const r = mm(3);
  roundedBox(doc, x, y, w, h, r, { fill: "#d9eefe" });
  doc.font(fonts.bold).fontSize(12).fillColor("#111827")
    .text(label, x + mm(6), y + mm(2), { width: w - mm(12), align: "left" });
  return y + h + mm(4);
}

function drawField(doc, x, y, w, h, label, value, fonts, { multiline = false } = {}) {
  const r = mm(4);
  const padX = mm(5);
  const padY = mm(4);
  roundedBox(doc, x, y, w, h, r, { stroke: "#d1d5db", lineWidth: 1 });

  doc.font(fonts.regular).fontSize(10).fillColor("#6b7280")
    .text(label, x + padX, y + padY, { width: w - padX * 2, align: "left" });

  const valueY = y + padY + mm(6);

  if (!multiline) {
    doc.font(fonts.bold).fontSize(12).fillColor("#111827");
    doc.text(T(value), x + padX, valueY, { width: w - padX * 2, align: "left" });
  } else {
    doc.font(fonts.regular).fontSize(11).fillColor("#111827");
    doc.text(T(value), x + padX, valueY, {
      width: w - padX * 2,
      height: h - (valueY - y) - padY,
      align: "left",
      ellipsis: true,
    });
  }
}

function drawBulletBox(doc, x, y, w, h, bullets, fonts) {
  const r = mm(4);
  const padX = mm(7);
  const padY = mm(6);
  roundedBox(doc, x, y, w, h, r, { stroke: "#d1d5db", lineWidth: 1 });

  doc.font(fonts.regular).fontSize(11).fillColor("#111827");

  const lineGap = mm(6);
  let cy = y + padY;

  const list = Array.isArray(bullets) ? bullets : [];
  for (const b of list) {
    if (!b) continue;
    doc.text("•", x + padX, cy, { width: mm(6) });
    doc.text(String(b), x + padX + mm(6), cy, { width: w - padX * 2 - mm(6) });
    cy += lineGap;
    if (cy > y + h - padY) break;
  }
}

// ---------- main export ----------
export function drawWarrantyCardPage(doc, base = {}, item = {}, options = {}) {
  const fonts = loadThaiFonts(doc);

  // A4 portrait
  const pageW = mm(210);
  const pageH = mm(297);
  doc.addPage({
    size: [pageW, pageH],
    margins: { top: 0, left: 0, right: 0, bottom: 0 },
  });

  const margin = mm(12);
  const gap = mm(6);
  const contentW = pageW - margin * 2;

  // header bar
  const headerH = mm(20);
  drawHeaderBar(doc, margin, 0, contentW, headerH, fonts, options.header || {});

  let y = headerH + mm(8);

  // -------- Buyer Section --------
  y = drawSectionBar(doc, margin, y, contentW, "ข้อมูลผู้ซื้อ", fonts);

  const w2 = (contentW - gap) / 2;
  const hField = mm(17);

  drawField(doc, margin, y, w2, hField, "ชื่อ-นามสกุล / Customer's Name", base.customerName, fonts);
  drawField(doc, margin + w2 + gap, y, w2, hField, "โทรศัพท์ / Tel.", base.customerTel, fonts);
  y += hField + gap;

  // address full width
  let addrText = base.address;
  try {
    addrText = formatThaiAddress(base.address);
  } catch {}

  drawField(doc, margin, y, contentW, mm(20), "ที่อยู่ / Address", addrText, fonts, { multiline: true });
  y += mm(20) + mm(8);

  // -------- Product Section --------
  y = drawSectionBar(doc, margin, y, contentW, "ข้อมูลสินค้า", fonts);

  const w3 = (contentW - gap * 2) / 3;
  drawField(doc, margin, y, w3, hField, "สินค้า / Product", item.productName, fonts);
  drawField(doc, margin + w3 + gap, y, w3, hField, "รุ่น / Model", item.model, fonts);
  drawField(doc, margin + (w3 + gap) * 2, y, w3, hField, "หมายเลขเครื่อง / Serial No.", item.serialNumber ?? item.serial, fonts);
  y += hField + gap;

  drawField(doc, margin, y, w2, hField, "วันที่ซื้อ / Purchase Date", safeDateTH(item.purchaseDate), fonts);
  drawField(doc, margin + w2 + gap, y, w2, hField, "วันหมดอายุ / Expiry Date", safeDateTH(item.expiryDate), fonts);
  y += hField + gap;

  // Terms
  const termsDefault =
    "รับประกันฮาร์ดแวร์ 1 ปี ครอบคลุมความเสียหายจากการผลิต การทำงานผิดปกติของอุปกรณ์ และปัญหาด้านซอฟต์แวร์ที่มาจากโรงงาน ไม่รวมความเสียหายจากการใช้งานผิดวิธี";
  drawField(doc, margin, y, contentW, mm(28), "เงื่อนไขการรับประกัน / Warranty Terms", item.coverageNote || termsDefault, fonts, { multiline: true });
  y += mm(28) + mm(8);

  // -------- Exclusion Section --------
  y = drawSectionBar(doc, margin, y, contentW, "เงื่อนไขการรับประกัน", fonts);

  const exclusions =
    options.exclusions || [
      "ความเสียหายจากน้ำ ของเหลว หรือความชื้น",
      "ความเสียหายจากการตกหล่น กระแทก หรืออุบัติเหตุ",
      "การแกะ ดัดแปลง หรือซ่อมแซมโดยบุคคลที่ไม่ได้รับอนุญาต",
      "ความเสียหายจากการใช้งานผิดวิธี",
    ];

  // ✅ FIX #1: ช่องเงื่อนไขให้พอดีเท่ากรอบเขียว (คำนวณจากจำนวน bullet จริง)
  const padYBul = mm(6);
  const lineGapBul = mm(6);
  const bulletCount = (Array.isArray(exclusions) ? exclusions.filter(Boolean).length : 0) || 1;

  // สูงพอดีกับจำนวนบรรทัด + padding (ไม่ใช้ mm(50) แล้ว)
  const bulletBoxH = Math.max(mm(26), padYBul * 2 + lineGapBul * bulletCount + mm(2));

  drawBulletBox(doc, margin, y, contentW, bulletBoxH, exclusions, fonts);

  // ✅ FIX #2: ขยับส่วนล่างขึ้น (ลดช่องว่างหลังกล่อง)
  y += bulletBoxH + mm(4);

  // =========================
  // ส่วนล่าง
  // =========================

  // note (คุมความสูง เพื่อไม่ทับส่วนล่าง) + ขยับขึ้นเล็กน้อย
  const noteText = "โปรดนำใบรับประกันฉบับนี้มาแสดงเป็นหลักฐานทุกครั้งเมื่อใช้บริการ";
  doc.font(fonts.regular).fontSize(9).fillColor("#6b7280");
  const noteBoxH = mm(8);
  doc.text(noteText, margin, y, {
    width: contentW,
    height: noteBoxH,
    ellipsis: true,
    lineGap: 1,
    align: "left",
  });
  y += noteBoxH + mm(1.5);

  // line
  doc.strokeColor("#e5e7eb").lineWidth(1)
    .moveTo(margin, y)
    .lineTo(margin + contentW, y)
    .stroke();
  y += mm(2.5);

  // store/company block (ล่างซ้าย) — ให้โชว์ครบไม่โดนตัดหน้า
  const c = base.company || {};
  const dealerName = T(base.dealerName, T(c.name, ""));
  const dealerTitle = dealerName ? `ผู้จำหน่าย ${dealerName}` : "ผู้จำหน่าย";

  const detailLines = [
    T(c.email, ""),
    T(c.address, ""),
    c.tel ? `โทร ${c.tel}` : "",
  ].filter(Boolean);

  const year = new Date().getFullYear();
  const footerY = pageH - mm(14);

  // คำนวณพื้นที่ที่เหลือก่อนชน footer
  let availableH = footerY - y - mm(3);

  if (availableH > 0) {
    const blockW = contentW * 0.75;

    // หัวข้อผู้จำหน่าย (ตัวหนา)
    doc.font(fonts.bold).fontSize(10).fillColor("#111827");
    const titleH = doc.heightOfString(dealerTitle, { width: blockW, lineGap: 1 });
    const titleBoxH = Math.min(mm(7), Math.max(mm(5.5), titleH));

    doc.text(dealerTitle, margin, y, {
      width: blockW,
      height: titleBoxH,
      ellipsis: true,
      lineGap: 1,
      align: "left",
    });
    y += titleBoxH + mm(1.2);

    // รายละเอียดร้าน (จำกัดตามพื้นที่ที่เหลือจริง เพื่อไม่โดนตัด)
    availableH = footerY - y - mm(3);
    if (availableH > 0 && detailLines.length) {
      const detailsH = Math.min(mm(26), availableH);
      doc.font(fonts.regular).fontSize(10).fillColor("#6b7280")
        .text(detailLines.join("\n"), margin, y, {
          width: blockW,
          height: detailsH,
          ellipsis: true,
          lineGap: 2,
          align: "left",
        });
    }
  }

  // footer center
  doc.font(fonts.regular).fontSize(9).fillColor("#9ca3af")
    .text(`© ${year} Warranty Management Platform. สงวนลิขสิทธิ์`, 0, footerY, {
      width: pageW,
      align: "center",
    });
}
