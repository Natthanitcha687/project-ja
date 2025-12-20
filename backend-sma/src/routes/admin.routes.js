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
} from "../controllers/admin.controller.js";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Admin
 *     description: Admin APIs
 */

router.post("/auth/login", adminLogin);
router.get("/me", requireAuth, requireAdmin, adminMe);

router.get("/stats", requireAuth, requireAdmin, adminStats);

router.get("/stores", requireAuth, requireAdmin, listStores);
router.get("/users", requireAuth, requireAdmin, listUsers);
router.patch("/users/:id/status", requireAuth, requireAdmin, setUserStatus);

router.get("/security/events", requireAuth, requireAdmin, listSecurityEvents);
router.get("/logs", requireAuth, requireAdmin, listAuditLogs);

router.get("/complaints", requireAuth, requireAdmin, listComplaints);
router.patch("/complaints/:id/status", requireAuth, requireAdmin, setComplaintStatus);

export default router;
