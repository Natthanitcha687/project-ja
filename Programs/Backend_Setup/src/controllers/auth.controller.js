// backend-sma/src/controllers/auth.controller.js
import { prisma } from '../db/prisma.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendVerificationEmail, sendPasswordResetEmail, sendLoginOtpEmail, sendAccountLockedEmail } from '../services/email.js'
import crypto from 'crypto'
import { logAudit, clientInfo } from '../services/audit.service.js'

// ✅ เพิ่มสำหรับ Google ID token verify
import { OAuth2Client } from 'google-auth-library'

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

/* =========================
 * Google OAuth (ID token)
 * ========================= */
function googleClientId() {
  const cid = (process.env.GOOGLE_CLIENT_ID || '').trim()
  if (!cid) {
    const err = new Error('GOOGLE_CLIENT_ID is missing')
    err.code = 'GOOGLE_CLIENT_ID_MISSING'
    throw err
  }
  return cid
}

function googleSignupExpiresIn() {
  // ปรับได้ใน env ถ้าต้องการ เช่น "15m"
  return (process.env.GOOGLE_SIGNUP_EXPIRES_IN || '15m').trim()
}

async function verifyGoogleCredential(idToken) {
  const cid = googleClientId()
  const client = new OAuth2Client(cid)

  const ticket = await client.verifyIdToken({
    idToken: String(idToken),
    audience: cid
  })

  const payload = ticket.getPayload() || {}

  const email = payload.email ? String(payload.email).trim().toLowerCase() : ''
  const sub = payload.sub ? String(payload.sub).trim() : ''
  const emailVerified = payload.email_verified

  if (!email || !sub) {
    const err = new Error('GOOGLE_TOKEN_INVALID')
    err.code = 'GOOGLE_TOKEN_INVALID'
    throw err
  }
  if (emailVerified === false) {
    const err = new Error('GOOGLE_EMAIL_NOT_VERIFIED')
    err.code = 'GOOGLE_EMAIL_NOT_VERIFIED'
    throw err
  }

  return {
    email,
    sub,
    givenName: payload.given_name ? String(payload.given_name).trim() : '',
    familyName: payload.family_name ? String(payload.family_name).trim() : '',
    name: payload.name ? String(payload.name).trim() : ''
  }
}

function signGoogleSignupToken(data) {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    const err = new Error('JWT_SECRET is missing')
    err.code = 'JWT_SECRET_MISSING'
    throw err
  }
  // typ กันสับสนกับ token ของ login ปกติ
  const payload = { typ: 'GOOGLE_SIGNUP', ...data }
  return jwt.sign(payload, secret, { expiresIn: googleSignupExpiresIn() })
}

function verifyGoogleSignupToken(token) {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    const err = new Error('JWT_SECRET is missing')
    err.code = 'JWT_SECRET_MISSING'
    throw err
  }
  try {
    const decoded = jwt.verify(String(token), secret)
    if (!decoded || decoded.typ !== 'GOOGLE_SIGNUP') {
      const err = new Error('GOOGLE_SIGNUP_TOKEN_INVALID')
      err.code = 'GOOGLE_SIGNUP_TOKEN_INVALID'
      throw err
    }
    return decoded
  } catch (e) {
    const err = new Error('GOOGLE_SIGNUP_TOKEN_INVALID')
    err.code = 'GOOGLE_SIGNUP_TOKEN_INVALID'
    throw err
  }
}

function normalizeRole(v) {
  const r = String(v || '').trim().toUpperCase()
  if (r === 'CUSTOMER' || r === 'STORE') return r
  return null
}

