import { sendError } from "../utils/http.js";

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return sendError(res, 403, "อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น");
  }
  next();
}
