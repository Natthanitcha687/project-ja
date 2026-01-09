// backend-sma/src/routes/customer.routes.js
import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// รองรับทุกแบบ: default / named / CJS
import * as requireAuthMod from '../middleware/requireAuth.js'
import * as requireVerifiedMod from '../middleware/requireVerified.js'
import * as requireCustomerMod from '../middleware/requireCustomer.js'

import * as customerCtrl from '../controllers/customer.controller.js'

// interop ให้ทำงานได้ทั้ง default/named/CJS
function pickFn(mod, named) {
  return (typeof mod?.default === 'function' && mod.default)
    || (typeof mod?.[named] === 'function' && mod[named])
    || (typeof mod === 'function' && mod)
}
const requireAuth = pickFn(requireAuthMod, 'requireAuth')
const requireVerified = pickFn(requireVerifiedMod, 'requireVerified')
const requireCustomer = pickFn(requireCustomerMod, 'requireCustomer')

const router = Router()

/* =========================
 * ✅ Upload for Complaint Images (NEW)
 * ========================= */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ✅ IMPORTANT (Render Disk):
// - ถ้ามี UPLOAD_ROOT -> เก็บไฟล์ลง disk ถาวร เช่น /var/data/uploads
// - ถ้าไม่มี -> fallback ใช้โฟลเดอร์เดิมในโปรเจกต์ (src/uploads)
const uploadRoot = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.resolve(__dirname, '../uploads')

// เก็บที่: <uploadRoot>/complaints
const complaintUploadDir = path.join(uploadRoot, 'complaints')

// กัน ENOENT: สร้างโฟลเดอร์ทุกครั้งก่อนเขียน (เผื่อย้าย/ลบระหว่างรัน)
function ensureComplaintDir() {
  try {
    fs.mkdirSync(complaintUploadDir, { recursive: true })
  } catch (_) { /* ignore */ }
}
ensureComplaintDir()

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureComplaintDir()
    cb(null, complaintUploadDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || ''
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : ''
    const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`
    cb(null, name)
  },
})

const uploadComplaintImages = multer({
  storage,
  limits: {
    files: 5,
    fileSize: 5 * 1024 * 1024, // 5MB/ไฟล์
  },
  fileFilter: (_req, file, cb) => {
    const ok = (file?.mimetype || '').startsWith('image/')
    // ✅ ให้สอดคล้องกับ error handler ใน server.js (จะตอบ 400 แทน 500)
    cb(ok ? null : new Error('รองรับเฉพาะไฟล์รูปภาพ (JPEG, JPG, PNG, GIF, WebP)'), ok)
  },
})

/* =========================
 *  โปรไฟล์ & รหัสผ่าน (NEW)
 * ========================= */

/**
 * @openapi
 * /customer/profile:
 *   get:
 *     tags: [Customer]
 *     summary: ดึงโปรไฟล์ลูกค้าปัจจุบัน
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: OK
 *       '401':
 *         description: Unauthorized
 */
router.get(
  '/profile',
  requireAuth, requireVerified, requireCustomer,
  customerCtrl.getMyProfile
)

/**
 * @openapi
 * /customer/profile:
 *   patch:
 *     tags: [Customer]
 *     summary: แก้ไขข้อมูลลูกค้า(ยกเว้นอีเมล)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *     responses:
 *       '200': { description: อัปเดตแล้ว }
 *       '400': { description: Bad Request }
 *       '401': { description: Unauthorized }
 */
router.patch(
  '/profile',
  requireAuth, requireVerified, requireCustomer,
  customerCtrl.updateMyProfile
)

/**
 * @openapi
 * /customer/change-password:
 *   patch:
 *     tags: [Customer]
 *     summary: เปลี่ยนรหัสผ่านลูกค้า
 *     security: [{ bearerAuth: [] }]
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
router.patch(
  '/change-password',
  requireAuth, requireVerified, requireCustomer,
  customerCtrl.changeMyPassword
)

/* =========================
 *  ใบรับประกัน (EXISTING)
 * ========================= */

/**
 * @openapi
 * /customer/warranties:
 *   get:
 *     tags: [Customer]
 *     summary: ลูกค้าดึงใบรับประกันของตัวเอง (ค้นหา/ฟิลเตอร์)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: คำค้น (ชื่อสินค้า/รุ่น/ซีเรียล/หมายเลขใบ)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, nearing_expiration, expired]
 *         description: ตัวกรองสถานะ
 *     responses:
 *       '200': { description: OK }
 *       '401': { description: Unauthorized }
 */
router.get(
  '/warranties',
  requireAuth, requireVerified, requireCustomer,
  customerCtrl.getMyWarranties
)

/**
 * @openapi
 * /customer/warranty-items/{itemId}/note:
 *   patch:
 *     tags: [Customer]
 *     summary: ลูกค้าอัปเดตหมายเหตุในรายการสินค้า
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [note]
 *             properties:
 *               note: { type: string, maxLength: 2000 }
 *     responses:
 *       '200': { description: อัปเดตแล้ว }
 *       '400': { description: Bad Request }
 *       '401': { description: Unauthorized }
 */
router.patch(
  '/warranty-items/:itemId/note',
  requireAuth, requireVerified, requireCustomer,
  customerCtrl.updateMyNote
)

/**
 * @openapi
 * /customer/warranties/{warrantyId}/pdf:
 *   get:
 *     tags: [Customer]
 *     summary: ดาวน์โหลด PDF ใบรับประกันของตัวเอง
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: warrantyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: ไฟล์ PDF
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       '401': { description: Unauthorized }
 */
router.get(
  '/warranties/:warrantyId/pdf',
  requireAuth, requireVerified, requireCustomer,
  customerCtrl.getMyWarrantyPdf
)

/* =========================
 *  แจ้งปัญหา (NEW)
 * ========================= */

/**
 * @openapi
 * /customer/complaints:
 *   post:
 *     tags: [Customer]
 *     summary: ลูกค้าสร้างคำแจ้งปัญหา (รองรับแนบรูป)
 *     security: [{ bearerAuth: [] }]
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
  '/complaints',
  requireAuth, requireVerified, requireCustomer,
  uploadComplaintImages.array('images', 5), // ✅ เพิ่ม: รองรับแนบรูป
  customerCtrl.createMyComplaint
)

/**
 * @openapi
 * /customer/complaints:
 *   get:
 *     tags: [Customer]
 *     summary: ลูกค้าดูรายการแจ้งปัญหาของตัวเอง
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: OK }
 *       '401': { description: Unauthorized }
 */
router.get(
  '/complaints',
  requireAuth, requireVerified, requireCustomer,
  customerCtrl.listMyComplaints
)

export default router
