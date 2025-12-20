// backend-sma/src/routes/warranty.routes.js
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireVerified } from "../middleware/requireVerified.js";
import { requireStore } from "../middleware/requireStore.js";
import {
  downloadWarrantyPdf,
  getWarrantyHeader,
  updateWarrantyHeader, // ✅
} from "../controllers/warranty.controller.js";

const router = Router();

// ต้อง login -> ต้องยืนยันอีเมล -> ต้องเป็นร้านค้า
router.use(requireAuth, requireVerified, requireStore);

/**
 * @openapi
 * /warranties/{warrantyId}:
 *   get:
 *     tags: [Warranty]
 *     summary: อ่านข้อมูลของใบรับประกัน
 *     description: คืนข้อมูล header ของใบรับประกันตาม warrantyId
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: warrantyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: OK }
 *       '401': { description: Unauthorized }
 */
router.get("/:warrantyId", getWarrantyHeader);

/**
 * @openapi
 * /warranties/{warrantyId}:
 *   patch:
 *     tags: [Warranty]
 *     summary: แก้ไขข้อมูลระดับ "ใบ" (เช่น อีเมล/ข้อมูลลูกค้าในใบ)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: warrantyId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: ฟิลด์ที่อนุญาตให้แก้ไขในระดับใบรับประกัน
 *             properties:
 *               customerEmail: { type: string, format: email }
 *               customerPhone: { type: string }
 *               customerFirstName: { type: string }
 *               customerLastName: { type: string }
 *               notes: { type: string }
 *           examples:
 *             basic:
 *               summary: ตัวอย่างแก้ไขอีเมลลูกค้า
 *               value:
 *                 customerEmail: "customer@example.com"
 *     responses:
 *       '200': { description: อัปเดตแล้ว }
 *       '400': { description: Bad Request }
 *       '401': { description: Unauthorized }
 */
router.patch("/:warrantyId", updateWarrantyHeader);

/**
 * @openapi
 * /warranties/{warrantyId}/pdf:
 *   get:
 *     tags: [Warranty]
 *     summary: ดาวน์โหลดไฟล์ PDF ของใบรับประกัน
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
router.get("/:warrantyId/pdf", downloadWarrantyPdf);

export default router;
