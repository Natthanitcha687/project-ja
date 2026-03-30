// frontend-sma/src/components/DashboardHeader.jsx
import { useRef, useState, useMemo, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import AppLogo from './AppLogo'
import { api } from '../lib/api'
import { HiOutlineBell, HiOutlineClipboardList } from 'react-icons/hi'

function getNotifType(n) {
  if (!n) return null
  if (n.type) return n.type
  if (n.data && typeof n.data === 'object' && n.data.type) return n.data.type
  return null
}

export default function DashboardHeader({ title, subtitle, notifications = [], onFetchNotifications, onEditProfile, notificationsLoading, onMarkAllRead }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [notifOpen, setNotifOpen] = useState(false)
  const [openNotifDetail, setOpenNotifDetail] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [suppressEmptyOnOpen, setSuppressEmptyOnOpen] = useState(false)
  const [notifRecoveredCache, setNotifRecoveredCache] = useState({})

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

  // ถ้าเปิดดูแจ้งเตือน "ลบใบรับประกัน" ของร้านค้า
  // ให้ลองเช็กสถานะใบจริงจาก API ว่ามีใบนี้อยู่ในแดชบอร์ดแล้วหรือยัง
  // เพื่อรองรับเคสเก่าที่ notification.data.recovered ยังไม่มี
  useEffect(() => {
    if (!openNotifDetail || !selectedNotification) return

    const type = getNotifType(selectedNotification)
    if (type !== 'warranty_deleted') return

    if (selectedNotification?.data?.recovered) return

    const id = selectedNotification.id
    if (!id) return

    if (notifRecoveredCache[id]) {
      setSelectedNotification((prev) =>
        prev && prev.id === id
          ? { ...prev, data: { ...(prev.data || {}), recovered: true } }
          : prev
      )
      return
    }

    const code = selectedNotification?.data?.warrantySnapshot?.code
    if (!code) return

    const storeId = user?.id
    if (!storeId) return

    let cancelled = false
    ;(async () => {
      try {
        const resp = await api.get(`/store/${storeId}/dashboard`)
        const payload = resp?.data?.data || {}
        const headers = Array.isArray(payload.warranties) ? payload.warranties : []
        const has = headers.some((h) => String(h.code) === String(code))
        if (!cancelled && has) {
          setNotifRecoveredCache((prev) => ({ ...prev, [id]: true }))
          setSelectedNotification((prev) =>
            prev && prev.id === id
              ? { ...prev, data: { ...(prev.data || {}), recovered: true } }
              : prev
          )
        }
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [openNotifDetail, selectedNotification, notifRecoveredCache, user?.id])

  // fetch notifications once on mount so badge is populated before user interaction
  useEffect(() => {
    if (onFetchNotifications) {
      onFetchNotifications().catch(() => { })
    }
  }, [onFetchNotifications])

  useEffect(() => {
    if (!isProfileMenuOpen) return
    function onDoc(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target))
        setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [isProfileMenuOpen])

  // suppress showing "no notifications" immediately when dropdown opens
  useEffect(() => {
    if (!notifOpen) return
    setSuppressEmptyOnOpen(true)
    const t = setTimeout(() => setSuppressEmptyOnOpen(false), 300)
    return () => clearTimeout(t)
  }, [notifOpen])

  // สำหรับร้านค้า: รวม notification ที่เกี่ยวกับการแก้ไขใบรับประกันเดียวกัน (เช่น แก้ที่อยู่ + แก้เงื่อนไข)
  // ให้แสดงเป็นแจ้งเตือนเดียว เพื่อไม่ให้ซ้ำซ้อน
  const mergedNotifications = useMemo(() => {
    const list = Array.isArray(notifications) ? notifications : []
    if (!user || user.role !== 'STORE') return list

    const result = []
    const used = new Set()

    for (let i = 0; i < list.length; i++) {
      if (used.has(i)) continue
      const n = list[i]
      const type = getNotifType(n)
      const data = n?.data || {}
      const warrantyId = data.warrantyId || data.warranty_id || null

      // ถ้าไม่ใช่แจ้งเตือนแก้ไขใบรับประกัน ก็ไม่ต้อง merge
      const isHeader = type === 'warranty_header_updated'
      const isItemStore = type === 'warranty_item_updated_store'
      if (!warrantyId || (!isHeader && !isItemStore)) {
        result.push(n)
        continue
      }

      let partnerIndex = -1
      for (let j = i + 1; j < list.length; j++) {
        if (used.has(j)) continue
        const m = list[j]
        const t2 = getNotifType(m)
        const d2 = m?.data || {}
        const w2 = d2.warrantyId || d2.warranty_id || null
        const isHeader2 = t2 === 'warranty_header_updated'
        const isItemStore2 = t2 === 'warranty_item_updated_store'
        if (!w2 || (!isHeader2 && !isItemStore2)) continue
        if (w2 !== warrantyId) continue

        // ต้องเป็นคู่ header + item_store เท่านั้น
        if (!((isHeader && isItemStore2) || (isItemStore && isHeader2))) continue

        const t1 = new Date(n.createdAt || n.time || n.created_at || 0).getTime()
        const t2time = new Date(m.createdAt || m.time || m.created_at || 0).getTime()
        // อยู่ใน window เวลาใกล้กัน (ภายใน 60 วินาที) ถือว่าเป็นการแก้ครั้งเดียวกัน
        if (Math.abs(t1 - t2time) <= 60 * 1000) {
          partnerIndex = j
          break
        }
      }

      if (partnerIndex === -1) {
        result.push(n)
      } else {
        used.add(partnerIndex)
        const m = list[partnerIndex]
        const typeN = getNotifType(n)
        const headerNotif = typeN === 'warranty_header_updated' ? n : m
        const itemNotif = typeN === 'warranty_header_updated' ? m : n

        const headerBody = headerNotif.body || headerNotif.message || ''
        const itemBody = itemNotif.body || itemNotif.message || ''

        const combinedBody = `${headerBody || ''}${headerBody && itemBody ? '<div style="margin:12px 0;border-top:1px dashed #e5e7eb;"></div>' : ''}${itemBody || ''}`

        result.push({
          ...headerNotif,
          body: combinedBody,
          _mergedIds: [headerNotif.id, itemNotif.id].filter((v) => v != null),
        })
      }
    }

    return result
  }, [notifications, user])

  // notification helpers
  // allow parent to control loading state to avoid dropdown flicker
  const effectiveNotifLoading = typeof notificationsLoading === 'undefined' ? notifLoading : notificationsLoading
  // debounce displayed notifications to avoid rapid loading/content flicker
  const [displayedNotifications, setDisplayedNotifications] = useState(notifications || [])
  useEffect(() => {
    if (effectiveNotifLoading) return
    const t = setTimeout(() => setDisplayedNotifications(mergedNotifications || []), 200)
    return () => clearTimeout(t)
  }, [mergedNotifications, effectiveNotifLoading])
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

  const isAuthenticated = !!user
  const unreadCount = (mergedNotifications || []).filter((n) => !n.read).length

  // ✅ อยู่หน้าแจ้งปัญหาแล้ว ไม่ต้องโชว์ปุ่มซ้ำ
  const isOnComplaintsPage = location.pathname.startsWith('/dashboard/complaints')

  // ข้อมูลโปรไฟล์สำหรับหัวเมนู (รองรับทั้งร้านค้าและลูกค้า)
  const role = user?.role
  const storeProfile = user?.storeProfile || null
  const customerProfile = user?.customerProfile || null

  let avatarUrl = ''
  let displayName = user?.name || 'บัญชีของฉัน'
  let displayEmail = user?.email || ''

  if (role === 'STORE') {
    displayName = storeProfile?.storeName || user?.storeName || user?.name || 'ร้านของฉัน'
    displayEmail = storeProfile?.email || user?.email || ''
    avatarUrl = storeProfile?.avatarUrl || ''
  } else if (role === 'CUSTOMER') {
    const fullName = [customerProfile?.firstName, customerProfile?.lastName].filter(Boolean).join(' ')
    displayName = fullName || user?.name || 'บัญชีของฉัน'
    displayEmail = user?.email || ''
    avatarUrl = customerProfile?.avatarUrl || ''
  }

  async function handleDeleteAllNotifications() {
    try {
      // ลบออกจากรายการที่แสดงทันที
      setDisplayedNotifications([])
      await api.post('/notifications/delete-all')
      if (onFetchNotifications) {
        try { await onFetchNotifications() } catch (e) { }
      }
    } catch (e) {
      // ถ้าลบไม่สำเร็จ ให้ลองดึงใหม่จาก backend ครั้งหน้า
    }
  }

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/80 py-3 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sky-50 to-white ring-1 ring-black/5 shadow-sm">
            <AppLogo className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900">{title}</div>
            <div className="text-xs text-slate-500 hidden sm:block">{subtitle}</div>
          </div>
        </Link>

        <div className="flex items-center gap-3" ref={profileMenuRef}>
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                const next = !notifOpen
                setNotifOpen(next)
                if (!next) return
                // when opening, trigger mark-all-read in background (parent may control loading)
                try {
                  if (onMarkAllRead) {
                    // fire-and-forget to avoid blocking UI updates
                    void onMarkAllRead()
                  } else {
                    void (async () => {
                      try { await api.post('/notifications/mark-all-read') } catch (e) { }
                      // don't force a fetch here; parent will sync via SSE or periodic fetch
                    })()
                  }
                } catch (e) {
                  // ignore
                }
              }}
              className="relative grid h-10 w-10 place-items-center rounded-full bg-white shadow ring-1 ring-black/5 hover:bg-gray-50 transition"
              aria-label="การแจ้งเตือน"
            >
              <img src="/home-assets/noti.jpg" alt="แจ้งเตือน" className="h-5 w-5 object-contain" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="notif-dropdown absolute top-12 w-64 sm:w-80 max-w-[calc(100vw-1rem)] rounded-2xl bg-white p-3 text-sm shadow-xl ring-1 ring-black/5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-900">การแจ้งเตือน</div>
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-slate-500"
                  >
                    ปิด
                  </button>
                </div>
                {(effectiveNotifLoading || suppressEmptyOnOpen) ? (
                  <div className="py-6 text-center text-slate-500">กำลังโหลด...</div>
                ) : (displayedNotifications || []).length === 0 ? (
                  <div className="py-4 text-slate-600">
                    <div className="text-center">ไม่มีการแจ้งเตือน</div>
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto overflow-x-hidden">
                    {(displayedNotifications || []).map((n, i) => (
                      <li
                        key={n.id || i}
                        className="rounded-lg p-3 hover:bg-sky-50"
                        onClick={async () => {
                          const id = n.id
                          if (id != null && !n.read) {
                            // optimistic update: mark locally and send request in background
                            setDisplayedNotifications((prev) => (prev || []).map((m) => (String(m.id) === String(id) ? { ...m, read: true } : m)))
                            void (async () => {
                              try { await api.patch(`/notifications/${id}/read`) } catch (e) { }
                              // do not call onFetchNotifications here to avoid toggling loading state
                            })()
                          }
                          setSelectedNotification(n)
                          setOpenNotifDetail(true)
                          setNotifOpen(false)
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 shrink-0 rounded-full bg-sky-100 grid place-items-center text-xs text-sky-700">
                            <img src="/home-assets/noti.jpg" alt="แจ้งเตือน" className="h-4 w-4 object-contain" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900">
                              {n.title || n.message || 'การแจ้งเตือน'}
                            </div>
                            {n.body || n.message ? (
                              <div className="text-xs text-slate-600 mt-1 break-words">
                                <div dangerouslySetInnerHTML={{ __html: n.body || n.message }} />
                              </div>
                            ) : null}
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                              <span>
                                {(n.createdAt || n.time || n.created_at)
                                  ? new Date(n.createdAt || n.time || n.created_at).toLocaleString('th-TH')
                                  : ''}
                              </span>
                              {n.id != null && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const ids = Array.isArray(n._mergedIds) && n._mergedIds.length > 0
                                      ? n._mergedIds
                                      : [n.id]
                                    const norm = ids.map((v) => String(v))
                                    // optimistic remove from current list
                                    setDisplayedNotifications((prev) =>
                                      (prev || []).filter((m) => !norm.includes(String(m.id)))
                                    )
                                    void (async () => {
                                      try {
                                        await Promise.all(norm.map((id) => api.delete(`/notifications/${id}`)))
                                      } catch (e) {
                                        // ignore error; next fetch will resync state
                                      }
                                    })()
                                  }}
                                  className="ml-2 rounded px-1 py-0.5 text-[10px] text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  ลบ
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {!effectiveNotifLoading && (displayedNotifications || []).length > 0 && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleDeleteAllNotifications}
                      className="text-[11px] text-rose-500 hover:text-rose-600 hover:underline"
                    >
                      ลบทั้งหมด
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ✅ ไอคอนแจ้งปัญหาแบบกลมข้างกระดิ่ง + ซ่อนเมื่ออยู่หน้าแจ้งปัญหา */}
          {isAuthenticated && !isOnComplaintsPage && (
            <Link
              id="step-header-complaint"
              to="/dashboard/complaints"
              title="ร้องเรียน/ติดต่อแอดมิน"
              aria-label="ร้องเรียน/ติดต่อแอดมิน"
              className="flex items-center justify-center h-10 w-10 sm:h-auto sm:w-auto sm:px-3 sm:py-2 gap-1.5 sm:gap-2 rounded-full bg-white shadow ring-1 ring-black/5 font-semibold text-slate-700 hover:bg-slate-50 transition"
              onClick={() => {
                setNotifOpen(false)
                setProfileMenuOpen(false)
              }}
            >
              <img src="/home-assets/report.jpg" alt="แจ้งปัญหา" className="h-5 w-5 sm:h-4 sm:w-4 object-contain" />
              <span className="hidden sm:inline text-sm whitespace-nowrap">แจ้งปัญหา</span>
            </Link>
          )}

          <div>
            <button
              id="step-header-profile"
              type="button"
              onClick={() => setProfileMenuOpen((p) => !p)}
              className="flex items-center gap-3 rounded-full bg-white px-3 py-2 shadow ring-1 ring-black/10 hover:-translate-y-0.5 hover:bg-slate-50 transition"
            >
              <div className="grid h-8 w-8 place-items-center rounded-full bg-sky-200 text-sm overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : role === 'STORE' ? (
                  <img
                    src="/home-assets/store.png"
                    alt="Store"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="hidden text-left text-sm md:block">
                <div className="font-medium text-slate-900">{displayName}</div>
                <div className="text-xs text-slate-500">{displayEmail}</div>
              </div>
              <span className="hidden text-slate-400 md:inline">▾</span>
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-3 sm:right-4 top-14 w-56 sm:w-64 rounded-2xl bg-white p-4 text-sm shadow-xl ring-1 ring-black/5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-sky-200 text-2xl overflow-hidden">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : role === 'STORE' ? (
                      <img
                        src="/home-assets/store.png"
                        alt="Store"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">
                      {displayName}
                    </div>
                    <div className="truncate text-xs text-slate-500">{displayEmail}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onEditProfile) {
                      try { onEditProfile() } catch (e) { }
                      setProfileMenuOpen(false)
                    } else {
                      navigate('/dashboard/warranty?openProfile=1')
                    }
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-slate-700 hover:bg-sky-100"
                >
                  <span>แก้ไขข้อมูลร้านค้า</span>
                  <img src="/home-assets/pencil.png" alt="แก้ไข" className="inline h-4 w-4 object-cover ml-2" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout?.()
                    navigate('/signin', { replace: true })
                  }}
                  className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-50"
                >
                  <span>ออกจากระบบ</span>
                  <img src="/home-assets/logout.png" alt="ออกจากระบบ" className="inline h-4 w-4 object-cover ml-2" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    {openNotifDetail && selectedNotification && (
      <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="text-sm font-semibold text-slate-800">รายละเอียดการแจ้งเตือน</div>
            <button
              type="button"
              onClick={() => setOpenNotifDetail(false)}
              className="text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="px-4 py-3 text-sm text-slate-700 max-h-[60vh] overflow-y-auto overflow-x-hidden">
            <div className="font-semibold text-slate-900">
              {selectedNotification.title ||
                selectedNotification.message ||
                (selectedNotification.data && selectedNotification.data.type) ||
                'การแจ้งเตือน'}
            </div>
            {selectedNotification.body && (
              <div className="mt-2 text-sm text-slate-700">
                <div
                  dangerouslySetInnerHTML={{ __html: selectedNotification.body }}
                />
              </div>
            )}

            {getNotifType(selectedNotification) === 'warranty_deleted' &&
              selectedNotification?.data?.warrantySnapshot && (
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-700 space-y-1">
                  <div className="font-semibold text-slate-900">รายละเอียดใบรับประกัน (ก่อนถูกลบ)</div>
                  <div>รหัสใบรับประกัน: <span className="font-medium">{selectedNotification.data.warrantySnapshot.code || '-'}</span></div>
                  {selectedNotification.data.warrantySnapshot.productName && (
                    <div>สินค้า: <span className="font-medium">{selectedNotification.data.warrantySnapshot.productName}</span></div>
                  )}
                  {selectedNotification.data.warrantySnapshot.model && (
                    <div>รุ่น / รุ่นย่อย: <span className="font-medium">{selectedNotification.data.warrantySnapshot.model}</span></div>
                  )}
                  {selectedNotification.data.warrantySnapshot.serial && (
                    <div>Serial No.: <span className="font-medium">{!selectedNotification.data.warrantySnapshot.serial || selectedNotification.data.warrantySnapshot.serial === 'SN001' ? '-' : selectedNotification.data.warrantySnapshot.serial}</span></div>
                  )}
                  {selectedNotification.data.warrantySnapshot.purchaseDate && (
                    <div>
                      วันที่ซื้อสินค้า: <span className="font-medium">
                        {new Date(selectedNotification.data.warrantySnapshot.purchaseDate).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  {selectedNotification.data.warrantySnapshot.expiryDate && (
                    <div>
                      วันสิ้นสุดการรับประกัน: <span className="font-medium">
                        {new Date(selectedNotification.data.warrantySnapshot.expiryDate).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  {selectedNotification.data.warrantySnapshot.coverageNote && (
                    <div>เงื่อนไขการรับประกัน: <span className="font-medium">{selectedNotification.data.warrantySnapshot.coverageNote}</span></div>
                  )}
                  {selectedNotification.data.warrantySnapshot.note && (
                    <div>หมายเหตุเพิ่มเติม: <span className="font-medium">{selectedNotification.data.warrantySnapshot.note}</span></div>
                  )}
                  {selectedNotification.data.warrantySnapshot.storeName && (
                    <div>ร้านค้า: <span className="font-medium">{selectedNotification.data.warrantySnapshot.storeName}</span></div>
                  )}
                </div>
              )}

            {selectedNotification.createdAt && (
              <div className="mt-3 text-xs text-slate-500">
                ได้รับเมื่อ {new Date(selectedNotification.createdAt).toLocaleString('th-TH')}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 bg-slate-50/80">
            <button
              type="button"
              onClick={() => setOpenNotifDetail(false)}
              className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              ปิด
            </button>

            <div className="flex items-center gap-2">
              {getNotifType(selectedNotification) === 'warranty_deleted' &&
                selectedNotification?.data?.warrantySnapshot &&
                !selectedNotification?.data?.recovered && (
                  <button
                    type="button"
                    onClick={() => {
                      const snap = selectedNotification?.data?.warrantySnapshot || {}
                      const code = snap.code || '-'
                      const product = snap.productName || ''
                      const customerName = snap.customerName || ''

                      const presetSubject = `ร้านค้าขอกู้คืนใบรับประกันรหัส ${code}`

                      const lines = [
                        'ร้านค้าขอกู้คืนใบรับประกันนี้ที่ถูกลบไปจากระบบ',
                        '',
                        'รายละเอียดใบรับประกันเดิม (จากระบบ):',
                        `- รหัสใบรับประกัน: ${code}`,
                        product ? `- สินค้า: ${product}` : '',
                        customerName ? `- ชื่อลูกค้า: ${customerName}` : '',
                      ].filter(Boolean)

                      const presetMessage = lines.join('\n')

                      navigate('/dashboard/complaints', {
                        state: {
                          fromWarrantyDeleted: true,
                          isRecoveryRequest: true,
                          presetCategory: 'ปัญหาใบรับประกัน',
                          presetSubject,
                          presetMessage,
                        },
                      })

                      setOpenNotifDetail(false)
                    }}
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700"
                  >
                    ยื่นคำร้องกู้คืนใบรับประกันนี้
                  </button>
                )}

              {getNotifType(selectedNotification) === 'warranty_deleted' &&
                selectedNotification?.data?.recovered && (
                  <span className="text-[11px] font-medium text-emerald-600">
                    ใบรับประกันนี้ถูกกู้คืนแล้ว
                  </span>
                )}

              {selectedNotification?.data?.warrantyId && (
                <button
                  type="button"
                  onClick={() => {
                    const wid = selectedNotification?.data?.warrantyId
                    if (wid) {
                      // ใช้หน้าจัดการใบรับประกันหลักของร้าน และส่ง id ไปให้ใน state เผื่ออนาคตอยาก focus ใบนั้น
                      navigate('/dashboard/warranty', { state: { focusWarrantyId: wid } })
                      setOpenNotifDetail(false)
                    }
                  }}
                  className="rounded-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-sky-700"
                >
                  ไปที่ใบรับประกัน
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