async function guardSuspendedUser(req, user) {
  // ✅ เช็ค lockedUntil (จาก login ผิด 5 ครั้ง)
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logSecurityEvent(req, 'USER_LOGIN_BLOCKED_LOCKED', {
      userId: user.id,
      email: user.email,
      meta: { lockedUntil: user.lockedUntil }
    })
    return {
      ok: false,
      status: 423,
      body: {
        message: 'บัญชีถูกระงับชั่วคราว 24 ชั่วโมง เนื่องจากเข้าสู่ระบบผิดพลาดหลายครั้ง',
        lockedUntil: user.lockedUntil
      }
    }
  }

  // ✅ ถ้า lockedUntil หมดแล้ว → reset
  if (user.lockedUntil && user.lockedUntil <= new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: null, failedLoginAttempts: 0, failedLoginAt: null }
    })
  }

  // ใช้ logic เดียวกับ login() สำหรับ suspended
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
      return { ok: true }
    }

    await logSecurityEvent(req, 'USER_LOGIN_BLOCKED_SUSPENDED', {
      userId: user.id,
      email: user.email
    })

    return {
      ok: false,
      status: 403,
      body: {
        message: 'บัญชีถูกระงับการใช้งาน',
        reason: user.suspendedReason || null,
        suspendedUntil: user.suspendedUntil || null
      }
    }
  }
  return { ok: true }
}

async function randomPasswordHash() {
  // กัน schema บังคับ passwordHash (ผู้ใช้ไม่ต้องรู้รหัสนี้)
  const random = crypto.randomBytes(32).toString('hex')
  return bcrypt.hash(random, 10)
}

/* =========================
 * OTP helpers (Email OTP login)
 * ========================= */
function isTrue(v) {
  const s = String(v ?? '').toLowerCase().trim()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

function addMinutes(date, minutes) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() + minutes)
  return d
}

function otpSecret() {
  // แนะนำตั้ง OTP_SECRET ใน .env (ถ้าไม่มีจะ fallback ไป JWT_SECRET)
  return process.env.OTP_SECRET || process.env.JWT_SECRET || 'dev-otp-secret'
}

