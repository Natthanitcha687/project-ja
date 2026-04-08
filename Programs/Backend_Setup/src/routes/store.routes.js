// backend-sma/src/routes/store.routes.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  getStoreDashboard,
  updateStoreProfile,
  changeStorePassword,
  createWarranty,

  // ✅ เพิ่ม
  createStoreComplaint,
  listStoreComplaints,
} from "../controllers/store.controller.js";

import { exportStoreWarranties } from "../controllers/export.controller.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireStore } from "../middleware/requireStore.js";
import { requireVerified } from "../middleware/requireVerified.js";

const router = Router();

// ต้อง login -> ต้องยืนยันอีเมล -> ต้องเป็นร้าน/เจ้าของ storeId
router.use(requireAuth, requireVerified, requireStore);

/* =========================
 * ✅ Upload for Complaint Images (เหมือน customer.routes.js)
 * ========================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ IMPORTANT (Render Disk):
// - ถ้ามี UPLOAD_ROOT -> เก็บไฟล์ลง disk ถาวร เช่น /var/data/uploads
// - ถ้าไม่มี -> fallback ใช้โฟลเดอร์เดิมในโปรเจกต์ (src/uploads)
const uploadRoot = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.resolve(__dirname, "../uploads");

// เก็บที่: <uploadRoot>/complaints
const complaintUploadDir = path.join(uploadRoot, "complaints");

// กัน ENOENT: สร้างโฟลเดอร์ทุกครั้งก่อนเขียน
function ensureComplaintDir() {
  try {
    fs.mkdirSync(complaintUploadDir, { recursive: true });
  } catch (_) {
    /* ignore */
  }
}
ensureComplaintDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureComplaintDir();
    cb(null, complaintUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || "";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : "";
    const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`;
    cb(null, name);
  },
});

const uploadComplaintImages = multer({
  storage,
  limits: {
    files: 5,
    fileSize: 5 * 1024 * 1024, // 5MB/ไฟล์
  },
  fileFilter: (_req, file, cb) => {
    const ok = (file?.mimetype || "").startsWith("image/");
    cb(ok ? null : new Error("รองรับเฉพาะไฟล์รูปภาพ (JPEG, JPG, PNG, GIF, WebP)"), ok);
  },
});

/**
 * @openapi
 * /store/{storeId}/dashboard:
 *   get:
 *     tags: [Store]
 *     summary: ดูข้อมูลแดชบอร์ดของร้าน
 *     description: ดึงสรุปและข้อมูลบนแดชบอร์ดของร้านตาม storeId
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: OK }
 *       '401': { description: Unauthorized }
 */
router.get("/:storeId/dashboard", getStoreDashboard);

/**
 * @openapi
 * /store/{storeId}/profile:
 *   patch:
 *     tags: [Store]
 *     summary: อัปเดตโปรไฟล์ร้าน
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeName: { type: string }
 *               phone: { type: string }
 *               address: { type: string }
 *     responses:
 *       '200': { description: อัปเดตแล้ว }
 *       '400': { description: Bad Request }
 *       '401': { description: Unauthorized }
 */
router.patch("/:storeId/profile", updateStoreProfile);

/**
 * @openapi
 * /store/{storeId}/change-password:
 *   post:
 *     tags: [Store]
 *     summary: เปลี่ยนรหัสผ่านของร้าน
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 6 }
 *     responses:
 *       '200': { description: เปลี่ยนรหัสสำเร็จ }
 *       '400': { description: Bad Request }
 *       '401': { description: Unauthorized }
 */
router.post("/:storeId/change-password", changeStorePassword);

/**
 * @openapi
 * /store/{storeId}/warranties:
 *   post:
 *     tags: [Store]
 *     summary: สร้างใบรับประกัน (รองรับสินค้าหลายรายการภายในใบเดียว)
 *     description: สร้างใบรับประกันใหม่ โดยส่ง items เป็นอาเรย์ของรายการสินค้า (การอัปโหลดรูปจะทำภายหลังใน endpoint ของ item)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               customer:
 *                 type: object
 *                 description: ข้อมูลผู้ซื้อ (ถ้ามี)
 *                 properties:
 *                   firstName: { type: string }
 *                   lastName: { type: string }
 *                   email: { type: string, format: email }
 *                   phone: { type: string }
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [name, serial]
 *                   properties:
 *                     name: { type: string, description: ชื่อสินค้า }
 *                     model: { type: string, description: รุ่นสินค้า (ถ้ามี) }
 *                     serial: { type: string, description: หมายเลขซีเรียล }
 *                     purchaseDate: { type: string, format: date, description: วันที่ซื้อ (YYYY-MM-DD) }
 *                     warrantyMonths:
 *                       type: integer
 *                       minimum: 0
 *                       description: จำนวนเดือนรับประกัน (ใช้คำนวณวันหมดอายุอัตโนมัติ)
 *                     coverageNote: { type: string, description: เงื่อนไข/ส่วนที่ครอบคลุม }
 *     responses:
 *       '201': { description: สร้างสำเร็จ }
 *       '400': { description: Bad Request }
 *       '401': { description: Unauthorized }
 */
router.post("/:storeId/warranties", createWarranty);

/* =========================
 *  แจ้งปัญหา (Store) - เหมือน customer
 * ========================= */

/**
 * @openapi
 * /store/{storeId}/complaints:
 *   post:
 *     tags: [Store]
 *     summary: ร้านค้าสร้างคำแจ้งปัญหา (รองรับแนบรูป)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [subject, message]
 *             properties:
 *               category: { type: string, nullable: true }
 *               subject: { type: string }
 *               message: { type: string }
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, message]
 *             properties:
 *               category: { type: string, nullable: true }
 *               subject: { type: string }
 *               message: { type: string }
 *     responses:
 *       '201': { description: Created }
 *       '400': { description: Bad Request }
 *       '401': { description: Unauthorized }
 */
router.post(
  "/:storeId/complaints",
  uploadComplaintImages.array("images", 5),
  createStoreComplaint
);

/**
 * @openapi
 * /store/{storeId}/complaints:
 *   get:
 *     tags: [Store]
 *     summary: ร้านค้าดูรายการแจ้งปัญหาของตัวเอง
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: OK }
 *       '401': { description: Unauthorized }
 */
router.get("/:storeId/complaints", listStoreComplaints);

/**
 * @openapi
 * /store/{storeId}/export-warranties:
 *   get:
 *     tags: [Store]
 *     summary: Export Warranty Data to Excel
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: File download }
 *       '401': { description: Unauthorized }
 */
router.get("/:storeId/export-warranties", exportStoreWarranties);

export default router;
