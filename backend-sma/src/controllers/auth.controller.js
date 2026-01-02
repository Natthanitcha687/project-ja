// backend-sma/src/controllers/auth.controller.js
import { prisma } from '../db/prisma.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.js'
import crypto from 'crypto'

// ========= helpers =========
function buildFrontendUrl(pathname, params = {}) {
  const base = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173'
  const url = new URL(pathname, base)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v ?? ''))
  return url.toString()
}

function addHours(date, hours) {
  const d = new Date(date)
  d.setHours(d.getHours() + hours)
  return d
}

function newRandomToken() {
  return crypto.randomBytes(24).toString('hex')
}

function clientInfo(req) {
  const ip =
    req.headers['x-forwarded-for']?.toString()?.split(',')[0]?.trim() ||
    req.ip ||
    null

  const userAgent = req.get('user-agent') || null
  return { ip, userAgent }
}

async function logSecurityEvent(req, type, payload = {}) {
  try {
    const { ip, userAgent } = clientInfo(req)
    await prisma.securityEvent.create({
      data: {
        type,
        ip,
        userAgent,
        ...payload
      }
    })
  } catch (e) {
    // best-effort (ไม่ให้ระบบพัง)
    console.log('⚠️ logSecurityEvent failed (ignored):', e?.message || e)
  }
}

function sign(user) {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    // ให้พฤติกรรมตรงกับ requireAuth (ที่บังคับต้องมี JWT_SECRET)
    const err = new Error('JWT_SECRET is missing')
    err.code = 'JWT_SECRET_MISSING'
    throw err
  }
  const payload = { sub: user.id, role: user.role, email: user.email }
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  return jwt.sign(payload, secret, { expiresIn })
}

async function ensureVerifyTokenAndSendEmail(user) {
  // หา token ที่ยังไม่หมดอายุ ถ้าไม่มีให้สร้างใหม่
  const existing = await prisma.verificationToken.findFirst({
    where: { userId: user.id, expiresAt: { gt: new Date() } }
  })

  let token = existing?.token
  if (!token) {
    token = newRandomToken()
    await prisma.verificationToken.create({
      data: { token, userId: user.id, expiresAt: addHours(new Date(), 24) }
    })
  }

  const verifyUrl = buildFrontendUrl('/verify-email', { token })
  try {
    await sendVerificationEmail({ to: user.email, verifyUrl })
  } catch (e) {
    console.error(e)
  }

  const resp = { message: 'กรุณายืนยันอีเมลก่อนใช้งาน', needsVerify: true }
  if (process.env.NODE_ENV !== 'production') resp.verifyUrl = verifyUrl
  return resp
}

// ========= controllers =========
export async function registerCustomer(req, res) {
  try {
    const { firstName, lastName, email, phone, password, isConsent } = req.body
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' })

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        role: 'CUSTOMER',
        customerProfile: { create: { firstName, lastName, phone, isConsent: !!isConsent } }
      },
      include: { customerProfile: true }
    })

    await prisma.verificationToken.deleteMany({ where: { userId: user.id } })
    const token = newRandomToken()
    await prisma.verificationToken.create({
      data: { token, userId: user.id, expiresAt: addHours(new Date(), 24) }
    })

    const verifyUrl = buildFrontendUrl('/verify-email', { token })
    let emailSent = false
    try {
      await sendVerificationEmail({ to: user.email, verifyUrl })
      emailSent = true
    } catch (e) {
      console.error(e)
    }

    const resp = {
      ok: true,
      message: emailSent ? 'ลงทะเบียนสำเร็จ โปรดยืนยันอีเมล' : 'ลงทะเบียนสำเร็จ (ส่งอีเมลไม่สำเร็จ)',
      emailSent
    }
    if (process.env.NODE_ENV !== 'production') resp.verifyUrl = verifyUrl
    return res.status(201).json(resp)
  } catch (err) {
    console.error('registerCustomer error:', err)
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}

export async function registerStore(req, res) {
  try {
    const {
      storeName,
      typeStore, // from frontend เก่า
      storeType: storeTypeRaw, // in case ส่งตรงตาม schema
      ownerStore,
      ownerName: ownerNameRaw,
      phone,
      address,
      timeAvailable,
      businessHours: businessHoursRaw,
      email,
      password,
      isConsent
    } = req.body

    const storeType = (storeTypeRaw ?? typeStore)?.toString().trim()
    const ownerName = (ownerNameRaw ?? ownerStore)?.toString().trim()
    const businessHours = (businessHoursRaw ?? timeAvailable)?.toString().trim()

    const required = { email, password, storeName, storeType, ownerName, phone, address, businessHours }
    for (const [k, v] of Object.entries(required)) {
      if (!v || String(v).trim() === '') {
        return res.status(400).json({ message: `กรุณากรอกข้อมูลให้ครบ: ${k}` })
      }
    }

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' })

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        role: 'STORE',
        storeProfile: {
          create: {
            storeName,
            storeType,
            ownerName,
            phone,
            email,
            address,
            businessHours,
            isConsent: !!isConsent
          }
        }
      },
      include: { storeProfile: true }
    })

    await prisma.verificationToken.deleteMany({ where: { userId: user.id } })
    const token = newRandomToken()
    await prisma.verificationToken.create({
      data: { token, userId: user.id, expiresAt: addHours(new Date(), 24) }
    })

    const verifyUrl = buildFrontendUrl('/verify-email', { token })
    let emailSent = false
    try {
      await sendVerificationEmail({ to: user.email, verifyUrl })
      emailSent = true
    } catch (e) {
      console.error(e)
    }

    const resp = {
      ok: true,
      message: emailSent ? 'ลงทะเบียนสำเร็จ โปรดยืนยันอีเมล' : 'ลงทะเบียนสำเร็จ (ส่งอีเมลไม่สำเร็จ)',
      emailSent
    }
    if (process.env.NODE_ENV !== 'production') resp.verifyUrl = verifyUrl
    res.status(201).json(resp)
  } catch (err) {
    console.error('registerStore error:', err)
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}

