// backend-sma/src/routes/admin.routes.js
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  adminLogin,
  adminMe,
  adminStats,
  listStores,
  listUsers,
  setUserStatus,
  listSecurityEvents,
  listAuditLogs,
  listComplaints,
  setComplaintStatus,

  // ✅ เพิ่มสำหรับ UI จัดการร้านค้าตามรูป
  getStorePortal,
  deleteStoreAccount,

  // ✅ NEW: ลบบัญชีลูกค้า (ถาวร) + ส่งเมล + AuditLog
  deleteCustomerAccount,
} from "../controllers/admin.controller.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: API สำหรับผู้ดูแลระบบ (Admin)
 */

/* =========================
 * Auth (Admin)
 * ========================= */

/**
 * @swagger
 * /admin/auth/login:
 *   post:
 *     tags: [Admin]
 *     summary: Admin Login (รับ JWT token)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *           example:
 *             email: admin@example.com
 *             password: yourpassword
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 */
router.post("/auth/login", adminLogin);

/**
 * @swagger
 * /admin/me:
 *   get:
 *     tags: [Admin]
 *     summary: ดูข้อมูล Admin ที่ล็อกอินอยู่
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not admin)
 */
router.get("/me", requireAuth, requireAdmin, adminMe);

/* =========================
 * Overview / Stats
 * ========================= */

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: สถิติภาพรวมสำหรับหน้า Dashboard Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/stats", requireAuth, requireAdmin, adminStats);

/* =========================
 * Stores (ตามรูป)
 * ========================= */

/**
 * @swagger
 * /admin/stores:
 *   get:
 *     tags: [Admin]
 *     summary: รายการร้านค้า (ค้นหา/กรองสถานะ)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: คำค้นหา (email / storeName)
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: กรองสถานะ เช่น ACTIVE / SUSPENDED (เว้นว่าง=ทั้งหมด)
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/stores", requireAuth, requireAdmin, listStores);

/**
 * @swagger
 * /admin/stores/{id}/portal:
 *   get:
 *     tags: [Admin]
 *     summary: ข้อมูล Portal ของร้าน (ไว้เปิดใน modal)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Store not found
 */
router.get("/stores/:id/portal", requireAuth, requireAdmin, getStorePortal);

/**
 * @swagger
 * /admin/stores/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: ลบบัญชีร้านค้า (ถาวร)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: เหตุผลการลบ (ถ้ามี)
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Store not found
 */
router.delete("/stores/:id", requireAuth, requireAdmin, deleteStoreAccount);

/* =========================
 * Users / Status
 * ========================= */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: รายชื่อผู้ใช้ (ค้นหา/กรอง role)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string }
 *         description: CUSTOMER/STORE/ADMIN (เว้นว่าง=ทั้งหมด)
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: ค้นหา email
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/users", requireAuth, requireAdmin, listUsers);

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: ระงับ/ปลดระงับบัญชีผู้ใช้
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 description: สถานะใหม่ (ACTIVE / SUSPENDED)
 *               reason:
 *                 type: string
 *               days:
 *                 type: integer
 *                 description: จำนวนวัน (ถ้าระงับชั่วคราว)
 *           example:
 *             status: SUSPENDED
 *             reason: "ละเมิดเงื่อนไข"
 *             days: 7
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad request
 *       404:
 *         description: User not found
 */
router.patch("/users/:id/status", requireAuth, requireAdmin, setUserStatus);

/**
 * @swagger
 * /admin/customers/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: ลบบัญชีลูกค้า (ถาวร)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: เหตุผลการลบ (ถ้ามี)
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Customer not found
 */
router.delete("/customers/:id", requireAuth, requireAdmin, deleteCustomerAccount);

/* =========================
 * Security / Logs / Complaints
 * ========================= */

/**
 * @swagger
 * /admin/security/events:
 *   get:
 *     tags: [Admin]
 *     summary: ดู Security Events ล่าสุด
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/security/events", requireAuth, requireAdmin, listSecurityEvents);

/**
 * @swagger
 * /admin/audit/logs:
 *   get:
 *     tags: [Admin]
 *     summary: ดู Audit Logs ล่าสุด
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/audit/logs", requireAuth, requireAdmin, listAuditLogs);

/**
 * @swagger
 * /admin/complaints:
 *   get:
 *     tags: [Admin]
 *     summary: ดูรายการร้องเรียนทั้งหมด (กรอง status ได้)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: OPEN/IN_PROGRESS/RESOLVED/REJECTED (เว้นว่าง=ทั้งหมด)
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/complaints", requireAuth, requireAdmin, listComplaints);

/**
 * @swagger
 * /admin/complaints/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: เปลี่ยนสถานะคำร้องเรียน
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 description: OPEN/IN_PROGRESS/RESOLVED/REJECTED
 *           example:
 *             status: IN_PROGRESS
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad request
 */
router.patch("/complaints/:id/status", requireAuth, requireAdmin, setComplaintStatus);

export default router;