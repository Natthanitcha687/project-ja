// backend-sma/src/controllers/warrantyItem.controller.js
import { prisma } from '../db/prisma.js';
import fs from 'fs';
import path from 'path';
import { uploadSubPath } from '../middleware/uploadImages.js';

const publicBase =
  (process.env.APP_URL && process.env.APP_URL.replace(/\/+$/, '')) ||
  `http://localhost:${process.env.PORT || 4000}`;

/* =========================================================
 * ✅ IMPORTANT (Render Disk)
 * - ใช้ UPLOAD_ROOT เดียวกับ server.js / uploadImages.js
 * - ถ้าไม่ตั้ง UPLOAD_ROOT จะ fallback ไปที่ backend-sma/src/uploads
 * ========================================================= */
const uploadsRoot = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.resolve(process.cwd(), 'src/uploads');

function resolveUploadedFilePath(url) {
  if (!url || typeof url !== 'string') return null;

  // ตัด query/hash เผื่อมี
  const cleaned = url.split('?')[0].split('#')[0];

  // เราเก็บ URL เป็นรูปแบบ "/uploads/...."
  // แปลงเป็น relative path ภายใต้ uploadsRoot: "warranty-images/xxx.jpg"
  let rel = cleaned;
  if (rel.startsWith('/uploads/')) rel = rel.slice('/uploads/'.length);
  else rel = rel.replace(/^\/+/, ''); // กัน leading '/'

  // normalize แบบ posix เพื่อกัน path traversal
  const norm = path.posix.normalize(rel);

  // block traversal
  if (norm.startsWith('..') || norm.includes('../')) return null;

  const abs = path.resolve(path.join(uploadsRoot, norm));
  const rootAbs = path.resolve(uploadsRoot);

  // ensure อยู่ใต้ uploadsRoot จริง ๆ
  if (!(abs === rootAbs || abs.startsWith(rootAbs + path.sep))) return null;

  return abs;
}

/* ---------- helpers (UTC-safe) ---------- */
function toDateOnly(v) {
  // คืนค่า Date ที่เวลา 00:00:00 **UTC** เสมอ (หรือ null ถ้าพาร์สไม่ได้)
  if (!v) return null;

  // กรณีได้ string รูปแบบ 'YYYY-MM-DD'
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
      return new Date(Date.UTC(y, mo, d));
    }
  }

  // กรณีได้ Date / timestamp / string อื่น ๆ → แปลงเป็น Date แล้วปัดเป็น "วัน" แบบ UTC
  const d = new Date(v);
  if (isNaN(d)) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addMonths(date, m) {
  // รับ Date (ที่ควรเป็น 00:00 UTC) แล้วบวกเดือนแบบ UTC พร้อม clamping วันปลายเดือน
  const y = date.getUTCFullYear();
  const mo = date.getUTCMonth();
  const day = date.getUTCDate();

  // ไปต้นเดือนของเดือนเป้าหมาย (UTC)
  const head = new Date(Date.UTC(y, mo + Number(m || 0), 1));
  // หาวันสุดท้ายของเดือนเป้าหมาย
  const lastDay = new Date(Date.UTC(head.getUTCFullYear(), head.getUTCMonth() + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);

  return new Date(Date.UTC(head.getUTCFullYear(), head.getUTCMonth(), safeDay));
}
function daysBetween(a, b) {
  // นับต่างกันเป็น "จำนวนวัน" โดยยึด 00:00 UTC ทั้งคู่
  const A = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const B = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.ceil((B - A) / (24 * 3600 * 1000));
}

// ✅ ทำ meta ให้เป็น JSON-safe (กัน Prisma Json ไม่รับ Date/Object พิเศษ)
function jsonSafe(v) {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return null;
  }
}

