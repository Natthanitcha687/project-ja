import { sendError } from "../utils/http.js";

export function requireStore(req, res, next) {
  if (!req.user || req.user.role !== "STORE") {
    return sendError(res, 403, "อนุญาตเฉพาะบัญชีร้านค้าเท่านั้น");
  }
  next();
}
