// src/pages/StoreDashboard.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import StoreTabs from '../components/StoreTabs'
import SimpleDonut from '../components/SimpleDonut'
import LineChart from '../components/LineChart'
import AppLogo from '../components/AppLogo' // ✅ ใช้หัวเดียวกับหน้า Warranty

export default function StoreDashboard() {
  const { user, logout } = useAuth() // ✅ มี logout เหมือนอีกหน้า
  const navigate = useNavigate()

  const storeIdResolved = useMemo(() => {
    if (!user) return null
    return Number(user.sub ?? user.id ?? null)
  }, [user])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
  const [warranties, setWarranties] = useState([])

  // ---------- แจ้งเตือน (ให้พฤติกรรมเหมือนหน้า Warranty) ----------
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const notifRef = useRef(null)

  // ---------- โปรไฟล์เมนูเหมือนหน้า Warranty ----------
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef(null)

  // ---------- ดึงสรุป ----------
  const fetchSummary = useCallback(async () => {
    if (!storeIdResolved) return
    setError('')
    setLoading(true)
    try {
      const res = await api.get(`/store/${storeIdResolved}/dashboard`)
      const data = res?.data?.data || res?.data || {}
      setProfile(data.storeProfile || null)
      setWarranties(Array.isArray(data.warranties) ? data.warranties : [])
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }, [storeIdResolved])

  // ---------- ดึงการแจ้งเตือน (พฤติกรรม & เส้นทางเหมือนหน้า Warranty) ----------
  const fetchNotifications = useCallback(async () => {
    if (!storeIdResolved) return []
    setNotifLoading(true)
    try {
      let res
      try {
        res = await api.get(`/store/${storeIdResolved}/notifications`)
      } catch (e) {
        res = await api.get('/notifications')
      }
      const data = res?.data?.data || res?.data || []
      setNotifications(Array.isArray(data) ? data : [])
      return data
    } catch (e) {
      setNotifications([])
      return []
    } finally {
      setNotifLoading(false)
    }
  }, [storeIdResolved])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  // ---------- ปิดเมนูเมื่อคลิกนอกกรอบ (เหมือนหน้า Warranty) ----------
  useEffect(() => {
    function onDoc(e) {
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (isProfileMenuOpen && profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [notifOpen, isProfileMenuOpen])

  // ---------- ชื่อ-อีเมล-อวตารโชว์บนหัว (เหมือนหน้า Warranty) ----------
  const profileAvatarSrc = profile?.avatarUrl || ''
  const storeDisplayName = profile?.storeName || user?.store?.name || user?.storeName || user?.name || 'ร้านของฉัน'
  const storeEmail = profile?.email || user?.store?.email || user?.email || ''

  // ---------- isNewAccount (ใช้ในกล่องแจ้งเตือน เหมือนอีกหน้า) ----------
  const isNewAccount = useMemo(() => {
    if (!user) return false
    if (user.isNew) return true
    const created = user.createdAt || user.created_at || user.registeredAt || user.created
    if (!created) return false
    const d = new Date(created)
    if (isNaN(d.getTime())) return false
    const days = (Date.now() - d.getTime()) / (1000 * 3600 * 24)
    return days <= 7
  }, [user])

  // ---------- ออกจากระบบ (ให้เหมือนหน้า Warranty) ----------
  const handleLogout = () => {
    logout?.()
    setProfileMenuOpen(false)
    navigate('/signin', { replace: true })
  }

  // ---------- คำนวณสรุป (โดนัท ฯลฯ) ----------
  const totals = useMemo(() => {
    const totalHeaders = warranties.length
    let totalItems = 0
    let active = 0, nearing = 0, expired = 0
    for (const h of warranties || []) {
      const items = h.items || []
      totalItems += items.length
      for (const it of items) {
        const code =
          it.statusCode ||
          (it.statusTag === 'ใกล้หมดอายุ' ? 'nearing_expiration'
            : it.statusTag === 'หมดอายุ' ? 'expired'
            : 'active')
        if (code === 'active') active++
        else if (code === 'nearing_expiration') nearing++
        else if (code === 'expired') expired++
      }
    }
    return { totalHeaders, totalItems, active, nearing, expired }
  }, [warranties])

  const weeklyData = useMemo(() => {
    const now = new Date()
    const oneDay = 24 * 60 * 60 * 1000
    const days = [...Array(7)].map((_, i) => {
      const date = new Date(now.getTime() - i * oneDay)
      return {
        label: ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'][date.getDay()],
        value: warranties.filter(w => {
          const wDate = new Date(w.createdAt || w.created_at)
          return wDate.toDateString() === date.toDateString()
        }).length
      }
    }).reverse()
    return days
  }, [warranties])

  const monthlyData = useMemo(() => {
    const now = new Date()
    return [...Array(6)].map((_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - i)
      return {
        label: ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][date.getMonth()],
        value: warranties.filter(w => {
          const wDate = new Date(w.createdAt || w.created_at)
          return wDate.getMonth() === date.getMonth() && wDate.getFullYear() === date.getFullYear()
        }).length
      }
    }).reverse()
  }, [warranties])

  if (loading) return <div className="p-6 text-sm text-slate-500">กำลังโหลดข้อมูลสรุป...</div>
  if (error) return <div className="p-6 text-sm text-rose-600">{error}</div>

  const pct = (n) => (totals.totalItems ? Math.round((n / totals.totalItems) * 100) : 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-sky-100/60 pb-12">
      {/* ====================== HEADER (เหมือนหน้า Warranty) ====================== */}
      <header className="sticky top-0 z-30 border-b border-sky-100 bg-white/80 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          {/* โลโก้ + ชื่อแอป */}
          <div className="flex items-center gap-3">
            <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-50 to-white ring-1 ring-black/5 shadow-sm">
              <AppLogo className="h-7 w-7" />
              <div className="absolute -inset-px rounded-2xl pointer-events-none [mask-image:radial-gradient(18px_18px_at_16px_16px,white,transparent)]"></div>
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900">Warranty</div>
              <div className="text-xs text-slate-500">จัดการการรับประกันของคุณได้ในที่เดียว</div>
            </div>
          </div>

          {/* กระดิ่ง + โปรไฟล์ */}
          <div className="flex items-center gap-3" ref={profileMenuRef}>
            {/* กระดิ่งแจ้งเตือน */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={async () => {
                  setNotifOpen((p) => !p)
                  if (!notifOpen) await fetchNotifications()
                }}
                aria-label="การแจ้งเตือน"
                className="relative grid h-10 w-10 place-items-center rounded-full bg-white shadow ring-1 ring-black/5 hover:bg-gray-50 transition"
              >
                <span className="text-xl">🔔</span>
                {(() => {
                  const unread = (notifications || []).filter(n => !n.read).length
                  return unread > 0 ? (
                    <span className="absolute -top-0 -right-0 inline-flex items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">{unread}</span>
                  ) : null
                })()}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 rounded-2xl bg-white p-3 text-sm shadow-xl ring-1 ring-black/5">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-900">การแจ้งเตือน</div>
                    <button type="button" onClick={() => setNotifOpen(false)} className="text-xs text-slate-500">ปิด</button>
                  </div>
                  {notifLoading ? (
                    <div className="py-6 text-center text-slate-500">กำลังโหลด...</div>
                  ) : (notifications || []).length === 0 ? (
                    <div className="py-4 text-slate-600">
                      {isNewAccount ? (
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">ยินดีต้อนรับ 🎉</div>
                          <div>คุณสมัครเข้าใช้งานสำเร็จ — ขอบคุณที่สมัครใช้งานกับเรา</div>
                        </div>
                      ) : (
                        <div className="text-center">ไม่มีการแจ้งเตือน</div>
                      )}
                    </div>
                  ) : (
                    <ul className="space-y-2 max-h-64 overflow-y-auto">
                      {(notifications || []).map((n, i) => (
                        <li key={n.id || i} className="flex items-start gap-3 rounded-lg p-2 hover:bg-sky-50">
                          <div className="h-8 w-8 shrink-0 rounded-full bg-sky-100 grid place-items-center text-xs text-sky-700">🔔</div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900">{n.title || n.message || 'การแจ้งเตือน'}</div>
                            <div className="text-xs text-slate-600">{n.body || n.message || ''}</div>
                          </div>
                          <div className="text-xs text-slate-400">{n.time || ''}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* ปุ่มโปรไฟล์ */}
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="flex items-center gap-3 rounded-full bg-white px-3 py-2 shadow ring-1 ring-black/10 hover:-translate-y-0.5 hover:bg-slate-50 transition"
            >
              {profileAvatarSrc ? (
                <img src={profileAvatarSrc} alt="Store profile" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-200 text-xl">🏪</div>
              )}
              <div className="hidden text-left text-sm md:block">
                <div className="font-medium text-slate-900">{storeDisplayName}</div>
                <div className="text-xs text-slate-500">{storeEmail}</div>
              </div>
              <span className="hidden text-slate-400 md:inline">▾</span>
            </button>

            {/* เมนูดรอปดาวน์โปรไฟล์ */}
            {isProfileMenuOpen && (
              <div className="absolute right-4 top-14 w-64 rounded-2xl bg-white p-4 text-sm shadow-xl ring-1 ring-black/5">
                <div className="mb-4 flex items-center gap-3">
                  {profileAvatarSrc ? (
                    <img src={profileAvatarSrc} alt="Store profile" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-sky-200 text-2xl">🏪</div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{storeDisplayName}</div>
                    <div className="truncate text-xs text-slate-500">{storeEmail}</div>
                  </div>
                </div>
                {/* ถ้าอยากเปิด Modal โปรไฟล์แบบอีกหน้า ค่อยต่อยอดได้
                    ตอนนี้ให้พาไปหน้าโปรไฟล์หรือไว้แก้ไขในอนาคต */}
                <button
                  type="button"
                  onClick={() => { setProfileMenuOpen(false); navigate('/dashboard/warranty', { replace: false }) }}
                  className="flex w-full items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-slate-700 hover:bg-sky-100"
                >
                  <span>แก้ไขโปรไฟล์</span>
                  <span aria-hidden>✏️</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-50"
                >
                  <span>ออกจากระบบ</span>
                  <span aria-hidden>↪️</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* ====================== /HEADER ====================== */}

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <StoreTabs />
        </div>

        {/* การ์ดหลักแบบหน้าการจัดการ */}
        <section className="rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm">
          {/* หัวการ์ด */}
          <div className="flex items-center justify-between px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">ภาพรวม & การรับประกัน</h2>
              <p className="text-sm text-slate-500">สรุปภาพรวมการรับประกันและสินค้าของร้าน</p>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* KPI Overview */}
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600 text-lg font-semibold">📄</div>
                <div>
                  <div className="text-xs text-slate-500">ใบรับประกัน</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{totals.totalHeaders}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 text-lg font-semibold">✅</div>
                <div>
                  <div className="text-xs text-slate-500">กำลังใช้งาน</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-600">{totals.active}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 text-lg font-semibold">⚠️</div>
                <div>
                  <div className="text-xs text-slate-500">ใกล้หมดอายุ</div>
                  <div className="mt-1 text-2xl font-bold text-amber-600">{totals.nearing}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 text-lg font-semibold">⛔️</div>
                <div>
                  <div className="text-xs text-slate-500">หมดอายุ</div>
                  <div className="mt-1 text-2xl font-bold text-rose-600">{totals.expired}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Status + Donut */}
          <div className="px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">สถานะการรับประกัน</h3>
                <p className="text-sm text-slate-500">สัดส่วนสถานะการรับประกันทั้งหมด</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                  <span className="text-slate-600">กำลังใช้งาน</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                  <span className="text-slate-600">ใกล้หมดอายุ</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500"></div>
                  <span className="text-slate-600">หมดอายุ</span>
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-emerald-50/50 p-4">
                    <div className="text-sm font-medium text-emerald-900">กำลังใช้งาน</div>
                    <div className="mt-1 text-3xl font-bold text-emerald-600">{totals.active}</div>
                    <div className="mt-1 text-sm text-emerald-700">{pct(totals.active)}%</div>
                  </div>
                  <div className="rounded-xl bg-amber-50/50 p-4">
                    <div className="text-sm font-medium text-amber-900">ใกล้หมดอายุ</div>
                    <div className="mt-1 text-3xl font-bold text-amber-600">{totals.nearing}</div>
                    <div className="mt-1 text-sm text-amber-700">{pct(totals.nearing)}%</div>
                  </div>
                  <div className="rounded-xl bg-rose-50/50 p-4">
                    <div className="text-sm font-medium text-rose-900">หมดอายุ</div>
                    <div className="mt-1 text-3xl font-bold text-rose-600">{totals.expired}</div>
                    <div className="mt-1 text-sm text-rose-700">{pct(totals.expired)}%</div>
                  </div>
                </div>
              </div>
              <div className="ml-8 flex items-center justify-center">
                <SimpleDonut counts={totals} size={200} thickness={30} />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />
          {/* (พื้นที่กราฟหรือส่วนอื่น ๆ ของคุณยังคงเพิ่มต่อได้) */}
        </section>
      </main>
    </div>
  )
}