function makeOtpCode() {
  // 6 หลัก
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

function makeChallengeId() {
  return crypto.randomBytes(16).toString('hex')
}

function hashOtp(code) {
  return crypto.createHmac('sha256', otpSecret()).update(String(code)).digest('hex')
}

function safeEqualHex(a, b) {
  try {
    const ab = Buffer.from(String(a), 'hex')
    const bb = Buffer.from(String(b), 'hex')
    if (ab.length !== bb.length) return false
    return crypto.timingSafeEqual(ab, bb)
  } catch {
    return false
  }
}

// ✅ เพิ่ม: Step-up OTP (ไม่ต้องกรอกทุกครั้ง)
// - ถ้า lastLoginAt เป็น null (ครั้งแรก) => ต้อง OTP
// - ถ้าไม่ได้ล็อกอินเกิน N วัน => ต้อง OTP
function otpStepupDays() {
  const raw = Number(process.env.EMAIL_OTP_STEPUP_DAYS || 7)
  if (!Number.isFinite(raw) || raw <= 0) return 7
  return raw
}

function shouldRequireOtpForLogin(user) {
  // เปิด OTP ก่อนค่อยคิด
  const enableOtp = isTrue(process.env.EMAIL_OTP_LOGIN)
  if (!enableOtp) return false

  const days = otpStepupDays()

  // ครั้งแรก (ไม่เคยล็อกอิน)
  if (!user?.lastLoginAt) return true

  const last = new Date(user.lastLoginAt)
  if (isNaN(last)) return true

  const diffMs = Date.now() - last.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= days
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

    // Block soft-deleted users
    if (user?.isDeleted) {
      await logSecurityEvent(req, 'USER_LOGIN_BLOCKED_DELETED', { userId: user.id, email: user.email })
      return res.status(403).json({ message: 'บัญชีถูกลบ' })
    }

    if (!user) {
      await logSecurityEvent(req, 'USER_LOGIN_FAIL', { email: email || null })
      return res.status(404).json({ message: 'ไม่พบอีเมลนี้ในระบบ กรุณาสมัครสมาชิกก่อน' })
    }

    // ✅ เช็คว่าถูก lock จาก failed login หรือไม่
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await logSecurityEvent(req, 'USER_LOGIN_BLOCKED_LOCKED', {
        userId: user.id,
        email: user.email,
        meta: { lockedUntil: user.lockedUntil }
      })
      return res.status(423).json({
        message: 'บัญชีถูกระงับชั่วคราว 24 ชั่วโมง เนื่องจากเข้าสู่ระบบผิดพลาดหลายครั้ง',
        lockedUntil: user.lockedUntil
      })
    }

    // ✅ ถ้า lockedUntil หมดแล้ว → reset
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: null, failedLoginAttempts: 0, failedLoginAt: null }
      })
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
      // ✅ นับ failed login attempts
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

      let attempts = user.failedLoginAttempts || 0
      // Reset counter ถ้าเกิน 1 ชั่วโมง
      if (!user.failedLoginAt || new Date(user.failedLoginAt) < oneHourAgo) {
        attempts = 0
      }
      attempts += 1

      const updateData = { failedLoginAttempts: attempts }
      if (attempts === 1) {
        updateData.failedLoginAt = now
      }

      // ✅ ครั้งที่ 5 → ล็อค 24 ชม. + ส่ง email
      if (attempts >= 5) {
        updateData.lockedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000)

        // ส่งอีเมลแจ้งเตือน (best-effort)
        try {
          await sendAccountLockedEmail({ to: user.email })
        } catch (e) {
          console.warn('sendAccountLockedEmail failed:', e?.message || e)
        }

        await logSecurityEvent(req, 'USER_LOGIN_LOCKED', {
          userId: user.id,
          email: user.email,
          meta: { attempts, lockedUntil: updateData.lockedUntil }
        })
      }

      await prisma.user.update({ where: { id: user.id }, data: updateData })

      await logSecurityEvent(req, 'USER_LOGIN_FAIL', { userId: user.id, email: user.email, meta: { attempts } })

      // ✅ Response ตามจำนวน attempts
      if (attempts === 4) {
        return res.status(401).json({
          message: 'รหัสผ่านไม่ถูกต้อง (เหลืออีก 1 ครั้ง ก่อนบัญชีจะถูกระงับ 24 ชม.)',
          warning: true,
          attemptsLeft: 1
        })
      }
      if (attempts >= 5) {
        return res.status(423).json({
          message: 'บัญชีถูกระงับ 24 ชั่วโมง เนื่องจากเข้าสู่ระบบผิดพลาด 5 ครั้ง',
          lockedUntil: updateData.lockedUntil
        })
      }

      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })
    }

    // ✅ Login สำเร็จ → Reset failed attempts
    if (user.failedLoginAttempts > 0 || user.failedLoginAt || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, failedLoginAt: null, lockedUntil: null }
      })
    }

    // ✅ บล็อคผู้ใช้ที่ยังไม่ยืนยันอีเมล
    if (!user.emailVerifiedAt) {
      await logSecurityEvent(req, 'USER_LOGIN_BLOCKED_UNVERIFIED', { userId: user.id, email: user.email })
      const resp = await ensureVerifyTokenAndSendEmail(user)
      return res.status(403).json(resp)
    }

    // ✅ Step-up OTP (ครั้งแรก/ไม่ได้ล็อกอินนาน)
    const needOtp = shouldRequireOtpForLogin(user)
    if (needOtp) {
      const OTP_EXPIRES_MIN = Number(process.env.OTP_EXPIRES_MIN || 10)
      const challengeId = makeChallengeId()
      const code = makeOtpCode()
      const codeHash = hashOtp(code)
      const expiresAt = addMinutes(new Date(), OTP_EXPIRES_MIN)
      const { ip, userAgent } = clientInfo(req)

      // invalidate OTP เก่า (กันค้าง)
      await prisma.emailOtp.updateMany({
        where: { userId: user.id, purpose: 'USER_LOGIN', usedAt: null },
        data: { usedAt: new Date() }
      })

      await prisma.emailOtp.create({
        data: {
          challengeId,
          userId: user.id,
          purpose: 'USER_LOGIN',
          codeHash,
          expiresAt,
          ip,
          userAgent
        }
      })

      try {
        await sendLoginOtpEmail({ to: user.email, code, minutes: OTP_EXPIRES_MIN })
      } catch (e) {
        await logSecurityEvent(req, 'USER_LOGIN_OTP_SEND_FAIL', { userId: user.id, email: user.email })
        return res.status(500).json({ message: 'ส่ง OTP ไม่สำเร็จ (ตรวจสอบการตั้งค่าอีเมล)' })
      }

      await logSecurityEvent(req, 'USER_LOGIN_OTP_SENT', { userId: user.id, email: user.email })

      return res.json({
        otpRequired: true,
        challengeId,
        expiresInSec: OTP_EXPIRES_MIN * 60,
        message: 'ส่งรหัส OTP ไปที่อีเมลแล้ว'
      })
    }

    // ✅ อัปเดต lastLoginAt (เฉพาะกรณีไม่ต้องใช้ OTP)
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // ✅ Audit Log
    await logAudit(req, 'USER_LOGIN', 'User', user.id, { method: 'password', role: user.role, result: 'SUCCESS' })

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

