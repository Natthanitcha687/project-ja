// src/routes/warrantyItem.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { requireStore } from '../middleware/requireStore.js';
import { uploadWarrantyImages } from '../middleware/uploadImages.js';
import {
  addItemImages,
  deleteItemImage,
  updateItem, // ⬅️ PATCH รองรับแนบรูปได้ในคำขอเดียว
} from '../controllers/warrantyItem.controller.js';

const router = Router();

// ต้องเป็นร้านค้า + ยืนยันอีเมล + login
router.use(requireAuth, requireVerified, requireStore);

/**
 * @openapi
 * /warranty-items/{itemId}:
 *   patch:
 *     tags: [WarrantyItem]
 *     summary: แก้ไขข้อมูลหลักของ "รายการ" และสามารถแนบรูปในคำขอเดียวกันได้
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
 *             $ref: '#/components/schemas/WarrantyItemPatchRequest'
 *           examples:
 *             json:
 *               summary: ตัวอย่างแก้ไขเป็น JSON
 *               value:
 *                 name: "Air Fryer"
 *                 model: "AF-2024"
 *                 serial: "SN001"
 *                 purchaseDate: "2025-10-01"
 *                 expiryDate: "2026-10-01"
 *                 coverageNote: "ครอบคลุมมอเตอร์ 12 เดือน"
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               model: { type: string }
 *               serial: { type: string }
 *               purchaseDate: { type: string, format: date }
 *               expiryDate: { type: string, format: date }
 *               coverageNote: { type: string }
 *               images:
 *                 type: array
 *                 description: อัปโหลดไฟล์รูปเพิ่ม (ฟิลด์ชื่อ images)
 *                 items:
 *                   type: string
 *                   format: binary
 *           encoding:
 *             images:
 *               style: form
 *               explode: true
 *     responses:
 *       '200': { description: อัปเดตแล้ว }
 *       '400': { description: Bad Request }
 *       '401': { description: Unauthorized }
 */
router.patch('/:itemId', uploadWarrantyImages, updateItem);

/**
 * @openapi
 * /warranty-items/{itemId}/images:
 *   post:
 *     tags: [WarrantyItem]
 *     summary: อัปโหลดรูปเพิ่มให้รายการ (เฉพาะรูปอย่างเดียว)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [images]
 *             properties:
 *               images:
 *                 type: array
 *                 description: แนบรูปหลายไฟล์ (≤5 ไฟล์, 5MB/ไฟล์ ตาม middleware)
 *                 items:
 *                   type: string
 *                   format: binary
 *           encoding:
 *             images:
 *               style: form
 *               explode: true
 *     responses:
 *       '200': { description: อัปโหลดสำเร็จ }
 *       '400': { description: Bad Request }
 *       '401': { description: Unauthorized }
 */
router.post('/:itemId/images', uploadWarrantyImages, addItemImages);

/**
 * @openapi
 * /warranty-items/{itemId}/images/{imageId}:
 *   delete:
 *     tags: [WarrantyItem]
 *     summary: ลบรูปภาพออกจากรายการ
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '204': { description: ลบแล้ว (No Content) }
 *       '401': { description: Unauthorized }
 */
router.delete('/:itemId/images/:imageId', deleteItemImage);

export default router;
