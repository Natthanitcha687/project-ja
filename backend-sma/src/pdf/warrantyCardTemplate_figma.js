// backend-sma/src/pdf/warrantyCardTemplate_figma.js
// PDF Template: Warranty Card (Figma-like)
// ใช้กับ PDFKit (เหมือนโปรเจกต์คุณ) และสามารถเรียกจาก controller ทีหลังได้
//
// การใช้งานในอนาคต (ตัวอย่าง):
//   import { drawWarrantyCardPage } from "../pdf/warrantyCardTemplate_figma.js";
//   drawWarrantyCardPage(doc, base, item);
//
// base/item ที่คาดหวัง (ยืดหยุ่นได้):
// base: {
//   customerName, customerTel, address,
//   dealerName,
//   company: { name, email, address, tel },
// }
// item: {
//   productName, model, serialNumber|serial,
//   purchaseDate, expiryDate,
//   coverageNote,
// }

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { formatThaiAddress } from "./warrantyTemplate_v2.js";

// ---------- helpers ----------
const mm = (v) => v * 2.83464567;
const T = (v, fallback = "-") =>
  v === undefined || v === null || String(v).trim() === "" ? fallback : String(v);

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
  // ให้ได้แบบ 19/10/2568
  return d.toLocaleDateString("th-TH");
}

