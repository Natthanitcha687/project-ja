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
    // ถ้าต้องการ handle 401 global ให้ทำตรงนี้
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
  try { return new URL(API_URL).origin } catch { return '' }
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
        // absolute
        const u = new URL(urlStr)
        shouldAttach = (u.origin === API_ORIGIN)
      } else {
        // relative path → ถือว่าไปที่ API เดียวกัน (ผ่าน CORS proxy/เดียวกัน)
        shouldAttach = true
      }
    } catch {
      shouldAttach = true
    }

    if (shouldAttach) {
      const token = getToken()
      if (token) {
        // รวม headers เดิม + เติม Authorization ถ้ายังไม่มี
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

    return _fetch(input, init)
  }
}
