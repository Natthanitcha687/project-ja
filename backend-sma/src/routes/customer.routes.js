// backend-sma/src/routes/customer.routes.js
import { Router } from 'express'

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

export default router
