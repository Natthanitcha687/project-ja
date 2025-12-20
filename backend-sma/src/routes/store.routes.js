// backend-sma/src/routes/store.routes.js
import { Router } from "express";
import {
  getStoreDashboard,
  updateStoreProfile,
  changeStorePassword,
  createWarranty,
} from "../controllers/store.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireStore } from "../middleware/requireStore.js";
import { requireVerified } from "../middleware/requireVerified.js";

const router = Router();

// ต้อง login -> ต้องยืนยันอีเมล -> ต้องเป็นร้าน/เจ้าของ storeId
router.use(requireAuth, requireVerified, requireStore);

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
 *           examples:
 *             basic:
 *               summary: ตัวอย่างการสร้างใบรับประกันหลายรายการ
 *               value:
 *                 customer:
 *                   firstName: "Somchai"
 *                   lastName: "Dee"
 *                   email: "somchai@example.com"
 *                   phone: "0812345678"
 *                 items:
 *                   - name: "Air Fryer"
 *                     model: "AF-2024"
 *                     serial: "SN001"
 *                     purchaseDate: "2025-10-01"
 *                     warrantyMonths: 12
 *                     coverageNote: "มอเตอร์ 12 เดือน"
 *                   - name: "Blender"
 *                     model: "BL-100"
 *                     serial: "SN002"
 *                     purchaseDate: "2025-10-01"
 *                     warrantyMonths: 6
 *     responses:
 *       '201': { description: สร้างสำเร็จ }
 *       '400': { description: Bad Request }
 *       '401': { description: Unauthorized }
 */
router.post("/:storeId/warranties", createWarranty);

export default router;
