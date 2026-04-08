
import { prisma } from "../db/prisma.js";

export function clientInfo(req) {
    const xf = req.headers["x-forwarded-for"];
    const ipFromXf =
        typeof xf === "string"
            ? xf.split(",")[0].trim()
            : Array.isArray(xf)
                ? String(xf[0]).split(",")[0].trim()
                : null;

    const ip =
        ipFromXf ||
        req.headers["x-real-ip"]?.toString()?.trim() ||
        req.headers["cf-connecting-ip"]?.toString()?.trim() ||
        req.ip ||
        null;

    return {
        ip,
        userAgent: req.get("user-agent") || null,
    };
}

/**
 * logAudit(req, action, targetType?, targetId?, meta?, actorUserIdOverride?)
 * - meta ควรเป็น object/Json
 * - actorUserIdOverride ใช้กรณี login (ยังไม่มี req.user)
 */
export async function logAudit(
    req,
    action,
    targetType = null,
    targetId = null,
    meta = null,
    actorUserIdOverride = null
) {
    try {
        const { ip, userAgent } = clientInfo(req);

        const actorUserId =
            actorUserIdOverride != null
                ? Number(actorUserIdOverride)
                : req.user?.id
                    ? Number(req.user.id)
                    : null;

        await prisma.auditLog.create({
            data: {
                actorUserId,
                action,
                targetType,
                targetId: targetId ? String(targetId) : null,
                ip,
                userAgent,
                meta,
            },
        });
    } catch (e) {
        console.error("logAudit failed: ", e);
    }
}
