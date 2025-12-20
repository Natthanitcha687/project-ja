// src/middleware/requireAuth.js
import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.get('Authorization') || ''
    const m = authHeader.match(/^Bearer\s+(.+)$/i)
    const token =
      (m && m[1]) ||
      req.cookies?.token ||
      req.cookies?.auth_token ||
      req.query?.token ||
      null

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (!payload || typeof payload !== 'object') {
      return res.status(401).json({ message: 'Invalid token' })
    }

    // normalize ให้มีทั้ง id และ sub
    req.user = { ...payload }
    if (req.user.sub != null && req.user.id == null) {
      req.user.id = req.user.sub
    }

    if (!req.user.id) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    next()
  } catch (err) {
    const isExpired = err?.name === 'TokenExpiredError'
    return res.status(401).json({ message: isExpired ? 'Token expired' : 'Invalid token' })
  }
}
