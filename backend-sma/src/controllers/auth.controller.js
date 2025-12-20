// backend-sma/src/controllers/auth.controller.js
import { prisma } from '../db/prisma.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.js'
import crypto from 'crypto'
import { createAndPublish as createNotification } from '../routes/notifications.routes.js'

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
function sign(user) {
  const payload = { sub: user.id, role: user.role, email: user.email }
  const secret = process.env.JWT_SECRET || 'dev-secret'
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  return jwt.sign(payload, secret, { expiresIn })
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
    try { await sendVerificationEmail({ to: user.email, verifyUrl }); emailSent = true } catch (e) { console.error(e) }
    const resp = { ok: true, message: emailSent ? 'ลงทะเบียนสำเร็จ โปรดยืนยันอีเมล' : 'ลงทะเบียนสำเร็จ (ส่งอีเมลไม่สำเร็จ)', emailSent }
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
      typeStore,               // from frontend เก่า
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
    try { await sendVerificationEmail({ to: user.email, verifyUrl }); emailSent = true } catch (e) { console.error(e) }

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
    try { await sendVerificationEmail({ to: user.email, verifyUrl }); emailSent = true } catch (e) { console.error(e) }
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
      // record failed attempt (no userId)
      try {
        await prisma.securityEvent.create({ data: { type: 'failed_login', email: email ?? null, ip: req.ip, userAgent: req.headers['user-agent'] ?? null, meta: { reason: 'no_user' } } })
      } catch (e) {}
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      // record failed login
      try {
        await prisma.securityEvent.create({ data: { type: 'failed_login', userId: user.id, email: user.email, ip: req.ip, userAgent: req.headers['user-agent'] ?? null, meta: { reason: 'bad_password' } } })
        // count recent failed attempts for this user (last 1 hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        const cnt = await prisma.securityEvent.count({ where: { userId: user.id, type: 'failed_login', createdAt: { gte: oneHourAgo } } })
        if (cnt >= 3) {
          // create notification + email to user
          try {
            await createNotification({ prisma, attrs: {
              userId: user.id,
              title: 'ความพยายามล็อกอินล้มเหลวหลายครั้ง',
              body: `มีการพยายามล็อกอินไปยังบัญชีของคุณไม่สำเร็จ ${cnt} ครั้งในชั่วโมงที่ผ่านมา หากไม่ใช่คุณ กรุณาตรวจสอบความปลอดภัยของบัญชี`,
              data: { type: 'suspicious_login_attempts', count: cnt }
            } })
          } catch (e) { console.warn('notify suspicious login failed', e?.message || e) }
        }
      } catch (e) {}
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })
    }

    // ✅ บล็อคผู้ใช้ที่ยังไม่ยืนยันอีเมล
    if (!user.emailVerifiedAt) {
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
      try { await sendVerificationEmail({ to: user.email, verifyUrl }) } catch (e) { console.error(e) }

      const resp = { message: 'กรุณายืนยันอีเมลก่อนใช้งาน', needsVerify: true }
      if (process.env.NODE_ENV !== 'production') resp.verifyUrl = verifyUrl
      return res.status(403).json(resp)
    }

    // record successful login event and update lastLoginAt
    try {
      await prisma.securityEvent.create({ data: { type: 'login', userId: user.id, email: user.email, ip: req.ip, userAgent: req.headers['user-agent'] ?? null } })
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    } catch (e) { console.warn('login event record failed', e?.message || e) }

    const token = sign(user)
    res.json({ token })
  } catch (err) {
    console.error('login error:', err)
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}

export async function me(req, res) {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ message: 'Unauthorized' })
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      include: { customerProfile: true, storeProfile: true }
    })
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
    try { await sendPasswordResetEmail({ to: user.email, resetUrl }); emailSent = true } catch (e) { console.error(e) }
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