export async function verifyLoginOtp(req, res) {
  try {
    const { challengeId, code } = req.body || {}
    if (!challengeId || !code) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' })

    const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5)

    const row = await prisma.emailOtp.findUnique({
      where: { challengeId: String(challengeId) },
      include: { user: true }
    })

    if (!row || row.purpose !== 'USER_LOGIN') return res.status(400).json({ message: 'OTP ไม่ถูกต้อง' })
    if (row.usedAt) return res.status(400).json({ message: 'OTP ถูกใช้งานแล้ว' })
    if (row.expiresAt < new Date()) return res.status(400).json({ message: 'OTP หมดอายุแล้ว' })
    if (row.attempts >= OTP_MAX_ATTEMPTS) return res.status(429).json({ message: 'ใส่ OTP ผิดเกินจำนวนที่กำหนด' })

    const ok = safeEqualHex(hashOtp(code), row.codeHash)
    if (!ok) {
      const nextAttempts = row.attempts + 1
      await prisma.emailOtp.update({
        where: { challengeId: row.challengeId },
        data: {
          attempts: nextAttempts,
          usedAt: nextAttempts >= OTP_MAX_ATTEMPTS ? new Date() : null
        }
      })
      await logSecurityEvent(req, 'USER_LOGIN_OTP_FAIL', { userId: row.userId, email: row.user?.email })
      return res.status(401).json({ message: 'รหัส OTP ไม่ถูกต้อง' })
    }

    // กันกรณีถูกระงับ/ยังไม่ verify หลังจากขอ OTP ไปแล้ว
    if (row.user?.status === 'SUSPENDED') {
      return res.status(403).json({ message: 'บัญชีถูกระงับการใช้งาน' })
    }
    if (!row.user?.emailVerifiedAt) {
      await logSecurityEvent(req, 'USER_LOGIN_BLOCKED_UNVERIFIED', { userId: row.userId, email: row.user?.email })
      const resp = await ensureVerifyTokenAndSendEmail(row.user)
      return res.status(403).json(resp)
            // Block soft-deleted users
            if (row.user.isDeleted) {
              await logSecurityEvent(req, 'USER_LOGIN_BLOCKED_DELETED', { userId: row.user.id, email: row.user.email })
              return res.status(403).json({ message: 'บัญชีถูกลบ' })
            }
    }

    await prisma.$transaction([
      prisma.emailOtp.update({ where: { challengeId: row.challengeId }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: row.userId }, data: { lastLoginAt: new Date() } }),
      prisma.emailOtp.updateMany({
        where: { userId: row.userId, purpose: 'USER_LOGIN', usedAt: null },
        data: { usedAt: new Date() }
      })
    ])

    await logSecurityEvent(req, 'USER_LOGIN_OTP_SUCCESS', { userId: row.userId, email: row.user?.email })

    // ✅ Audit Log
    await logAudit(req, 'USER_LOGIN', 'User', row.userId, { method: 'otp', role: row.user?.role, result: 'SUCCESS' })

    const token = sign(row.user)
    return res.json({ token })
  } catch (err) {
    console.error('verifyLoginOtp error:', err)
    return res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}

