import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const mm = (v) => v * 2.83464567;
const T = (v, fallback = "-") =>
  v === undefined || v === null || String(v).trim() === "" ? fallback : String(v);

function resolveFirstExisting(candidates) {
  for (const p of candidates) {
    try {
      if (!p) continue;
      const abs = p.startsWith("file:")
        ? fileURLToPath(p)
        : path.isAbsolute(p) ? p : path.resolve(p);
      if (fs.existsSync(abs)) return abs;
    } catch {}
  }
  return null;
}

// --- load province/district/subdistrict maps (from frontend data) ---
let _thaiAdminMaps = null;
function ensureThaiAdminMaps() {
  if (_thaiAdminMaps) return _thaiAdminMaps;
  const candidates = {
    provinces: [
      path.resolve(process.cwd(), "public/data/api_province.json"),
      path.resolve(process.cwd(), "../frontend-sma/public/data/api_province.json"),
      new URL("../../frontend-sma/public/data/api_province.json", import.meta.url).href,
    ],
    districts: [
      path.resolve(process.cwd(), "public/data/api_district.json"),
      path.resolve(process.cwd(), "../frontend-sma/public/data/api_district.json"),
      new URL("../../frontend-sma/public/data/api_district.json", import.meta.url).href,
    ],
    subdistricts: [
      path.resolve(process.cwd(), "public/data/api_subdistrict.json"),
      path.resolve(process.cwd(), "../frontend-sma/public/data/api_subdistrict.json"),
      new URL("../../frontend-sma/public/data/api_subdistrict.json", import.meta.url).href,
    ],
  };

  function loadJson(list) {
    for (const p of list) {
      try {
        if (!p) continue;
        const abs = p.startsWith("file:") ? fileURLToPath(p) : path.isAbsolute(p) ? p : path.resolve(p);
        if (fs.existsSync(abs)) return JSON.parse(fs.readFileSync(abs, "utf8"));
      } catch {}
    }
    return null;
  }

  const provinces = loadJson(candidates.provinces) || [];
  const districts = loadJson(candidates.districts) || [];
  const subdistricts = loadJson(candidates.subdistricts) || [];

  const provMap = new Map();
  for (const p of provinces) provMap.set(String(p.id), p.name_th || p.name || "");

  const distMap = new Map();
  for (const d of districts) distMap.set(String(d.id), (d.name_th || d.name || ""));

  const subMap = new Map();
  for (const s of subdistricts) subMap.set(String(s.id), (s.name_th || s.name || ""));

  _thaiAdminMaps = { provMap, distMap, subMap };
  return _thaiAdminMaps;
}

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

function stripPrefixThaiName(name) {
  if (!name) return name;
  return String(name).replace(/^(เขต|อำเภอ|แขวง|ตำบล)\s*/u, "");
}

export function formatThaiAddress(addr) {
  if (!addr) return "-";

  const obj = safeJsonParseMaybe(addr);
  if (!obj) return String(addr).trim() || "-";

  const maps = ensureThaiAdminMaps();

  const street = (obj.street || obj.address || obj.line1 || obj.line || obj.address_line || "").toString().trim();

  // try various keys for admin codes/names
  const rawSub = (obj.subdistrict || obj.subDistrict || obj.tambon || obj.subdistrict_id || obj.subdistrictId || obj.subdistrictCode || obj.subdistrict_code || "").toString().trim();
  const rawDist = (obj.district || obj.amphoe || obj.district_id || obj.districtId || obj.district_code || obj.district_code || "").toString().trim();
  const rawProv = (obj.province || obj.state || obj.province_id || obj.provinceId || obj.province_code || obj.provinceCode || "").toString().trim();
  const postcode = (obj.postcode || obj.zip || obj.zipcode || obj.postalCode || obj.postal_code || "").toString().trim();

  let subName = rawSub;
  let distName = rawDist;
  let provName = rawProv;

  // numeric id -> lookup
  try {
    if (maps && rawProv && /^\d+$/.test(rawProv)) provName = maps.provMap.get(String(rawProv)) || rawProv;
    if (maps && rawDist && /^\d+$/.test(rawDist)) distName = (maps.distMap.get(String(rawDist)) || rawDist);
    if (maps && rawSub && /^\d+$/.test(rawSub)) subName = (maps.subMap.get(String(rawSub)) || rawSub);
  } catch (e) {}

  // if values are present but may contain full strings like 'เขตพระนคร', strip prefix for consistent formatting
  subName = stripPrefixThaiName(subName || "");
  distName = stripPrefixThaiName(distName || "");
  provName = stripPrefixThaiName(provName || "");

  const isBkk = (provName || "").includes("กรุงเทพ") || (String(provName || "").toLowerCase().includes("bangkok"));

  const parts = [];
  if (street) parts.push(street);
  if (subName) parts.push(isBkk ? `แขวง${subName}` : `ตำบล${subName}`);
  if (distName) parts.push(isBkk ? `เขต${distName}` : `อำเภอ${distName}`);
  if (provName) parts.push(isBkk ? provName : `จังหวัด${provName}`);
  if (postcode) parts.push(postcode);

  const out = parts.join(" ").replace(/\s+/g, " ").trim();
  return out || "-";
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
      "THAI_FONT_NOT_FOUND: กรุณาวางไฟล์ฟอนต์ไทยไว้ที่ backend-sma/src/assets/fonts/ (เช่น Sarabun-Regular.ttf)"
    );
  }

  const bufReg = fs.readFileSync(regular);
  doc.registerFont("THAI", bufReg);

  if (bold) {
    const bufBold = fs.readFileSync(bold);
    doc.registerFont("THAI_BOLD", bufBold);
  }

  doc.font("THAI");
  return { regular: "THAI", bold: bold ? "THAI_BOLD" : "THAI" };
}

