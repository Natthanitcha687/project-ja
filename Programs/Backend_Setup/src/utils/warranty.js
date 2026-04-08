const STATUS_METADATA = {
  active: {
    label: "ใช้งานได้",
    color: "bg-emerald-100 text-emerald-700",
  },
  nearing_expiration: {
    label: "ใกล้หมดอายุ",
    color: "bg-amber-100 text-amber-700",
  },
  expired: {
    label: "หมดอายุ",
    color: "bg-rose-100 text-rose-700",
  },
  unknown: {
    label: "ไม่ทราบสถานะ",
    color: "bg-gray-100 text-gray-600",
  },
};

const MS_IN_DAY = 1000 * 60 * 60 * 24;

/* ===================== UTC Date-only helpers ===================== */

function dateOnlyUTCFromYMD(ymd) {
  // ymd: 'YYYY-MM-DD'
  if (typeof ymd !== "string") return null;
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d));
}

function toDateOnlyUTC(value) {
  // รับ string/date/timestamp -> คืน Date ที่ 00:00:00Z
  if (!value) return null;

  if (typeof value === "string") {
    const dOnly = dateOnlyUTCFromYMD(value);
    if (dOnly) return dOnly;
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addMonthsUTC(dateOnlyUTC, months) {
  // บวกเดือนแบบ UTC พร้อม clamp วันปลายเดือน
  const y = dateOnlyUTC.getUTCFullYear();
  const m = dateOnlyUTC.getUTCMonth();
  const day = dateOnlyUTC.getUTCDate();

  const head = new Date(Date.UTC(y, m + Number(months || 0), 1));
  const lastDay = new Date(Date.UTC(head.getUTCFullYear(), head.getUTCMonth() + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);

  return new Date(Date.UTC(head.getUTCFullYear(), head.getUTCMonth(), safeDay));
}

function diffDaysUTC(a, b) {
  // ต่างวันแบบ UTC (ปัดให้เป็นจำนวนวันเต็ม)
  const A = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const B = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.ceil((B - A) / MS_IN_DAY);
}

/* ===================== เดิมแต่ทำให้ UTC-safe ===================== */

function parseDate(value) {
  // รักษาชื่อเดิม แต่ให้คืน "UTC date-only"
  return toDateOnlyUTC(value);
}

function computeExpiryDate(purchaseDate, durationMonths, explicitExpiry) {
  const expiry = parseDate(explicitExpiry);
  if (expiry) return expiry;

  const purchase = parseDate(purchaseDate);
  if (!purchase || durationMonths == null) return null;

  return addMonthsUTC(purchase, Number(durationMonths));
}

function computeDurationDays(purchaseDate, expiryDate) {
  const purchase = parseDate(purchaseDate);
  const expiry = parseDate(expiryDate);
  if (!purchase || !expiry) return null;
  const diff = diffDaysUTC(purchase, expiry);
  return diff > 0 ? diff : 0;
}

function toISODate(date) {
  const d = parseDate(date);
  if (!d) return null;
  // สร้าง 'YYYY-MM-DD' จากค่า UTC
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function determineWarrantyStatus(expiryDate, notifyDays = 14) {
  const expiry = parseDate(expiryDate);
  if (!expiry) {
    return {
      code: "unknown",
      daysLeft: null,
      ...STATUS_METADATA.unknown,
    };
  }
  const today = toDateOnlyUTC(new Date());
  const diffDays = diffDaysUTC(today, expiry);

  if (diffDays < 0) {
    return {
      code: "expired",
      daysLeft: diffDays,
      ...STATUS_METADATA.expired,
    };
  }

  if (diffDays <= notifyDays) {
    return {
      code: "nearing_expiration",
      daysLeft: diffDays,
      ...STATUS_METADATA.nearing_expiration,
    };
  }

  return {
    code: "active",
    daysLeft: diffDays,
    ...STATUS_METADATA.active,
  };
}

export function buildWarrantyPersistenceData(payload) {
  const purchaseDate = parseDate(payload.purchase_date);
  if (!purchaseDate) throw new Error("Invalid purchase date");

  let durationMonths =
    payload.duration_months != null ? Number(payload.duration_months) : null;

  const expiryDate = computeExpiryDate(purchaseDate, durationMonths, payload.expiry_date);
  const durationDays = computeDurationDays(purchaseDate, expiryDate);

  if ((durationMonths == null || Number.isNaN(durationMonths)) && durationDays != null) {
    durationMonths = Math.max(1, Math.round(durationDays / 30));
  }

  const normalize = (value) => {
    if (value == null) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    return value;
  };

  return {
    customerEmail: payload.customer_email.trim().toLowerCase(),
    customerName: normalize(payload.customer_name),
    customerPhone: normalize(payload.customer_phone),
    productName: payload.product_name.trim(),
    serial: normalize(payload.serial),
    purchaseDate,          // Date @ 00:00Z
    expiryDate,            // Date @ 00:00Z (หรือ null)
    durationMonths,
    durationDays,
    coverageNote: payload.warranty_terms.trim(),
    note: normalize(payload.note),
  };
}

export function mapWarrantyForResponse(warranty, { notifyDaysInAdvance = 14 } = {}) {
  if (!warranty) return null;
  const status = determineWarrantyStatus(warranty.expiryDate, notifyDaysInAdvance);

  // Parse images from JSON
  let images = [];
  try {
    if (warranty.images) {
      images = JSON.parse(warranty.images);
    }
  } catch (error) {
    console.error("Error parsing warranty images:", error);
    images = [];
  }

  return {
    id: warranty.id,
    storeId: warranty.storeId,
    productName: warranty.productName,
    serial: warranty.serial,
    customerName: warranty.customerName,
    customerEmail: warranty.customerEmail,
    customerPhone: warranty.customerPhone,
    purchaseDate: toISODate(warranty.purchaseDate),
    expiryDate: toISODate(warranty.expiryDate),
    durationMonths: warranty.durationMonths,
    durationDays: warranty.durationDays,
    coverageNote: warranty.coverageNote,
    note: warranty.note,
    documents: warranty.documents,
    images: images,
    statusCode: status.code,
    statusTag: status.label,
    statusColor: status.color,
    status: status.code,
    daysLeft: status.daysLeft,
    createdAt: warranty.createdAt?.toISOString?.() ?? null,
    updatedAt: warranty.updatedAt?.toISOString?.() ?? null,
    warrantyPdfUrl: `/warranties/${warranty.id}/pdf`,
  };
}

export function summarizeWarrantyStatuses(warranties, notifyDaysInAdvance = 14) {
  const summary = new Map();
  warranties.forEach((warranty) => {
    const meta = determineWarrantyStatus(warranty.expiryDate, notifyDaysInAdvance);
    const key = meta.code;
    const current = summary.get(key) || { code: key, label: meta.label, count: 0 };
    current.count += 1;
    summary.set(key, current);
  });
  return Array.from(summary.values());
}
