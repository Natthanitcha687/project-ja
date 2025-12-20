import { useRef, useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import AppLogo from './AppLogo'
import { api } from '../lib/api'

export default function DashboardHeader({ title, subtitle, notifications = [], onFetchNotifications }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [notifOpen, setNotifOpen] = useState(false)
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  
  const notifRef = useRef(null)
  const profileMenuRef = useRef(null)

  useEffect(() => {
    if (!notifOpen) return
    function onDoc(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [notifOpen])

  // fetch notifications once on mount so badge is populated before user interaction
  useEffect(() => {
    if (onFetchNotifications) {
      onFetchNotifications().catch(() => {})
    }
  }, [onFetchNotifications])

  useEffect(() => {
    if (!isProfileMenuOpen) return
    function onDoc(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [isProfileMenuOpen])

  // notification helpers
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

  return (
    <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/80 py-3 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sky-50 to-white ring-1 ring-black/5 shadow-sm">
            <AppLogo className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900">{title}</div>
            <div className="text-xs text-slate-500">{subtitle}</div>
          </div>
        </div>

        <div className="flex items-center gap-3" ref={profileMenuRef}>
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={async () => {
                const next = !notifOpen
                setNotifOpen(next)
                if (next) {
                  try { await api.post('/notifications/mark-all-read') } catch (e) {}
                  if (onFetchNotifications) {
                    setNotifLoading(true)
                    try { await onFetchNotifications() } catch {}
                    setNotifLoading(false)
                  }
                }
              }}
              className="relative grid h-10 w-10 place-items-center rounded-full bg-white shadow ring-1 ring-black/5 hover:bg-gray-50 transition"
              aria-label="การแจ้งเตือน"
            >
              <span className="text-xl">🔔</span>
              {/* unread badge removed per request */}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 rounded-2xl bg-white p-3 text-sm shadow-xl ring-1 ring-black/5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-900">การแจ้งเตือน</div>
                  <button type="button" onClick={() => setNotifOpen(false)} className="text-xs text-slate-500">ปิด</button>
                </div>
                {notifLoading ? (
                  <div className="py-6 text-center text-slate-500">กำลังโหลด...</div>
                ) : notifications.length === 0 ? (
                  <div className="py-4 text-slate-600">
                    <div className="text-center">ไม่มีการแจ้งเตือน</div>
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.map((n, i) => (
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

          <div>
            <button
              type="button"
              onClick={() => setProfileMenuOpen(p => !p)}
              className="flex items-center gap-3 rounded-full bg-white px-3 py-2 shadow ring-1 ring-black/10 hover:-translate-y-0.5 hover:bg-slate-50 transition"
            >
              <div className="grid h-8 w-8 place-items-center rounded-full bg-sky-200 text-sm">🏪</div>
              <div className="hidden text-left text-sm md:block">
                <div className="font-medium text-slate-900">{user?.storeName || user?.name || 'ร้านของฉัน'}</div>
                <div className="text-xs text-slate-500">{user?.email || ''}</div>
              </div>
              <span className="hidden text-slate-400 md:inline">▾</span>
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-4 top-14 w-64 rounded-2xl bg-white p-4 text-sm shadow-xl ring-1 ring-black/5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-sky-200 text-2xl">🏪</div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{user?.storeName || user?.name || 'ร้านของฉัน'}</div>
                    <div className="truncate text-xs text-slate-500">{user?.email || ''}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/warranty')}
                  className="flex w-full items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-slate-700 hover:bg-sky-100"
                >
                  <span>แก้ไขโปรไฟล์</span>
                  <span aria-hidden>✏️</span>
                </button>
                <button
                  type="button"
                  onClick={() => { logout?.(); navigate('/signin', { replace: true }) }}
                  className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-50"
                >
                  <span>ออกจากระบบ</span>
                  <span aria-hidden>↪️</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}