// ✅ best-effort audit log สำหรับ action เกี่ยวกับ WarrantyItem (ห้ามทำให้ระบบพัง)
async function auditWarrantyItemBestEffort(req, action, itemWithWarranty, meta = {}) {
  try {
    const actorUserId = Number(req.user?.id ?? req.user?.sub);
    const actorOk = Number.isInteger(actorUserId) ? actorUserId : null;

    const warr = itemWithWarranty?.warranty || null;
    const storeId = warr?.storeId ?? null;

    const customerUserId = warr?.customerUserId ?? null;
    const customerEmail = warr?.customerEmail ?? null;

    const targetType = customerUserId
      ? 'User'
      : customerEmail
        ? 'CustomerEmail'
        : null;

    const targetId = customerUserId
      ? String(customerUserId)
      : customerEmail
        ? String(customerEmail)
        : null;

    const xf = req.headers['x-forwarded-for'];
    const ipFromXf =
      typeof xf === 'string'
        ? xf.split(',')[0].trim()
        : Array.isArray(xf)
          ? String(xf[0]).split(',')[0].trim()
          : null;

    const ip =
      ipFromXf ||
      req.headers['x-real-ip']?.toString()?.trim() ||
      req.headers['cf-connecting-ip']?.toString()?.trim() ||
      req.ip ||
      null;

    const userAgent =
      (typeof req.get === 'function' ? req.get('user-agent') : null) || null;

    await prisma.auditLog.create({
      data: {
        actorUserId: actorOk,
        action,
        targetType,
        targetId,
        ip,
        userAgent,
        meta: {
          result: 'SUCCESS',
          storeId,
          warrantyId: warr?.id ?? null,
          warrantyCode: warr?.code ?? null,
          customerUserId,
          customerEmail,
          warrantyItemId: itemWithWarranty?.id ?? null,
          ...meta,
        },
      },
    });
  } catch (e) {
    console.warn(`audit ${action} failed (ignored):`, e?.message || e);
  }
}

/* ---------- เพิ่มรูปให้ WarrantyItem (many files) ---------- */
export async function addItemImages(req, res) {
  try {
    const { itemId } = req.params; // ❗️ id เป็น string

    const item = await prisma.warrantyItem.findUnique({
      where: { id: itemId },
      include: { warranty: true },
    });
    if (!item) return res.status(404).json({ message: 'ไม่พบรายการสินค้า' });

    // ตรวจสิทธิ์ร้าน
    const userId = Number(req.user?.sub);
    if (!item.warranty || item.warranty.storeId !== userId) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ในรายการนี้' });
    }

    const existed = Array.isArray(item.images) ? item.images : [];
    const files = (req.files || []).map(f => ({
      id: path.parse(f.filename).name,
      url: `${uploadSubPath}/${f.filename}`,
      originalName: f.originalname,
      mime: f.mimetype,
      size: f.size,
    }));

    const updated = await prisma.warrantyItem.update({
      where: { id: itemId }, // ❗️ อย่าแปลงเป็น Number
      data: { images: [...existed, ...files] },
    });

    // ✅ ตาม requirement ใหม่: ไม่ส่งแจ้งเตือนฝั่งร้านจาก event ย่อย (คงไว้เฉพาะ daily summary + complaint_created ที่อื่น)

    // ✅ AuditLog: ADD_WARRANTY_ITEM_IMAGES (best-effort)
    await auditWarrantyItemBestEffort(req, 'ADD_WARRANTY_ITEM_IMAGES', item, {
      before: jsonSafe({ item }),
      after: jsonSafe({ item: { ...updated, warranty: item.warranty } }),
      addedImages: jsonSafe(files),
    });

    return res.json({
      data: {
        item: {
          ...updated,
          images: (updated.images || []).map(im => ({
            ...im,
            absoluteUrl: `${publicBase}${im.url}`,
          })),
        },
      },
    });
  } catch (err) {
    console.error('addItemImages error', err);
    return res.status(500).json({ message: 'อัปโหลดรูปภาพไม่สำเร็จ' });
  }
}

/* ---------- ลบรูปจาก WarrantyItem ---------- */
export async function deleteItemImage(req, res) {
  try {
    const { itemId, imageId } = req.params; // ❗️ id เป็น string

    const item = await prisma.warrantyItem.findUnique({
      where: { id: itemId },
      include: { warranty: true },
    });
    if (!item) return res.status(404).json({ message: 'ไม่พบรายการสินค้า' });

    const userId = Number(req.user?.sub);
    if (!item.warranty || item.warranty.storeId !== userId) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ในรายการนี้' });
    }

    const current = Array.isArray(item.images) ? item.images : [];
    const target = current.find(im => im.id === imageId);
    if (!target) return res.status(404).json({ message: 'ไม่พบรูปภาพที่ต้องการลบ' });

    // ✅ ลบไฟล์จริงจาก UPLOAD_ROOT (Render Disk) ตาม URL /uploads/...
    try {
      const filePath = resolveUploadedFilePath(target.url);
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch { /* ignore */ }

    const updated = await prisma.warrantyItem.update({
      where: { id: itemId },
      data: { images: current.filter(im => im.id !== imageId) },
    });

    // ✅ ตาม requirement ใหม่: ไม่ส่งแจ้งเตือนฝั่งร้านจาก event ย่อย

    // ✅ AuditLog: DELETE_WARRANTY_ITEM_IMAGE (best-effort)
    await auditWarrantyItemBestEffort(req, 'DELETE_WARRANTY_ITEM_IMAGE', item, {
      before: jsonSafe({ item }),
      after: jsonSafe({ item: { ...updated, warranty: item.warranty } }),
      removedImage: jsonSafe(target),
      removedImageId: imageId,
    });

    return res.json({ data: { item: updated } });
  } catch (err) {
    console.error('deleteItemImage error', err);
    return res.status(500).json({ message: 'ลบรูปภาพไม่สำเร็จ' });
  }
}