export async function resendLoginOtp(req, res) {
  try {
    const { challengeId } = req.body || {}
    if (!challengeId) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' })

    const cooldown = Number(process.env.OTP_RESEND_COOLDOWN_SEC || 60)
    const OTP_EXPIRES_MIN = Number(process.env.OTP_EXPIRES_MIN || 10)

    const row = await prisma.emailOtp.findUnique({
      where: { challengeId: String(challengeId) },
      include: { user: true }
    })

    if (!row || row.purpose !== 'USER_LOGIN') return res.status(400).json({ message: 'OTP ไม่ถูกต้อง' })
    if (row.usedAt) return res.status(400).json({ message: 'OTP นี้ใช้ไปแล้ว' })
    if (row.expiresAt < new Date()) return res.status(400).json({ message: 'OTP หมดอายุแล้ว' })

    const ageSec = Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 1000)
    if (ageSec < cooldown) {
      return res.status(429).json({ message: `กรุณารอ ${cooldown - ageSec} วินาทีแล้วลองใหม่` })
    }

    const newChallengeId = makeChallengeId()
    const code = makeOtpCode()
    const codeHash = hashOtp(code)
    const expiresAt = addMinutes(new Date(), OTP_EXPIRES_MIN)
    const { ip, userAgent } = clientInfo(req)

    await prisma.$transaction([
      prisma.emailOtp.update({ where: { challengeId: row.challengeId }, data: { usedAt: new Date() } }),
      prisma.emailOtp.create({
        data: {
          challengeId: newChallengeId,
          userId: row.userId,
          purpose: 'USER_LOGIN',
          codeHash,
          expiresAt,
          ip,
          userAgent
        }
      })
    ])

    try {
      await sendLoginOtpEmail({ to: row.user.email, code, minutes: OTP_EXPIRES_MIN })
    } catch (e) {
      await logSecurityEvent(req, 'USER_LOGIN_OTP_SEND_FAIL', { userId: row.userId, email: row.user.email })
      return res.status(500).json({ message: 'ส่ง OTP ไม่สำเร็จ (ตรวจสอบการตั้งค่าอีเมล)' })
    }

    await logSecurityEvent(req, 'USER_LOGIN_OTP_SENT', { userId: row.userId, email: row.user.email })

    return res.json({
      otpRequired: true,
      challengeId: newChallengeId,
      expiresInSec: OTP_EXPIRES_MIN * 60,
      message: 'ส่งรหัส OTP รอบใหม่ไปที่อีเมลแล้ว'
    })
  } catch (err) {
    console.error('resendLoginOtp error:', err)
    return res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}

import fs from 'fs'

