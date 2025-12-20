// src/lib/api.js
import axios from 'axios'

export const API_URL =
  (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.replace(/\/+$/, '')) ||
  'http://localhost:4000'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

/* ===== helpers ===== */
export function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || ''
}

export function setToken(token, { persist = true } = {}) {
  if (!token) return clearToken()
  const store = persist ? localStorage : sessionStorage
  store.setItem('token', token)
  api.defaults.headers.common.Authorization = `Bearer ${token}`
}

export function clearToken() {
  localStorage.removeItem('token')
  sessionStorage.removeItem('token')
  delete api.defaults.headers.common.Authorization
}

/* ===== small helpers for global redirect/events ===== */
function safeRedirectToSignIn(query = '') {
  try {
    const path = window.location?.pathname || ''
    // กัน redirect loop ถ้าอยู่หน้า signin อยู่แล้ว
    if (path.startsWith('/signin')) return
    window.location.assign(`/signin${query}`)
  } catch {
    // ignore
  }
}

function readApiMessage(err) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    ''
  )
}

function isSuspendedError(err) {
  const status = err?.response?.status
  if (status !== 403) return false

  const code = err?.response?.data?.code
  if (code && String(code).toUpperCase().includes('SUSPEND')) return true

  const msg = readApiMessage(err)
  // รองรับข้อความที่เราใช้ใน backend
  return (
    msg.includes('บัญชีถูกระงับ') ||
    msg.toLowerCase().includes('suspend')
  )
}

/* ===== Axios: ใส่ token ให้ทุก request ===== */
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status
    const msg = readApiMessage(err)

    // ✅ เคส 401: token ใช้ไม่ได้ / หมดอายุ / ไม่ผ่าน requireAuth
    if (status === 401) {
      // ล้าง token ทิ้ง เพื่อไม่ให้ “token เก่า” เรียก API ต่อได้
      clearToken()

      // ยิง event เผื่อบางหน้าจะฟังเพื่อโชว์ toast
      try {
        window.dispatchEvent(
          new CustomEvent('auth:unauthorized', { detail: { message: msg || 'Unauthorized' } })
        )
      } catch {}

      // redirect ไปหน้า signin
      safeRedirectToSignIn('?reason=unauthorized')
    }

    // ✅ เคส 403 แบบ “ถูกระงับ”
    if (isSuspendedError(err)) {
      clearToken()

      // เก็บ detail เผื่ออยากโชว์เหตุผล/วันหมดระงับในหน้า signin
      const reason = err?.response?.data?.reason || null
      const suspendedUntil = err?.response?.data?.suspendedUntil || null

      try {
        window.dispatchEvent(
          new CustomEvent('auth:suspended', {
            detail: {
              message: msg || 'Account suspended',
              reason,
              suspendedUntil,
            },
          })
        )
      } catch {}

      safeRedirectToSignIn('?reason=suspended')
    }

    return Promise.reject(err)
  }
)

/* ===== ตั้งค่าเริ่มต้นตอนบูต ===== */
const bootToken = getToken()
if (bootToken) {
  api.defaults.headers.common.Authorization = `Bearer ${bootToken}`
}

/* =========================================================================
   PATCH fetch(): ใส่ Authorization ให้อัตโนมัติสำหรับคำขอไปยัง API
   - ครอบคลุมกรณีที่บางหน้าใช้ window.fetch โดยไม่ได้ใช้ api ของ axios
   ========================================================================= */
const API_ORIGIN = (() => {
  try {
    return new URL(API_URL).origin
  } catch {
    return ''
  }
})()

if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const _fetch = window.fetch.bind(window)

  window.fetch = async (input, init = {}) => {
    // แปลงเป็น URL เพื่อเช็คปลายทาง
    let urlStr = ''
    if (typeof input === 'string') urlStr = input
    else if (input && typeof input.url === 'string') urlStr = input.url

    // ระบุว่าเป็น relative หรือไปยัง API_ORIGIN เดียวกัน
    let shouldAttach = false
    try {
      if (!urlStr) {
        shouldAttach = true // fallback แนบไว้
      } else if (/^https?:\/\//i.test(urlStr)) {
        const u = new URL(urlStr)
        shouldAttach = u.origin === API_ORIGIN
      } else {
        shouldAttach = true
      }
    } catch {
      shouldAttach = true
    }

    if (shouldAttach) {
      const token = getToken()
      if (token) {
        const headers = new Headers(
          init.headers ||
            (typeof input !== 'string' && input && input.headers) ||
            {}
        )
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`)
        }
        init = { ...init, headers }
      }
    }

    const res = await _fetch(input, init)

    // ✅ สำคัญ: ถ้า fetch เจอ 401/403(ระงับ) ก็ล้าง token + เด้งหน้า signin เหมือน axios
    try {
      if (res.status === 401) {
        clearToken()
        try {
          window.dispatchEvent(
            new CustomEvent('auth:unauthorized', { detail: { message: 'Unauthorized' } })
          )
        } catch {}
        safeRedirectToSignIn('?reason=unauthorized')
      } else if (res.status === 403) {
        // พยายามอ่าน body เพื่อดู message ว่าเป็น suspended หรือไม่
        let bodyText = ''
        try {
          const clone = res.clone()
          bodyText = await clone.text()
        } catch {}

        const looksSuspended =
          bodyText.includes('บัญชีถูกระงับ') || bodyText.toLowerCase().includes('suspend')

        if (looksSuspended) {
          clearToken()
          try {
            window.dispatchEvent(
              new CustomEvent('auth:suspended', { detail: { message: 'Account suspended' } })
            )
          } catch {}
          safeRedirectToSignIn('?reason=suspended')
        }
      }
    } catch {
      // ignore
    }

    return res
  }
}