function loadThaiFonts(doc) {
  // ถ้า controller register มาแล้ว ก็ยัง register ซ้ำได้ (ไม่ทำให้พัง)
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

  // bg
  doc.save();
  doc.fillColor(bg).rect(0, 0, doc.page.width, h).fill();
  doc.restore();

  // logo
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
      // fallback simple icon
      doc.save();
      doc.fillColor("#60a5fa").circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2).fill();
      doc.restore();
    }
  } else {
    doc.save();
    doc.fillColor("#60a5fa").circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2).fill();
    doc.restore();
  }

  const textX = logoX + logoSize + mm(6);

  // left titles
  doc.font(fonts.bold).fontSize(18).fillColor("#ffffff")
    .text(titleTH, textX, y + mm(4), { width: w * 0.62, align: "left" });
  doc.font(fonts.regular).fontSize(12).fillColor("#e5e7eb")
    .text(titleEN, textX, y + mm(12), { width: w * 0.62, align: "left" });

  // right titles
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
  doc.font(fonts.bold).fontSize(12).fillColor("#111827");

  if (!multiline) {
    doc.text(T(value), x + padX, valueY, { width: w - padX * 2, align: "left" });
  } else {
    doc.font(fonts.regular).fontSize(11).fillColor("#111827");
    doc.text(T(value), x + padX, valueY, {
      width: w - padX * 2,
      height: h - (valueY - y) - padY,
      align: "left",
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

  // layout constants
  const margin = mm(12);
  const gap = mm(6);
  const contentW = pageW - margin * 2;

  // header bar
  const headerH = mm(20);
  drawHeaderBar(doc, margin, 0, contentW, headerH, fonts, options.header || {});
  let y = headerH + mm(10);

  // -------- Buyer Section --------
  y = drawSectionBar(doc, margin, y, contentW, "ข้อมูลผู้ซื้อ", fonts);

  const w2 = (contentW - gap) / 2;
  const hField = mm(18);

  drawField(
    doc,
    margin,
    y,
    w2,
    hField,
    "ชื่อ-นามสกุล / Customer's Name",
    base.customerName,
    fonts
  );
  drawField(
    doc,
    margin + w2 + gap,
    y,
    w2,
    hField,
    "โทรศัพท์ / Tel.",
    base.customerTel,
    fonts
  );
  y += hField + gap;

  // address full width (พยายาม format ภาษาไทย)
  let addrText = base.address;
  try {
    // ถ้า address เป็น JSON/string address -> แปลงให้สวย
    addrText = formatThaiAddress(base.address);
  } catch {}

  drawField(
    doc,
    margin,
    y,
    contentW,
    mm(20),
    "ที่อยู่ / Address",
    addrText,
    fonts,
    { multiline: true }
  );
  y += mm(20) + mm(10);

  // -------- Product Section --------
  y = drawSectionBar(doc, margin, y, contentW, "ข้อมูลสินค้า", fonts);

  const w3 = (contentW - gap * 2) / 3;

  drawField(
    doc,
    margin,
    y,
    w3,
    hField,
    "สินค้า / Product",
    item.productName,
    fonts
  );
  drawField(
    doc,
    margin + w3 + gap,
    y,
    w3,
    hField,
    "รุ่น / Model",
    item.model,
    fonts
  );
  drawField(
    doc,
    margin + (w3 + gap) * 2,
    y,
    w3,
    hField,
    "หมายเลขเครื่อง / Serial No.",
    item.serialNumber ?? item.serial,
    fonts
  );
  y += hField + gap;

  drawField(
    doc,
    margin,
    y,
    w2,
    hField,
    "วันที่ซื้อ / Purchase Date",
    safeDateTH(item.purchaseDate),
    fonts
  );
  drawField(
    doc,
    margin + w2 + gap,
    y,
    w2,
    hField,
    "วันหมดอายุ / Expiry Date",
    safeDateTH(item.expiryDate),
    fonts
  );
  y += hField + gap;

  // Terms (กล่องยาว)
  const termsDefault =
    "รับประกันฮาร์ดแวร์ 1 ปี ครอบคลุมความเสียหายจากการผลิต การทำงานผิดปกติของอุปกรณ์ และปัญหาด้านซอฟต์แวร์ที่มาจากโรงงาน ไม่รวมความเสียหายจากการใช้งานผิดวิธี";
  drawField(
    doc,
    margin,
    y,
    contentW,
    mm(28),
    "เงื่อนไขการรับประกัน / Warranty Terms",
    item.coverageNote || termsDefault,
    fonts,
    { multiline: true }
  );
  y += mm(28) + mm(10);

  // -------- Exclusion Section --------
  y = drawSectionBar(doc, margin, y, contentW, "เงื่อนไขการรับประกัน", fonts);

  const exclusions =
    options.exclusions ||
    [
      "ความเสียหายจากน้ำ ของเหลว หรือความชื้น",
      "ความเสียหายจากการตกหล่น กระแทก หรืออุบัติเหตุ",
      "การแกะ ดัดแปลง หรือซ่อมแซมโดยบุคคลที่ไม่ได้รับอนุญาต",
      "ความเสียหายจากการใช้งานผิดวิธี",
    ];

  const bulletBoxH = mm(56);
  drawBulletBox(doc, margin, y, contentW, bulletBoxH, exclusions, fonts);
  y += bulletBoxH + mm(8);

  // Dealer + note
  doc.font(fonts.bold).fontSize(10).fillColor("#111827")
    .text(`ผู้จำหน่าย ${T(base.dealerName, "")}`.trim(), margin, y, { width: contentW, align: "left" });
  y += mm(6);

  doc.font(fonts.regular).fontSize(9).fillColor("#6b7280")
    .text("โปรดนำใบรับประกันฉบับนี้มาแสดงเป็นหลักฐานทุกครั้งเมื่อใช้บริการ", margin, y, {
      width: contentW,
      align: "left",
    });
  y += mm(8);

  // line
  doc.strokeColor("#e5e7eb").lineWidth(1)
    .moveTo(margin, y)
    .lineTo(margin + contentW, y)
    .stroke();
  y += mm(6);

  // store/company block (ล่างซ้าย)
  const c = base.company || {};
  const lines = [
    T(c.name, ""),
    T(c.email, ""),
    T(c.address, ""),
    c.tel ? `โทร ${c.tel}` : "",
  ].filter(Boolean);

  doc.font(fonts.regular).fontSize(10).fillColor("#6b7280")
    .text(lines.join("\n"), margin, y, { width: contentW * 0.7, align: "left" });

  // footer center
  const year = new Date().getFullYear();
  doc.font(fonts.regular).fontSize(9).fillColor("#9ca3af")
    .text(`© ${year} Warranty Management Platform. สงวนลิขสิทธิ์`, 0, pageH - mm(10), {
      width: pageW,
      align: "center",
    });
}