// ✅ Public Appeal (สำหรับคนโดนระงับ)
export async function submitAppeal(req, res) {
  try {
    const { email, reason } = req.body
    if (!email || !reason) {
      return res.status(400).json({ message: 'กรุณากรอกอีเมลและเหตุผล' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // return 200 เพื่อความปลอดภัย (ไม่ให้ harvest email) หรือ 404 แล้วแต่นโยบาย
      // แต่เคสนี้เป็น appeal ถ้าระบบบอกว่า "ส่งแล้ว" แต่จริงๆ ไม่ส่ง ผู้ใช้อาจงง
      // เอาแบบตรงไปตรงมา:
      return res.status(404).json({ message: 'ไม่พบอีเมลในระบบ' })
    }

    if (user.status !== 'SUSPENDED') {
      // ลบไฟล์ทิ้งถ้ามี
      if (req.files) {
        req.files.forEach((f) => {
          try {
            fs.unlinkSync(f.path)
          } catch { }
        })
      }
      return res.status(400).json({ message: 'บัญชีนี้ไม่ได้ถูกระงับการใช้งาน' })
    }

    // ✅ เช็คว่ามีคำร้องที่ "อยู่ระหว่างการดำเนินการ" อยู่แล้วหรือไม่ (กัน Spam)
    const existingAppeal = await prisma.complaint.findFirst({
      where: {
        userId: user.id,
        status: 'OPEN',
        // อาจจะเช็ค category ด้วยก็ได้ แต่เอาแค่ "มีเรื่องค้างอยู่" ก็พอ
      }
    })

    if (existingAppeal) {
      // ลบไฟล์ที่เพิ่งอัปโหลดมาทิ้ง (ถ้ามี) เพราะไม่ได้ใช้
      if (req.files) {
        req.files.forEach((f) => {
          try { fs.unlinkSync(f.path) } catch { }
        })
      }
      return res.status(400).json({ message: 'คุณมีคำร้องที่อยู่ระหว่างการดำเนินการแล้ว กรุณารอเจ้าหน้าที่ตรวจสอบ' })
    }

    // จัดการไฟล์รูป
    let images = []
    if (req.files && req.files.length > 0) {
      // ✅ Fix: ต้องมี /warranty-images ตามที่ middleware ตั้งไว้
      images = req.files.map((f) => `/uploads/warranty-images/${f.filename}`)
    }

    // สร้าง Complaint
    await prisma.complaint.create({
      data: {
        userId: user.id,
        subject: 'ยื่นอุทธรณ์/ขอปลดระงับ (จากระบบอัตโนมัติ)',
        message: `[Appeal] ผู้ใช้ขอยื่นอุทธรณ์\n\nเหตุผล: ${reason}\n\nสถานะปัจจุบัน: ถูกระงับ\nวันหมดระงับ: ${user.suspendedUntil ? user.suspendedUntil.toISOString() : 'ไม่มีกำหนด'}`,
        category: 'ยื่นอุทธรณ์',
        status: 'OPEN',
        images: images.length > 0 ? images : undefined
      }
    })

    // (Optional) อาจจะส่งเมลแจ้ง admin หรือแจ้ง user กลับว่าได้รับเรื่องแล้ว

    res.json({ ok: true, message: 'ส่งคำร้องสำเร็จ เจ้าหน้าที่จะพิจารณาและแจ้งผลทางอีเมล' })
  } catch (e) {
    console.error('submitAppeal error:', e)
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

// ✅ อัปเดตสถานะการดู Onboarding สำหรับผู้ใช้ปัจจุบัน
export async function markOnboardingSeen(req, res) {
  try {
    const userId = Number(req.user?.id || req.user?.sub)
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    const user = await prisma.user.update({
      where: { id: userId },
      data: { hasSeenOnboarding: true },
      include: { customerProfile: true, storeProfile: true },
    })

    res.json({ ok: true, user })
  } catch (err) {
    console.error('markOnboardingSeen error:', err)
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
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

// =========================
// Google Signup/Login Flow
// =========================

// POST /auth/google/start
// body: { credential, role, mode }   role: "CUSTOMER" | "STORE", mode: "signup" | "login"
export async function googleStart(req, res) {
  try {
    const { credential, role, mode } = req.body || {}
    if (!credential) return res.status(400).json({ message: 'credential is required' })

    const g = await verifyGoogleCredential(credential)
    const desiredRole = normalizeRole(role)
    const intent = String(mode || '').trim().toLowerCase()

    // ถ้ามีบัญชีแล้ว => login ได้เลย (ยกเว้นโหมดสมัคร)
    let user = await prisma.user.findUnique({
      where: { email: g.email },
      include: { customerProfile: true, storeProfile: true }
    })

    if (user) {
        // Block soft-deleted users (Google login path)
        if (user.isDeleted) {
          await logSecurityEvent(req, 'USER_LOGIN_BLOCKED_DELETED', { userId: user.id, email: user.email })
          return res.status(403).json({ message: 'บัญชีถูกลบ' })
        }

        const guard = await guardSuspendedUser(req, user)
      if (!guard.ok) return res.status(guard.status).json(guard.body)

      // ✅ โหมดสมัคร: ถ้ามีบัญชีอยู่แล้ว ให้แจ้งเตือน "มีบัญชีแล้ว/อีเมลถูกใช้แล้ว" (ห้ามล็อกอิน)
      if (intent === 'signup') {
        const msg =
          desiredRole && user.role !== desiredRole
            ? `อีเมลนี้ถูกใช้งานแล้ว (เป็นบัญชี ${user.role}) กรุณาเข้าสู่ระบบ`
            : 'มีบัญชีอยู่แล้ว หรืออีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ'
        return res.status(409).json({ message: msg, existing: true, role: user.role })
      }

      // ✅ NEW: กัน "ล็อกอินผิดฝั่ง" (role mismatch) และ log เป็น Google fail
      if (desiredRole && user.role !== desiredRole) {
        await logSecurityEvent(req, 'USER_LOGIN_GOOGLE_ROLE_MISMATCH', {
          userId: user.id,
          email: user.email,
          meta: { desiredRole, actualRole: user.role }
        })
        return res.status(403).json({
          message: `บัญชีนี้เป็น ${user.role} ไม่ใช่ ${desiredRole}`,
          role: user.role
        })
      }

      // ถ้าเคยสมัครแบบ email แต่ยังไม่ verify -> ให้ถือว่า verify ได้ (เพราะ Google ยืนยันอีเมลแล้ว)
      if (!user.emailVerifiedAt) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
          include: { customerProfile: true, storeProfile: true }
        })
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })

      await logSecurityEvent(req, 'USER_LOGIN_GOOGLE_SUCCESS', { userId: user.id, email: user.email })

      // ✅ Audit Log
      await logAudit(req, 'USER_LOGIN', 'User', user.id, { method: 'google', role: user.role, result: 'SUCCESS' })

      const token = sign(user)
      return res.json({ token, existing: true, role: user.role })
    }

    // ไม่มีบัญชี => ให้ไปกรอกข้อมูลเพิ่ม (หน้าแยกลูกค้า/ร้าน)
    const signupToken = signGoogleSignupToken({
      email: g.email,
      googleSub: g.sub,
      role: desiredRole, // อาจเป็น null ถ้าไม่ส่งมา
      givenName: g.givenName,
      familyName: g.familyName
    })

    await logSecurityEvent(req, 'USER_GOOGLE_START', {
      email: g.email,
      meta: { desiredRole: desiredRole || null }
    })

    return res.json({
      needsProfile: true,
      signupToken,
      email: g.email,
      givenName: g.givenName || null,
      familyName: g.familyName || null,
      role: desiredRole
    })
  } catch (err) {
    if (err?.code === 'GOOGLE_CLIENT_ID_MISSING') {
      return res.status(500).json({ message: 'GOOGLE_CLIENT_ID is missing' })
    }
    // ✅ NEW: log Google fail ตอน token ไม่ถูกต้อง/อีเมลไม่ verify
    if (err?.code === 'GOOGLE_TOKEN_INVALID' || err?.code === 'GOOGLE_EMAIL_NOT_VERIFIED') {
      const desiredRole = normalizeRole(req.body?.role)
      await logSecurityEvent(req, 'USER_LOGIN_GOOGLE_FAIL', {
        email: null,
        meta: { reason: err.code, desiredRole: desiredRole || null }
      })
      return res.status(401).json({ message: 'Google token ไม่ถูกต้อง' })
    }
    if (err?.code === 'JWT_SECRET_MISSING') {
      return res.status(500).json({ message: 'JWT_SECRET is missing' })
    }
    console.error('googleStart error:', err)
    return res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}

// POST /auth/google/complete/customer
// body: { signupToken, firstName, lastName, phone, isConsent }
export async function googleCompleteCustomer(req, res) {
  try {
    const { signupToken, firstName, lastName, phone, isConsent } = req.body || {}
    if (!signupToken) return res.status(400).json({ message: 'signupToken is required' })

    const d = verifyGoogleSignupToken(signupToken)
    const roleInToken = normalizeRole(d.role)
    if (roleInToken && roleInToken !== 'CUSTOMER') {
      return res.status(400).json({ message: 'role mismatch (expected CUSTOMER)' })
    }

    const email = String(d.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ message: 'email not found in signupToken' })

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' })

    const fn = String(firstName || d.givenName || '').trim()
    const ln = String(lastName || d.familyName || '').trim()
    const ph = String(phone || '').trim()
    if (!fn || !ln || !ph) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ: firstName, lastName, phone' })
    }

    const hash = await randomPasswordHash()

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        role: 'CUSTOMER',
        emailVerifiedAt: new Date(),
        customerProfile: {
          create: {
            firstName: fn,
            lastName: ln,
            phone: ph,
            isConsent: !!isConsent
          }
        }
      },
      include: { customerProfile: true }
    })

    await logSecurityEvent(req, 'USER_REGISTER_GOOGLE_SUCCESS', {
      userId: user.id,
      email: user.email,
      meta: { role: 'CUSTOMER' }
    })

    // ✅ Audit Log
    await logAudit(req, 'USER_LOGIN', 'User', user.id, { method: 'google-signup', role: 'CUSTOMER', result: 'SUCCESS' })

    const token = sign(user)
    return res.status(201).json({ token })
  } catch (err) {
    if (err?.code === 'GOOGLE_SIGNUP_TOKEN_INVALID') {
      return res.status(401).json({ message: 'signupToken ไม่ถูกต้องหรือหมดอายุ' })
    }
    if (err?.code === 'JWT_SECRET_MISSING') {
      return res.status(500).json({ message: 'JWT_SECRET is missing' })
    }
    console.error('googleCompleteCustomer error:', err)
    return res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}

