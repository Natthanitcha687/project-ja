// src/routes/admin.routes.js
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
} from "../controllers/admin.controller.js";

const router = Router();

/* =========================
 * Auth (Admin)
 * ========================= */
router.post("/auth/login", adminLogin);
router.get("/me", requireAuth, requireAdmin, adminMe);

/* =========================
 * Overview / Stats
 * ========================= */
router.get("/stats", requireAuth, requireAdmin, adminStats);

/* =========================
 * Stores (ตามรูป)
 * ========================= */
router.get("/stores", requireAuth, requireAdmin, listStores);

// ✅ modal “Portal”
router.get("/stores/:id/portal", requireAuth, requireAdmin, getStorePortal);

// ✅ modal “ลบบัญชี”
router.delete("/stores/:id", requireAuth, requireAdmin, deleteStoreAccount);

/* =========================
 * Users / Status
 * ========================= */
router.get("/users", requireAuth, requireAdmin, listUsers);

// ✅ modal “ระงับบัญชี / ปลดระงับ”
router.patch("/users/:id/status", requireAuth, requireAdmin, setUserStatus);

/* =========================
 * Security / Logs / Complaints
 * ========================= */
router.get("/security/events", requireAuth, requireAdmin, listSecurityEvents);
router.get("/audit/logs", requireAuth, requireAdmin, listAuditLogs);

router.get("/complaints", requireAuth, requireAdmin, listComplaints);
router.patch("/complaints/:id/status", requireAuth, requireAdmin, setComplaintStatus);

export default router;