function headerTitle(doc, left, top, width, fonts) {
  doc.font(fonts.bold).fontSize(18).fillColor("#000")
    .text("ใบรับประกัน", left, top, { width: width / 2, align: "left" });
  doc.font(fonts.regular).fontSize(14)
    .text("WARRANTY", left, top + mm(8), { width: width / 2, align: "left" });
  doc.font(fonts.regular).fontSize(12)
    .text("สำหรับผู้ซื้อ", left + width / 2, top, { width: width / 2, align: "right" });
}

function drawLabeledCell(doc, x, y, w, h, th, en, value, fonts, pad = mm(3.5)) {
  doc.rect(x, y, w, h).stroke();
  doc.font(fonts.regular).fontSize(10).fillColor("#000").text(th, x + pad, y + pad, { width: w - pad * 2 });
  doc.font(fonts.regular).fontSize(9).fillColor("#555").text(en, x + pad, y + pad + mm(5), { width: w - pad * 2 });
  doc.font(fonts.regular).fontSize(11).fillColor("#000")
    .text(T(value), x + pad, y + pad + mm(11), { width: w - pad * 2, height: h - pad * 2 - mm(11) });
}

export function drawWarrantyPage(doc, base, item) {
  const A4 = { w: mm(210), h: mm(297) };
  const margin = mm(12);
  const width = A4.w - margin * 2;
  const left = margin;
  const top = margin;

  const fonts = loadThaiFonts(doc);

  headerTitle(doc, left, top, width, fonts);

  const tableTop = top + mm(22);
  const tableW = width;
  const colL = Math.round(tableW * 0.55);
  const colR = tableW - colL;
  const rowH1 = mm(22);
  const rowH2 = mm(22);
  const rowH3 = mm(28);
  const rowH4 = mm(30);
  const rowH5 = mm(22);
  const totalH = rowH1 + rowH2 + rowH3 + rowH4 + rowH5;

  doc.rect(left, tableTop, tableW, totalH).stroke();

  let y = tableTop;
  drawLabeledCell(doc, left, y, colL, rowH1, "เลขที่", "Card No.", base.cardNo, fonts);
  drawLabeledCell(doc, left + colL, y, colR, rowH1, "สินค้า", "Product", item.productName, fonts);
  y += rowH1;

  drawLabeledCell(doc, left, y, colL, rowH2, "รุ่น", "Model", item.model || "-", fonts);
  drawLabeledCell(doc, left + colL, y, colR, rowH2, "หมายเลขเครื่อง", "Serial No.", item.serialNumber, fonts);
  y += rowH2;

  drawLabeledCell(doc, left, y, colL, rowH3, "ชื่อ-นามสกุล", "Customer's Name", base.customerName, fonts);
  drawLabeledCell(doc, left + colL, y, colR, rowH3, "โทรศัพท์", "Tel.", base.customerTel, fonts);
  y += rowH3;

  doc.rect(left, y, tableW, rowH4).stroke();
  doc.font(fonts.regular).fontSize(10).fillColor("#000").text("ที่อยู่", left + mm(3.5), y + mm(3.5));
  doc.font(fonts.regular).fontSize(9).fillColor("#555").text("Address", left + mm(3.5), y + mm(8.5));
  doc.font(fonts.regular).fontSize(11).fillColor("#000")
    .text(T(formatThaiAddress(base.customerAddress)), left + mm(3.5), y + mm(14), { width: tableW - mm(7) });
  y += rowH4;

  const purchaseDate = item.purchaseDate || base.purchaseDate;
  const purchaseTxt = purchaseDate ? new Date(purchaseDate).toLocaleDateString("th-TH") : "-";

  drawLabeledCell(doc, left, y, colL, rowH5, "ชื่อจากบริษัทฯ/ตัวแทนจำหน่าย", "Dealer' Name", base.dealerName, fonts);
  drawLabeledCell(doc, left + colL, y, colR, rowH5, "วันที่ซื้อ", "Purchase Date", purchaseTxt, fonts);
  y += rowH5;

  doc.font(fonts.regular).fontSize(11).fillColor("#000")
    .text(T(base.footerNote, "โปรดนำใบรับประกันฉบับนี้มาแสดงเป็นหลักฐานทุกครั้งเมื่อใช้บริการ"), left, y + mm(8), { width, align: "left" });

  try {
    const candidates = [
      path.resolve(process.cwd(), "src/assets/logo.png"),
      new URL("../assets/logo.png", import.meta.url).href,
    ];
    const logoPath = resolveFirstExisting(candidates);
    if (logoPath) doc.image(logoPath, left, A4.h - mm(44), { width: mm(18) });
  } catch {}

  const companyLines = [
    T(base.company?.name, ""),
    T(base.company?.address, ""),
    ["โทร.", T(base.company?.tel, ""), base.company?.fax ? `แฟกซ์ ${base.company.fax}` : ""]
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean);

  if (companyLines.length) {
    doc.font(fonts.regular).fontSize(10).fillColor("#000")
      .text(companyLines.join("\n"), left + mm(22), A4.h - mm(44), { width: width - mm(22) });
  }
}

export function buildWarrantyPDFStream(res, pages) {
  const doc = new PDFDocument({ autoFirstPage: false });
  try {
    doc.pipe(res);
    pages.forEach(({ base, item }) => drawWarrantyPage(doc, base, item));
    doc.end();
  } catch (e) {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    } catch {}
    res.status(500).end(JSON.stringify({ error: String(e.message || e) }));
  }
}
