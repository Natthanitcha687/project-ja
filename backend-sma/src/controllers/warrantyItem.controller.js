import { prisma } from '../db/prisma.js';
import fs from 'fs';
import path from 'path';
import { uploadSubPath } from '../middleware/uploadImages.js';

const publicBase =
  (process.env.APP_URL && process.env.APP_URL.replace(/\/+$/, '')) ||
  `http://localhost:${process.env.PORT || 4000}`;

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

    // ลบไฟล์จริง (ถ้ามี)
    try {
      const filePath = path.resolve(process.cwd(), `.${target.url}`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch { /* ignore */ }

    const updated = await prisma.warrantyItem.update({
      where: { id: itemId },
      data: { images: current.filter(im => im.id !== imageId) },
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
      purchaseDate,
      expiryDate,
      durationMonths: durationMonths ?? null,
      durationDays,
      coverageNote,
      note,
    };
    if (newImages.length) data.images = [...existedImages, ...newImages];

    // ❗️ห้าม include: { images: true } เพราะ images เป็น JSON ไม่ใช่ relation
    const updated = await prisma.warrantyItem.update({
      where: { id: itemId },
      data,
    });

    // Detect status change (active / nearing_expiration / expired) and notify
    try {
      const prevExp = item.expiryDate ? toDateOnly(item.expiryDate) : null
      const newExp = updated.expiryDate ? toDateOnly(updated.expiryDate) : null
      const store = item.warranty?.store
      const notifyDays = store?.storeProfile?.notifyDaysInAdvance ?? 14

      function deriveStatus(exp) {
        if (!exp) return 'active'
        const today = toDateOnly(new Date())
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (24 * 3600 * 1000))
        if (daysLeft < 0) return 'expired'
        if (daysLeft <= notifyDays) return 'nearing_expiration'
        return 'active'
      }

      // compute before/after once and reuse for other-change detection below
      const before = deriveStatus(prevExp)
      const after = deriveStatus(newExp)
      if (before !== after) {
        const { createAndPublish } = await import('../routes/notifications.routes.js')
        const title = `สถานะรับประกันเปลี่ยน: ${after}`
        const body = `สินค้า \"${updated.productName}\" (Serial: ${updated.serial || '-'}) เปลี่ยนสถานะจาก ${before} → ${after}`
        // notify store
        try {
          await createAndPublish({ prisma, attrs: {
            storeId: item.warranty.storeId,
            title,
            body,
            data: { type: 'warranty_status_changed', warrantyId: updated.warrantyId, warrantyItemId: updated.id, oldStatus: before, newStatus: after }
          } })
        } catch (e) { console.warn('notify store status change failed', e?.message || e) }

        // notify customer user if present
        if (item.warranty.customerUserId) {
          try {
            await createAndPublish({ prisma, attrs: {
              userId: item.warranty.customerUserId,
              title,
              body,
              data: { type: 'warranty_status_changed', warrantyId: updated.warrantyId, warrantyItemId: updated.id, oldStatus: before, newStatus: after }
            } })
          } catch (e) { console.warn('notify customer status change failed', e?.message || e) }
        }
      }
    } catch (e) {
      console.warn('status-change notify error', e?.message || e)
    }

    // Detect other significant field changes (productName, model, serial, coverageNote, note)
    try {
      const otherChanged = (
        item.productName !== updated.productName ||
        (item.model || null) !== (updated.model || null) ||
        (item.serial || null) !== (updated.serial || null) ||
        (item.coverageNote || null) !== (updated.coverageNote || null) ||
        (item.note || null) !== (updated.note || null)
      )
      // only notify as 'item updated' when the status did not change (we handled status separately)
      if (otherChanged && typeof before !== 'undefined' && before === after) {
        const { createAndPublish } = await import('../routes/notifications.routes.js')
        const title = `รายการสินค้าถูกแก้ไข`
        const body = `รายการ "${updated.productName}" ถูกแก้ไข โดยร้านค้า`;
        try {
          await createAndPublish({ prisma, attrs: {
            storeId: item.warranty.storeId,
            title,
            body,
            data: { type: 'warranty_item_updated', warrantyId: updated.warrantyId, warrantyItemId: updated.id }
          } })
        } catch (e) { console.warn('notify store item updated failed', e?.message || e) }

        if (item.warranty.customerUserId) {
          try {
            await createAndPublish({ prisma, attrs: {
              userId: item.warranty.customerUserId,
              title,
              body,
              data: { type: 'warranty_item_updated', warrantyId: updated.warrantyId, warrantyItemId: updated.id }
            } })
          } catch (e) { console.warn('notify customer item updated failed', e?.message || e) }
        }
      }
    } catch (e) {
      console.warn('item-update notify error', e?.message || e)
    }

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