export async function resendVerification(req, res) {
  try {
    const { email } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ message: 'ไม่พบบัญชีนี้' })
    if (user.emailVerifiedAt) return res.status(400).json({ message: 'ยืนยันอีเมลแล้ว' })

    await prisma.verificationToken.deleteMany({ where: { userId: user.id } })
    const token = newRandomToken()
    await prisma.verificationToken.create({
      data: { token, userId: user.id, expiresAt: addHours(new Date(), 24) }
    })

    const verifyUrl = buildFrontendUrl('/verify-email', { token })
    let emailSent = false
    try {
      await sendVerificationEmail({ to: user.email, verifyUrl })
      emailSent = true
    } catch (e) {
      console.error(e)
    }

    const resp = { ok: true, message: emailSent ? 'ส่งอีเมลยืนยันแล้ว' : 'ส่งอีเมลไม่สำเร็จ', emailSent }
    if (process.env.NODE_ENV !== 'production') resp.verifyUrl = verifyUrl
    res.json(resp)
  } catch (err) {
    console.error('resendVerification error:', err)
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}

export async function verifyEmail(req, res) {
  try {
    const { token } = req.query
    const t = await prisma.verificationToken.findUnique({ where: { token: String(token) } })
    if (!t || t.expiresAt < new Date()) return res.status(400).json({ message: 'โทเคนไม่ถูกต้องหรือหมดอายุ' })

    await prisma.user.update({
      where: { id: t.userId },
      data: { emailVerifiedAt: new Date() }
    })
    await prisma.verificationToken.delete({ where: { token: t.token } })

    res.json({ ok: true, message: 'ยืนยันอีเมลสำเร็จ' })
  } catch (err) {
    console.error('verifyEmail error:', err)
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      await logSecurityEvent(req, 'USER_LOGIN_FAIL', { email: email || null })
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })
    }

    // ✅ กันผู้ใช้ถูกระงับ
    if (user.status === 'SUSPENDED') {
      if (user.suspendedUntil && user.suspendedUntil <= new Date()) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            status: 'ACTIVE',
            suspendedAt: null,
            suspendedReason: null,
            suspendedUntil: null
          }
        })
      } else {
        await logSecurityEvent(req, 'USER_LOGIN_BLOCKED_SUSPENDED', {
          userId: user.id,
          email: user.email
        })
        return res.status(403).json({
          message: 'บัญชีถูกระงับการใช้งาน',
          reason: user.suspendedReason || null,
          suspendedUntil: user.suspendedUntil || null
        })
      }
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      await logSecurityEvent(req, 'USER_LOGIN_FAIL', { userId: user.id, email: user.email })
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })
    }

    // ✅ บล็อคผู้ใช้ที่ยังไม่ยืนยันอีเมล
    if (!user.emailVerifiedAt) {
      await logSecurityEvent(req, 'USER_LOGIN_BLOCKED_UNVERIFIED', { userId: user.id, email: user.email })
      const resp = await ensureVerifyTokenAndSendEmail(user)
      return res.status(403).json(resp)
    }

    // ✅ อัปเดต lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    const token = sign(user)
    res.json({ token })
  } catch (err) {
    if (err?.code === 'JWT_SECRET_MISSING') {
      return res.status(500).json({ message: 'JWT_SECRET is missing' })
    }
    console.error('login error:', err)
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}

export async function me(req, res) {
  try {
    const userId = Number(req.user?.id || req.user?.sub)
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true, storeProfile: true }
    })

    if (!user) return res.status(401).json({ message: 'Unauthorized' })
    res.json({ user })
  } catch (err) {
    console.error('me error:', err)
    res.status(401).json({ message: 'Unauthorized' })
  }
}

export async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ message: 'ไม่พบบัญชีนี้' })

    const token = newRandomToken()
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt: addHours(new Date(), 2) }
    })

    const resetUrl = buildFrontendUrl('/reset-password', { token })
    let emailSent = false
    try {
      await sendPasswordResetEmail({ to: user.email, resetUrl })
      emailSent = true
    } catch (e) {
      console.error(e)
    }

    const resp = { ok: true, message: emailSent ? 'ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว' : 'ส่งอีเมลไม่สำเร็จ', emailSent }
    if (process.env.NODE_ENV !== 'production') resp.resetUrl = resetUrl
    res.json(resp)
  } catch (err) {
    console.error('requestPasswordReset error:', err)
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' })

    const row = await prisma.passwordResetToken.findUnique({ where: { token } })
    if (!row) return res.status(400).json({ message: 'โทเคนไม่ถูกต้อง' })
    if (new Date(row.expiresAt) < new Date()) return res.status(400).json({ message: 'โทเคนหมดอายุ' })

    const hash = await bcrypt.hash(password, 10)
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { passwordHash: hash } }),
      prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } })
    ])

    res.json({ ok: true, message: 'ตั้งรหัสผ่านใหม่สำเร็จ' })
  } catch (err) {
    console.error('resetPassword error:', err)
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}
