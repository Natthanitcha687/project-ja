// src/middleware/requireAuth.js
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma.js";

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.get("Authorization") || "";
    const m = authHeader.match(/^Bearer\s+(.+)$/i);

    const token =
      (m && m[1]) ||
      req.cookies?.token ||
      req.cookies?.auth_token ||
      req.query?.token ||
      null;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "JWT_SECRET is missing" });
    }

    const payload = jwt.verify(token, secret);
    if (!payload || typeof payload !== "object") {
      return res.status(401).json({ message: "Invalid token" });
    }

    // normalize ให้มีทั้ง id และ sub
    const u = { ...payload };
    if (u.sub != null && u.id == null) u.id = u.sub;

    const userId = Number(u.id);
    if (!userId || Number.isNaN(userId)) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // ✅ จุดสำคัญ: เช็คสถานะจาก DB ทุกครั้ง (กัน token เก่า)
    let dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        suspendedAt: true,
        suspendedReason: true,
        suspendedUntil: true, // ✅ ต้องมี field นี้ใน schema แล้ว migrate แล้ว
        isDeleted: true,
      },
    });

    if (!dbUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ✅ ถ้าถูกระงับ และมีวันหมดอายุ แล้วหมดอายุ → ปลดอัตโนมัติ
    if (dbUser.status === "SUSPENDED") {
      if (dbUser.suspendedUntil && dbUser.suspendedUntil <= new Date()) {
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            status: "ACTIVE",
            suspendedAt: null,
            suspendedReason: null,
            suspendedUntil: null,
          },
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            suspendedAt: true,
            suspendedReason: true,
            suspendedUntil: true,
          },
        });
      } else {
        // ✅ ยังไม่หมดเวลา/ถาวร → บล็อกทันที แม้ token เก่ายัง valid
        return res.status(403).json({
          message: "บัญชีถูกระงับการใช้งาน",
          reason: dbUser.suspendedReason || null,
          suspendedUntil: dbUser.suspendedUntil || null,
        });
      }
    }

    // ✅ ถ้าถูกลบแบบ soft-delete -> ปฏิเสธการเข้าถึงทันที
    if (dbUser.isDeleted) {
      return res.status(403).json({ message: "บัญชีถูกลบ" });
    }

    // ✅ ใส่ req.user ให้ downstream ใช้ต่อ
    req.user = {
      ...u,
      id: dbUser.id,
      sub: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status,
    };

    next();
  } catch (err) {
    const isExpired = err?.name === "TokenExpiredError";
    return res.status(401).json({ message: isExpired ? "Token expired" : "Invalid token" });
  }
}
