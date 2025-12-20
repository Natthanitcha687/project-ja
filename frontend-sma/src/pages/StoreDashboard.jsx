// src/pages/StoreDashboard.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavigate, Link } from 'react-router-dom'
import { api, API_URL, getToken } from '../lib/api'
import { useAuth } from '../store/auth'
import StoreTabs from '../components/StoreTabs'
import SimpleDonut from '../components/SimpleDonut'
import LineChart from '../components/LineChart'
import AppLogo from '../components/AppLogo' // ✅ ใช้หัวเดียวกับหน้า Warranty
import DashboardHeader from '../components/DashboardHeader'
import * as XLSX from 'xlsx'

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
  // Export options
  const [exportAggregateBy, setExportAggregateBy] = useState('overview') // 'overview' | 'byCustomer' | 'byProduct'
  const [exportStatusFilter, setExportStatusFilter] = useState('all') // 'all' | 'active' | 'nearing' | 'expired'
  const [exportIncludeDetails, setExportIncludeDetails] = useState(true)

  // helpers: ensure date-only UTC handling and status derivation (matches CustomerWarranty)
  function dateOnlyUTC(v) {
    if (!v) return null
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (m) {
        const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3])
        return new Date(Date.UTC(y, mo, d))
      }
    }
    const d = v instanceof Date ? v : new Date(v)
    if (Number.isNaN(d.getTime())) return null
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }

  function calcDaysLeft(expiryDate) {
    if (!expiryDate) return null
    const todayUTC = dateOnlyUTC(new Date())
    const expUTC = dateOnlyUTC(expiryDate)
    if (!todayUTC || !expUTC) return null
    return Math.ceil((Date.UTC(expUTC.getUTCFullYear(), expUTC.getUTCMonth(), expUTC.getUTCDate()) - Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate())) / (24 * 3600 * 1000))
  }

  function deriveItemStatusCode(item, notifyDays = 14) {
    const dl = Number.isFinite(item?._daysLeft) ? item._daysLeft : calcDaysLeft(item?.expiryDate)
    if (!Number.isFinite(dl)) return 'active'
    if (dl < 0) return 'expired'
    if (dl <= notifyDays) return 'nearing_expiration'
    return 'active'
  }

  // ---------- แจ้งเตือน (ให้พฤติกรรมเหมือนหน้า Warranty) ----------
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const notifRef = useRef(null)
  const unreadCount = (notifications || []).filter((n) => !n.read).length

  // open SSE for real-time notifications
  useEffect(() => {
    const token = getToken()
    if (!token) return
    const es = new EventSource(`${API_URL.replace(/\/+$/,'')}/notifications/stream?token=${token}`)
    es.addEventListener('notification', (ev) => {
      try { const payload = JSON.parse(ev.data); setNotifications((p)=>[payload, ...(p||[])]); } catch (e) {}
    })
    es.onerror = () => {}
    return () => es.close()
  }, [])

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
      const arr = Array.isArray(data) ? data : []
      arr.sort((a,b)=> new Date(b.createdAt || b.time || b.created_at || 0) - new Date(a.createdAt || a.time || a.created_at || 0))
      setNotifications(arr)
      return data
    } catch (e) {
      setNotifications([])
      return []
    } finally {
      setNotifLoading(false)
    }
  }, [storeIdResolved])

  async function markAllAsRead() {
    // optimistic local update
    setNotifications((prev) => (prev || []).map((n) => ({ ...n, read: true })))
    try {
      setNotifLoading(true)
      await api.post('/notifications/mark-all-read')
      await fetchNotifications()
    } catch (e) {
      // ignore
    } finally {
      setNotifLoading(false)
    }
  }

  async function markOneAsRead(id) {
    try {
      // optimistic local mark
      setNotifications((prev) =>
        (prev || []).map((n) => (String(n.id) === String(id) ? { ...n, read: true } : n))
      )
      await api.patch(`/notifications/${id}/read`)
      await fetchNotifications()
    } catch (e) {}
  }

  useEffect(() => { fetchSummary() }, [fetchSummary])
  // fetch notifications on mount so unread count shows before user clicks bell
  useEffect(() => { fetchNotifications().catch(() => {}) }, [fetchNotifications])

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
  const isAuthenticated = !!user
  // format address/businessHours from stored profile (may be JSON string)
  const formatAddress = (raw) => {
    if (!raw) return ''
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
      const parts = []
      if (obj.street) parts.push(obj.street)
      const loc = [obj.subdistrict, obj.district].filter(Boolean).join(' ')
      if (loc) parts.push(loc)
      if (obj.province) parts.push(obj.province)
      if (obj.postcode) parts.push(obj.postcode)
      return parts.join(', ')
    } catch (e) {
      return String(raw || '')
    }
  }
  const profileAddrShort = formatAddress(profile?.address)

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
  const filteredWarranties = useMemo(() => {
    const statusFilter = exportStatusFilter
    const notifyDays = profile?.notifyDaysInAdvance ?? 14
    return (warranties || []).map(h => {
      if (statusFilter === 'all') return h
      const items = (h.items || []).filter(it => {
        const code = it.statusCode || it._status || deriveItemStatusCode(it, notifyDays)
        if (statusFilter === 'all') return true
        if (statusFilter === 'nearing') return code === 'nearing' || code === 'nearing_expiration'
        return code === statusFilter
      })
      return { ...h, items }
    }).filter(h => exportAggregateBy === 'overview' ? true : (h.items || []).length > 0)
  }, [warranties, exportStatusFilter, exportAggregateBy, profile?.notifyDaysInAdvance])

  const totals = useMemo(() => {
    const totalHeaders = (filteredWarranties || []).length
    let totalItems = 0
    let active = 0, nearing = 0, expired = 0
    for (const h of (filteredWarranties || [])) {
      const items = h.items || []
      totalItems += items.length
      for (const it of items) {
        const code = it.statusCode || it._status || deriveItemStatusCode(it, profile?.notifyDaysInAdvance ?? 14)
        if (code === 'active') active++
        else if (code === 'nearing_expiration' || code === 'nearing') nearing++
        else if (code === 'expired') expired++
      }
    }
    return { totalHeaders, totalItems, active, nearing, expired }
  }, [filteredWarranties, profile?.notifyDaysInAdvance])
  const weeklyData = useMemo(() => {
    const now = new Date()
    const oneDay = 24 * 60 * 60 * 1000
    const days = [...Array(7)].map((_, i) => {
      const date = new Date(now.getTime() - i * oneDay)
      return {
        label: ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'][date.getDay()],
        value: (filteredWarranties || []).filter(w => {
          const wDate = new Date(w.createdAt || w.created_at)
          return wDate.toDateString() === date.toDateString()
        }).length
      }
    }).reverse()
    return days
  }, [filteredWarranties])

  const monthlyData = useMemo(() => {
    const now = new Date()
    return [...Array(6)].map((_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - i)
      return {
        label: ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][date.getMonth()],
        value: (filteredWarranties || []).filter(w => {
          const wDate = new Date(w.createdAt || w.created_at)
          return wDate.getMonth() === date.getMonth() && wDate.getFullYear() === date.getFullYear()
        }).length
      }
    }).reverse()
  }, [filteredWarranties])

  // Export current overview or aggregates to Excel
  async function exportOverviewToExcel() {
    try {
      const wb = XLSX.utils.book_new()

      if (exportAggregateBy === 'byCustomer') {
        const byCustomerRows = []
        const custMap = new Map()
        for (const h of (filteredWarranties || [])) {
          const key = (h.customerEmail || h.customer_email || h.customerName || h.customer_name || 'Unknown').toLowerCase()
          const entry = custMap.get(key) || { customerName: h.customerName || h.customer_name || '', customerEmail: h.customerEmail || h.customer_email || '', headers: 0, items: 0, active: 0, nearing: 0, expired: 0 }
          entry.headers += 1
          entry.items += (h.items || []).length
          for (const it of (h.items || [])) {
            const code = it.statusCode || it._status || deriveItemStatusCode(it, profile?.notifyDaysInAdvance ?? 14)
            if (code === 'active') entry.active++
            else if (code === 'nearing_expiration' || code === 'nearing') entry.nearing++
            else if (code === 'expired') entry.expired++
          }
          custMap.set(key, entry)
        }
        for (const v of custMap.values()) byCustomerRows.push(v)
        const ws = XLSX.utils.json_to_sheet(byCustomerRows)
        XLSX.utils.book_append_sheet(wb, ws, 'ByCustomer')
      } else if (exportAggregateBy === 'byProduct') {
        const map = new Map()
        for (const h of (filteredWarranties || [])) {
          for (const it of (h.items || [])) {
            const pKey = (it.productName || it.product_name || 'Unknown').toLowerCase()
            const entry = map.get(pKey) || { productName: it.productName || it.product_name || '', count: 0, active: 0, nearing: 0, expired: 0 }
            entry.count++
            const code = it.statusCode || it._status || deriveItemStatusCode(it, profile?.notifyDaysInAdvance ?? 14)
            if (code === 'active') entry.active++
            else if (code === 'nearing_expiration' || code === 'nearing') entry.nearing++
            else if (code === 'expired') entry.expired++
            map.set(pKey, entry)
          }
        }
        const rows = Array.from(map.values())
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'ByProduct')
      } else {
        const rows = []
        for (const h of (filteredWarranties || [])) {
          rows.push({
            headerId: h.id || h.headerId || '',
            customer: h.customerName || h.customer_name || '',
            customerEmail: h.customerEmail || h.customer_email || '',
            createdAt: h.createdAt || h.created_at || '',
            items: (h.items || []).length,
            status: (h.items || []).map(it => it.status || it._status || deriveItemStatusCode(it, profile?.notifyDaysInAdvance ?? 14)).join('; ')
          })
          if (exportIncludeDetails) {
            for (const it of (h.items || [])) {
              rows.push({ headerId: h.id || h.headerId || '', itemProduct: it.productName || it.product_name || '', itemSerial: it.serial || it.serialNumber || '', expiryDate: it.expiryDate || it.expiry_date || '' })
            }
          }
        }
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Overview')
      }

      const now = new Date().toISOString().slice(0,19).replaceAll(':','-')
      const fileName = `warranty-overview-${exportAggregateBy}-${exportStatusFilter}-${exportIncludeDetails ? 'details' : 'nodetails'}-${now}.xlsx`
      XLSX.writeFile(wb, fileName)
    } catch (err) {
      console.error('Export to Excel failed', err)
      alert('ไม่สามารถสร้างไฟล์ Excel ได้: ' + (err?.message || String(err)))
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">กำลังโหลดข้อมูลสรุป...</div>
  if (error) return <div className="p-6 text-sm text-rose-600">{error}</div>

  const pct = (n) => (totals.totalItems ? Math.round((n / totals.totalItems) * 100) : 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-sky-100/60 pb-12">
      {/* ====================== HEADER (DashboardHeader component) ====================== */}
      <DashboardHeader
        title="Warranty"
        subtitle="จัดการการรับประกันของคุณได้ในที่เดียว"
        notifications={notifications}
        onFetchNotifications={fetchNotifications}
      />

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
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">สรุปตาม</label>
              <select value={exportAggregateBy} onChange={(e) => setExportAggregateBy(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
                <option value="overview">ภาพรวม</option>
                <option value="byCustomer">สรุปตามลูกค้า</option>
                <option value="byProduct">สรุปตามสินค้า</option>
              </select>

              <label className="text-xs text-slate-500">สถานะ</label>
              <select value={exportStatusFilter} onChange={(e) => setExportStatusFilter(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
                <option value="all">ทั้งหมด</option>
                <option value="active">กำลังใช้งาน</option>
                <option value="nearing">ใกล้หมดอายุ</option>
                <option value="expired">หมดอายุ</option>
              </select>

              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={exportIncludeDetails} onChange={(e) => setExportIncludeDetails(e.target.checked)} />
                <span className="text-xs text-slate-600">รวมรายละเอียด</span>
              </label>

              <button
                type="button"
                onClick={exportOverviewToExcel}
                className={`h-10 min-w-[120px] rounded-full border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700 bg-white hover:-translate-y-0.5 hover:bg-sky-50 transition`}
                aria-label="ส่งออกเป็น Excel"
              >
                ส่งออก Excel
              </button>
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

          {/* Aggregate view when user selected byCustomer / byProduct */}
          {exportAggregateBy === 'byCustomer' && (
            <div className="px-6 py-6">
              <h3 className="text-base font-semibold text-slate-900">สรุปตามลูกค้า</h3>
              <p className="text-sm text-slate-500">แสดงจำนวนใบรับประกันและสถานะแบบรวมต่อแต่ละลูกค้า</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr className="text-left text-slate-600">
                      <th className="pb-2">ลูกค้า</th>
                      <th className="pb-2">อีเมล</th>
                      <th className="pb-2">ใบรับประกัน</th>
                      <th className="pb-2">รายการ</th>
                      <th className="pb-2">ใช้งาน</th>
                      <th className="pb-2">ใกล้หมด</th>
                      <th className="pb-2">หมดอายุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows = []
                      const custMap = new Map()
                      for (const h of (filteredWarranties || [])) {
                        const key = (h.customerEmail || h.customer_email || h.customerName || h.customer_name || 'Unknown').toLowerCase()
                        const entry = custMap.get(key) || { customerName: h.customerName || h.customer_name || '', customerEmail: h.customerEmail || h.customer_email || '', headers: 0, items: 0, active: 0, nearing: 0, expired: 0 }
                        entry.headers += 1
                        entry.items += (h.items || []).length
                        for (const it of (h.items || [])) {
                          const code = it.statusCode || it._status || deriveItemStatusCode(it, profile?.notifyDaysInAdvance ?? 14)
                          if (code === 'active') entry.active++
                          else if (code === 'nearing_expiration' || code === 'nearing') entry.nearing++
                          else if (code === 'expired') entry.expired++
                        }
                        custMap.set(key, entry)
                      }
                      for (const v of custMap.values()) rows.push(v)
                      return rows.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-2">{r.customerName || '-'}</td>
                          <td className="py-2">{r.customerEmail || '-'}</td>
                          <td className="py-2">{r.headers}</td>
                          <td className="py-2">{r.items}</td>
                          <td className="py-2">{r.active}</td>
                          <td className="py-2">{r.nearing}</td>
                          <td className="py-2">{r.expired}</td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {exportAggregateBy === 'byProduct' && (
            <div className="px-6 py-6">
              <h3 className="text-base font-semibold text-slate-900">สรุปตามสินค้า</h3>
              <p className="text-sm text-slate-500">สรุปจำนวนรายการตามชื่อสินค้า</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr className="text-left text-slate-600">
                      <th className="pb-2">สินค้า</th>
                      <th className="pb-2">จำนวน</th>
                      <th className="pb-2">ใช้งาน</th>
                      <th className="pb-2">ใกล้หมด</th>
                      <th className="pb-2">หมดอายุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const map = new Map()
                      for (const h of (filteredWarranties || [])) {
                        for (const it of (h.items || [])) {
                          const pKey = (it.productName || it.product_name || 'Unknown').toLowerCase()
                          const entry = map.get(pKey) || { productName: it.productName || it.product_name || '', count: 0, active: 0, nearing: 0, expired: 0 }
                          entry.count++
                          const code = it.statusCode || it._status || deriveItemStatusCode(it, profile?.notifyDaysInAdvance ?? 14)
                          if (code === 'active') entry.active++
                          else if (code === 'nearing_expiration' || code === 'nearing') entry.nearing++
                          else if (code === 'expired') entry.expired++
                          map.set(pKey, entry)
                        }
                      }
                      const rows = Array.from(map.values())
                      return rows.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-2">{r.productName || '-'}</td>
                          <td className="py-2">{r.count}</td>
                          <td className="py-2">{r.active}</td>
                          <td className="py-2">{r.nearing}</td>
                          <td className="py-2">{r.expired}</td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* (พื้นที่กราฟหรือส่วนอื่น ๆ ของคุณยังคงเพิ่มต่อได้) */}
        </section>
      </main>
    </div>
  )
}