// POST /auth/google/complete/store
// body: { signupToken, storeName, typeStore/storeType, ownerStore/ownerName, phone, address, timeAvailable/businessHours, isConsent }
export async function googleCompleteStore(req, res) {
  try {
    const {
      signupToken,
      storeName,
      typeStore,
      storeType: storeTypeRaw,
      ownerStore,
      ownerName: ownerNameRaw,
      phone,
      address,
      timeAvailable,
      businessHours: businessHoursRaw,
      isConsent
    } = req.body || {}

    if (!signupToken) return res.status(400).json({ message: 'signupToken is required' })

    const d = verifyGoogleSignupToken(signupToken)
    const roleInToken = normalizeRole(d.role)
    if (roleInToken && roleInToken !== 'STORE') {
      return res.status(400).json({ message: 'role mismatch (expected STORE)' })
    }

    const email = String(d.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ message: 'email not found in signupToken' })

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' })

    const storeType = (storeTypeRaw ?? typeStore)?.toString().trim()
    const ownerName = (ownerNameRaw ?? ownerStore)?.toString().trim()
    const businessHours = (businessHoursRaw ?? timeAvailable)?.toString().trim()

    const required = { storeName, storeType, ownerName, phone, address, businessHours }
    for (const [k, v] of Object.entries(required)) {
      if (!v || String(v).trim() === '') {
        return res.status(400).json({ message: `กรุณากรอกข้อมูลให้ครบ: ${k}` })
      }
    }

    const hash = await randomPasswordHash()

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        role: 'STORE',
        emailVerifiedAt: new Date(),
        storeProfile: {
          create: {
            storeName: String(storeName).trim(),
            storeType,
            ownerName,
            phone: String(phone).trim(),
            email,
            address: String(address).trim(),
            businessHours,
            isConsent: !!isConsent
          }
        }
      },
      include: { storeProfile: true }
    })

    await logSecurityEvent(req, 'USER_REGISTER_GOOGLE_SUCCESS', {
      userId: user.id,
      email: user.email,
      meta: { role: 'STORE' }
    })

    // ✅ Audit Log
    await logAudit(req, 'USER_LOGIN', 'User', user.id, { method: 'google-signup', role: 'STORE', result: 'SUCCESS' })

    const token = sign(user)
    return res.status(201).json({ token })
  } catch (err) {
    if (err?.code === 'GOOGLE_SIGNUP_TOKEN_INVALID') {
      return res.status(401).json({ message: 'signupToken ไม่ถูกต้องหรือหมดอายุ' })
    }
    if (err?.code === 'JWT_SECRET_MISSING') {
      return res.status(500).json({ message: 'JWT_SECRET is missing' })
    }
    console.error('googleCompleteStore error:', err)
    return res.status(500).json({ message: 'เกิดข้อผิดพลาด' })
  }
}