/* ---------- แก้ไขข้อมูลหลักของรายการ (แนบรูปเพิ่มได้) ---------- */
export async function updateItem(req, res) {
  try {
    const { itemId } = req.params; // ❗️ id เป็น string

    // หา item + ตรวจสิทธิ์
    const item = await prisma.warrantyItem.findUnique({
      where: { id: itemId },
      include: { warranty: true },
    });
    if (!item) return res.status(404).json({ message: 'ไม่พบรายการสินค้า' });

    const userId = Number(req.user?.sub);
    if (!item.warranty || item.warranty.storeId !== userId) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ในรายการนี้' });
    }

    // map ชื่อจากฟอร์ม → คอลัมน์จริง (รองรับทั้งชื่อใหม่/เก่า)
    const b = req.body ?? {};

    const productName =
      b.productName !== undefined ? String(b.productName).trim() : item.productName;

    // ⭐ รองรับฟิลด์ "รุ่น" (model)
    //   - ฟอร์มใหม่จะส่ง b.model
    //   - เผื่ออนาคต/เดิมบางส่วนอาจส่ง productModel
    const model =
      b.model !== undefined
        ? (String(b.model).trim() || null)
        : (b.productModel !== undefined
          ? (String(b.productModel).trim() || null)
          : (item.model ?? null));

    const serial =
      b.serial !== undefined
        ? (String(b.serial).trim() || null)
        : (b.serialNo !== undefined
          ? (String(b.serialNo).trim() || null)
          : item.serial);

    const purchaseDate =
      toDateOnly(b.purchaseDate) ??
      toDateOnly(b.startDate) ??
      (item.purchaseDate ? new Date(item.purchaseDate) : null);

    let expiryDate =
      toDateOnly(b.expiryDate) ??
      toDateOnly(b.expireDate) ??
      (item.expiryDate ? new Date(item.expiryDate) : null);

    let durationMonths =
      b.durationMonths !== undefined
        ? Number(b.durationMonths)
        : (b.duration_months !== undefined
          ? Number(b.duration_months)
          : item.durationMonths);
    if (Number.isNaN(durationMonths)) durationMonths = item.durationMonths ?? null;

    // ถ้าไม่ได้ส่ง expiry แต่มี purchase + durationMonths → คำนวณให้
    if (!expiryDate && purchaseDate && Number(durationMonths) > 0) {
      expiryDate = addMonths(purchaseDate, Number(durationMonths));
    }

    const durationDays =
      purchaseDate && expiryDate ? daysBetween(purchaseDate, expiryDate) : item.durationDays ?? null;

    const coverageNote =
      b.coverageNote !== undefined
        ? String(b.coverageNote).trim()
        : (b.terms !== undefined ? String(b.terms).trim() : item.coverageNote);

    const note = b.note !== undefined ? String(b.note).trim() : item.note;

    // ✅ ราคาสินค้า (บาท) - optional
    const price =
      b.price !== undefined
        ? (b.price != null && b.price !== '' ? Number(b.price) || null : null)
        : (item.price ?? null);

    // ✅ รองรับ checkbox เงื่อนไข
    let selectedConditions = item.selectedConditions ?? null;
    if (b.selectedConditions !== undefined) {
      // Frontend ส่งมาเป็น JSON string (เพราะใช้ FormData)
      if (typeof b.selectedConditions === 'string') {
        try {
          selectedConditions = JSON.parse(b.selectedConditions);
        } catch {
          selectedConditions = [];
        }
      } else if (Array.isArray(b.selectedConditions)) {
        selectedConditions = b.selectedConditions;
      }
    }
    const customCondition =
      b.customCondition !== undefined
        ? String(b.customCondition).trim() || null
        : (item.customCondition ?? null);

    // รูปภาพแนบเพิ่ม (ต่อท้าย images เดิม หากมีไฟล์)
    const existedImages = Array.isArray(item.images) ? item.images : [];
    const newImages = (req.files || []).map(f => ({
      id: path.parse(f.filename).name,
      url: `${uploadSubPath}/${f.filename}`,
      originalName: f.originalname,
      mime: f.mimetype,
      size: f.size,
    }));

    const data = {
      productName,
      model, // ⭐ บันทึกฟิลด์รุ่น
      serial,
      price, // ✅ ราคาสินค้า (บาท)
      purchaseDate,
      expiryDate,
      durationMonths: durationMonths ?? null,
      durationDays,
      coverageNote,
      note,
      // ✅ บันทึก checkbox เงื่อนไข
      selectedConditions: Array.isArray(selectedConditions) ? selectedConditions : null,
      customCondition,
    };
    if (newImages.length) data.images = [...existedImages, ...newImages];

    // ❗️ห้าม include: { images: true } เพราะ images เป็น JSON ไม่ใช่ relation
    const updated = await prisma.warrantyItem.update({
      where: { id: itemId },
      data,
    });

    // Detect status change (active / nearing_expiration / expired)
    // ✅ ยังต้องคำนวณไว้เพื่อส่งแจ้งเตือนให้ "ลูกค้า" เท่านั้น
    let beforeStatus, afterStatus
    let statusChanged = false
    let otherChanged = false

    try {
      const prevExp = item.expiryDate ? toDateOnly(item.expiryDate) : null
      const newExp = updated.expiryDate ? toDateOnly(updated.expiryDate) : null

      // ไม่ดึง storeProfile ในไฟล์นี้ (item.include warranty:true) → ใช้ fallback 14
      const notifyDays = 14

      function deriveStatus(exp) {
        if (!exp) return 'active'
        const today = toDateOnly(new Date())
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (24 * 3600 * 1000))
        if (daysLeft < 0) return 'expired'
        if (daysLeft <= notifyDays) return 'nearing_expiration'
        return 'active'
      }

      beforeStatus = deriveStatus(prevExp)
      afterStatus = deriveStatus(newExp)

      statusChanged = beforeStatus !== afterStatus
      // ✅ ตาม requirement ใหม่: ไม่ส่งแจ้งเตือนฝั่งร้านจาก status change ที่นี่
    } catch (e) {
      console.warn('status-change compute error', e?.message || e)
    }

    // Detect other significant field changes (for deciding customer notify)
    try {
      otherChanged = (
        item.productName !== updated.productName ||
        (item.model || null) !== (updated.model || null) ||
        (item.serial || null) !== (updated.serial || null) ||
        (item.coverageNote || null) !== (updated.coverageNote || null) ||
        (item.note || null) !== (updated.note || null)
      )
      // ✅ ตาม requirement ใหม่: ไม่ส่งแจ้งเตือนฝั่งร้านจาก item updated ที่นี่
    } catch (e) {
      console.warn('item-change compute error', e?.message || e)
    }

    // ✅ Notify customer: single "warranty_updated" notification (+ email) with CHANGE DETAILS
    try {
      if (item.warranty?.customerUserId && (statusChanged || otherChanged)) {
        const { createAndPublish } = await import('../routes/notifications.routes.js')

        // Fetch names for template
        const customer = await prisma.user.findUnique({
          where: { id: item.warranty.customerUserId },
          select: {
            email: true,
            customerProfile: { select: { firstName: true, lastName: true } }
          }
        })
        const store = await prisma.user.findUnique({
          where: { id: item.warranty.storeId },
          select: {
            storeProfile: { select: { storeName: true, ownerName: true } }
          }
        })

        const cName = customer?.customerProfile
        const sName = store?.storeProfile

        const customerName = cName ? `${cName.firstName || ''} ${cName.lastName || ''}`.trim() : (customer?.email || 'ลูกค้า')
        const storeName = sName ? (sName.storeName || sName.ownerName || 'ร้านค้า') : 'ร้านค้า'


        const title = `[แจ้งเตือนสำคัญ] แก้ไขรายละเอียดใบรับประกัน สินค้า: ${updated.productName || '-'} (หมายเลขเครื่อง: ${updated.serial || '-'})`

        // ✅ Build detailed change list for email
        const changes = []
        const formatDate = (d) => {
          if (!d) return '-'
          const dt = new Date(d)
          return dt.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
        }

        // HTML helper for styling
        const htmlEscape = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

        if (item.productName !== updated.productName) {
          changes.push(`<div style="margin-bottom:8px;"><strong style="color:#2563eb;">📦 ชื่อสินค้า:</strong><br><span style="color:#ef4444;text-decoration:line-through;">${htmlEscape(item.productName) || '-'}</span> → <span style="color:#22c55e;font-weight:600;">${htmlEscape(updated.productName) || '-'}</span></div>`)
        }
        if ((item.model || null) !== (updated.model || null)) {
          changes.push(`<div style="margin-bottom:8px;"><strong style="color:#2563eb;">🏷️ รุ่น:</strong><br><span style="color:#ef4444;text-decoration:line-through;">${htmlEscape(item.model) || '-'}</span> → <span style="color:#22c55e;font-weight:600;">${htmlEscape(updated.model) || '-'}</span></div>`)
        }
        if ((item.serial || null) !== (updated.serial || null)) {
          changes.push(`<div style="margin-bottom:8px;"><strong style="color:#2563eb;">🔢 Serial:</strong><br><span style="color:#ef4444;text-decoration:line-through;">${htmlEscape(item.serial) || '-'}</span> → <span style="color:#22c55e;font-weight:600;">${htmlEscape(updated.serial) || '-'}</span></div>`)
        }
        if (String(item.purchaseDate || '') !== String(updated.purchaseDate || '')) {
          changes.push(`<div style="margin-bottom:8px;"><strong style="color:#2563eb;">📅 วันเริ่มประกัน:</strong><br><span style="color:#ef4444;text-decoration:line-through;">${formatDate(item.purchaseDate)}</span> → <span style="color:#22c55e;font-weight:600;">${formatDate(updated.purchaseDate)}</span></div>`)
        }
        if (String(item.expiryDate || '') !== String(updated.expiryDate || '')) {
          changes.push(`<div style="margin-bottom:8px;"><strong style="color:#2563eb;">⏰ วันหมดประกัน:</strong><br><span style="color:#ef4444;text-decoration:line-through;">${formatDate(item.expiryDate)}</span> → <span style="color:#22c55e;font-weight:600;">${formatDate(updated.expiryDate)}</span></div>`)
        }
        if ((item.durationMonths || null) !== (updated.durationMonths || null)) {
          changes.push(`<div style="margin-bottom:8px;"><strong style="color:#2563eb;">📆 ระยะเวลา:</strong><br><span style="color:#ef4444;text-decoration:line-through;">${item.durationMonths || '-'} เดือน</span> → <span style="color:#22c55e;font-weight:600;">${updated.durationMonths || '-'} เดือน</span></div>`)
        }
        if ((item.durationDays || null) !== (updated.durationDays || null)) {
          changes.push(`<div style="margin-bottom:8px;"><strong style="color:#2563eb;">📆 ระยะเวลา (วัน):</strong><br><span style="color:#ef4444;text-decoration:line-through;">${item.durationDays || '-'} วัน</span> → <span style="color:#22c55e;font-weight:600;">${updated.durationDays || '-'} วัน</span></div>`)
        }
        if ((item.coverageNote || null) !== (updated.coverageNote || null)) {
          changes.push(`<div style="margin-bottom:12px;"><strong style="color:#2563eb;">📋 เงื่อนไข/หมายเหตุ:</strong><br><div style="background:#fef2f2;border-left:3px solid #ef4444;padding:8px 12px;margin:4px 0;border-radius:4px;"><strong style="color:#991b1b;">ก่อน:</strong><br>${htmlEscape(item.coverageNote) || '-'}</div><div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:8px 12px;margin:4px 0;border-radius:4px;"><strong style="color:#166534;">หลัง:</strong><br>${htmlEscape(updated.coverageNote) || '-'}</div></div>`)
        }
        if (JSON.stringify(item.selectedConditions || []) !== JSON.stringify(updated.selectedConditions || [])) {
          const beforeList = (item.selectedConditions || []).map(c => `<li style="margin:2px 0;">${htmlEscape(c)}</li>`).join('') || '<li>-</li>'
          const afterList = (updated.selectedConditions || []).map(c => `<li style="margin:2px 0;">${htmlEscape(c)}</li>`).join('') || '<li>-</li>'
          changes.push(`<div style="margin-bottom:12px;"><strong style="color:#2563eb;">✅ รายการเงื่อนไข:</strong><br><div style="background:#fef2f2;border-left:3px solid #ef4444;padding:8px 12px;margin:4px 0;border-radius:4px;"><strong style="color:#991b1b;">ก่อน (${(item.selectedConditions || []).length} รายการ):</strong><ul style="margin:4px 0;padding-left:20px;">${beforeList}</ul></div><div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:8px 12px;margin:4px 0;border-radius:4px;"><strong style="color:#166534;">หลัง (${(updated.selectedConditions || []).length} รายการ):</strong><ul style="margin:4px 0;padding-left:20px;">${afterList}</ul></div></div>`)
        }
        if ((item.customCondition || null) !== (updated.customCondition || null)) {
          changes.push(`<div style="margin-bottom:12px;"><strong style="color:#2563eb;">✏️ เงื่อนไขเพิ่มเติม:</strong><br><div style="background:#fef2f2;border-left:3px solid #ef4444;padding:8px 12px;margin:4px 0;border-radius:4px;"><strong style="color:#991b1b;">ก่อน:</strong><br>${htmlEscape(item.customCondition) || '-'}</div><div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:8px 12px;margin:4px 0;border-radius:4px;"><strong style="color:#166534;">หลัง:</strong><br>${htmlEscape(updated.customCondition) || '-'}</div></div>`)
        }

        // Build body with styled HTML change details
        let body = `<div style="font-size:16px;line-height:1.6;color:#374151;">
          <p>เรียนคุณ <strong>${htmlEscape(customerName)}</strong>,</p>
          <p>ร้านค้า <strong>${htmlEscape(storeName)}</strong> ได้ดำเนินการปรับปรุงข้อมูลใน <strong>ใบรับประกันสินค้า (Digital Warranty)</strong> ของคุณ เพื่อให้ข้อมูลถูกต้องตามเงื่อนไขการรับประกันล่าสุด โดยมีรายละเอียดการเปลี่ยนแปลงดังนี้:</p>
        </div>`
        if (changes.length > 0) {
          body += `<div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;"><div style="font-size:16px;font-weight:700;color:#1e40af;margin-bottom:12px;">📝 รายละเอียดการเปลี่ยนแปลง</div>${changes.join('')}</div>`
        }
        body += `<div style="margin-top:12px;padding:10px 14px;background:#eff6ff;border-radius:8px;color:#1e40af;font-size:13px;">⏰ <strong>เวลาอัปเดต:</strong> ${new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok' })}</div>`

        await createAndPublish({
          prisma, attrs: {
            userId: item.warranty.customerUserId,
            title,
            body, // plain text fallback
            htmlBody: body, // ✅ Send HTML body for styled email
            data: {
              type: 'warranty_updated',
              warrantyId: updated.warrantyId,
              warrantyItemId: updated.id,
              oldStatus: typeof beforeStatus !== 'undefined' ? beforeStatus : null,
              newStatus: typeof afterStatus !== 'undefined' ? afterStatus : null,
              changes: changes, // ✅ Include changes in data for frontend
            },
            sendEmail: true
          }
        })
      }
    } catch (e) {
      console.warn('notify customer warranty_updated failed', e?.message || e)
    }

    // ✅ AuditLog: UPDATE_WARRANTY_ITEM (best-effort)
    await auditWarrantyItemBestEffort(req, 'UPDATE_WARRANTY_ITEM', item, {
      before: jsonSafe({ item }),
      after: jsonSafe({ item: { ...updated, warranty: item.warranty } }),
      addedImages: newImages.length ? jsonSafe(newImages) : null,
      status: (typeof beforeStatus !== 'undefined' && typeof afterStatus !== 'undefined')
        ? { before: beforeStatus, after: afterStatus }
        : null,
    });

    return res.json({
      data: {
        item: {
          ...updated,
          images: (updated.images || []).map(im => ({
            ...im,
            absoluteUrl: `${publicBase}${im.url}`,
          })),
        },
      },
    });
  } catch (err) {
    console.error('updateItem error', err);
    return res.status(500).json({ message: 'ไม่สามารถบันทึกการแก้ไขรายการสินค้าได้' });
  }
}
