// src/routes/auth.routes.js
import { Router } from 'express'
import {
  registerCustomer,
  registerStore,
  resendVerification,
  verifyEmail,
  login,
  me,
  requestPasswordReset,
  resetPassword
} from '../controllers/auth.controller.js'
import jwt from 'jsonwebtoken'

const router = Router()

/**
 * Require Bearer JWT auth
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Missing token' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication & Account management
 */

/**
 * @openapi
 * /auth/register/customer:
 *   post:
 *     summary: สมัครสมาชิก (ลูกค้า)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName, phone]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *               isConsent: { type: boolean, default: false }
 *           example:
 *             email: farung120001@gmail.com
 *             password: "Phumkondee2548"
 *             firstName: "Alice"
 *             lastName: "Wong"
 *             phone: "0947953868"
 *             isConsent: true
 *     responses:
 *       200:
 *         description: สมัครสำเร็จและส่งอีเมลยืนยันแล้ว
 *       400:
 *         description: ข้อมูลไม่ครบ/อีเมลซ้ำ
 */
router.post('/register/customer', registerCustomer)

/**
 * @openapi
 * /auth/register/store:
 *   post:
 *     summary: สมัครสมาชิก (ร้านค้า)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, storeName, typeStore, ownerStore, phone, address, timeAvailable]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               storeName: { type: string }
 *               typeStore: { type: string }
 *               ownerStore: { type: string }
 *               phone: { type: string }
 *               address: { type: string }
 *               timeAvailable: { type: string }
 *               isConsent: { type: boolean, default: false }
 *           example:
 *             email: farung120001@gmail.com
 *             password: "Phumkondee2548"
 *             storeName: "My Store"
 *             typeStore: "Electronics"
 *             ownerStore: "Phumsudlor"
 *             phone: "0900000000"
 *             address: "123 Main Rd"
 *             timeAvailable: "Mon–Fri 9:00–18:00"
 *             isConsent: true
 *     responses:
 *       200:
 *         description: สมัครสำเร็จและส่งอีเมลยืนยันแล้ว
 *       400:
 *         description: ข้อมูลไม่ครบ/อีเมลซ้ำ
 */
router.post('/register/store', registerStore)

/**
 * @openapi
 * /auth/resend:
 *   post:
 *     summary: ส่งอีเมลยืนยันอีกครั้ง
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *           example:
 *             email: farung120001@gmail.com
 *     responses:
 *       200:
 *         description: ส่งอีเมลยืนยันแล้ว
 *       400:
 *         description: ไม่พบผู้ใช้ / ยืนยันไปแล้ว
 */
router.post('/resend', resendVerification)

/**
 * @openapi
 * /auth/verify:
 *   get:
 *     summary: ยืนยันอีเมลจากโทเคน
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         description: โทเคนสำหรับยืนยันอีเมล
 *     responses:
 *       200:
 *         description: ยืนยันอีเมลสำเร็จ
 *       400:
 *         description: โทเคนไม่ถูกต้อง/หมดอายุ
 */
router.get('/verify', verifyEmail)

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: ล็อกอิน
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *           example:
 *             email: farung120001@gmaail.com
 *             password: "Phumkondee2548"
 *     responses:
 *       200:
 *         description: สำเร็จ (ส่ง token + user)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     email: { type: string }
 *                     role: { type: string, enum: [CUSTOMER, STORE] }
 *                     emailVerifiedAt: { type: string, nullable: true }
 *       401:
 *         description: อีเมล/รหัสผ่านไม่ถูกต้อง
 */
router.post('/login', login)

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: ดึงข้อมูลผู้ใช้ปัจจุบัน (ต้องล็อกอิน)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: คืนข้อมูลผู้ใช้
 *       401:
 *         description: ไม่ได้ล็อกอินหรือโทเคนไม่ถูกต้อง
 */
router.get('/me', requireAuth, me)

/**
 * @openapi
 * /auth/forgot:
 *   post:
 *     summary: ขอรีเซ็ตรหัสผ่าน (ส่งอีเมลพร้อมโทเคน)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *           example:
 *             email: farung120001@gmail.com
 *     responses:
 *       200:
 *         description: ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว (หากอีเมลมีอยู่)
 */
router.post('/forgot', requestPasswordReset)

/**
 * @openapi
 * /auth/reset:
 *   post:
 *     summary: รีเซ็ตรหัสผ่านด้วยโทเคน
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 6 }
 *           example:
 *             token: "abcdef123456"
 *             password: "newSecret123"
 *     responses:
 *       200:
 *         description: รีเซ็ตรหัสผ่านสำเร็จ
 *       400:
 *         description: โทเคนไม่ถูกต้อง/หมดอายุ
 */
router.post('/reset', resetPassword)

export default router
