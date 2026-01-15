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
  // Profile modal states (copied from WarrantyDashboard to allow inline editing)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)
  const [profileTab, setProfileTab] = useState('info')
  const profileMenuRef = useRef(null)
  const profileImageInputRef = useRef(null)
  const [profileImage, setProfileImage] = useState({ file: null, preview: '' })
  const [addressParts, setAddressParts] = useState({ street: '', subdistrict: '', district: '', province: '', postcode: '' })
  const [businessSchedule, setBusinessSchedule] = useState({
    mon: { on: true, start: '09:00', end: '18:00' },
    tue: { on: true, start: '09:00', end: '18:00' },
    wed: { on: true, start: '09:00', end: '18:00' },
    thu: { on: true, start: '09:00', end: '18:00' },
    fri: { on: true, start: '09:00', end: '18:00' },
    sat: { on: false, start: '09:00', end: '12:00' },
    sun: { on: false, start: '09:00', end: '12:00' },
  })
  const [profilePasswords, setProfilePasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [modalError, setModalError] = useState('')
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  // Dynamic province/district/subdistrict lists
  const PROVINCES_JSON_LOCAL = '/data/api_province.json'
  const DISTRICTS_JSON_LOCAL = '/data/api_district.json'
  const SUBDISTRICTS_JSON_LOCAL = '/data/api_subdistrict.json'
  const PROVINCES_JSON_FALLBACK = 'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/province.json'
  const DISTRICTS_JSON_FALLBACK = 'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/district.json'
  const SUBDISTRICTS_JSON_FALLBACK = 'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/sub_district.json'
  const [provincesList, setProvincesList] = useState([])
  const [districtOptions, setDistrictOptions] = useState([])
  const [subdistrictOptions, setSubdistrictOptions] = useState([])
  const [districtsCache, setDistrictsCache] = useState(null)
  const [subdistrictsCache, setSubdistrictsCache] = useState(null)
  const [districtsMap, setDistrictsMap] = useState(null)
  const [subdistrictsMap, setSubdistrictsMap] = useState(null)

  useEffect(() => {
    let mounted = true
    async function loadAll() {
      try {
        const fetchOrFallback = async (localUrl, fallbackUrl) => {
          let r = await fetch(localUrl)
          if (!r.ok) r = await fetch(fallbackUrl)
          return await r.json()
        }
        const [provData, districtData, subData] = await Promise.all([
          fetchOrFallback(PROVINCES_JSON_LOCAL, PROVINCES_JSON_FALLBACK),
          fetchOrFallback(DISTRICTS_JSON_LOCAL, DISTRICTS_JSON_FALLBACK),
          fetchOrFallback(SUBDISTRICTS_JSON_LOCAL, SUBDISTRICTS_JSON_FALLBACK),
        ])
        if (!mounted) return
        setProvincesList(provData.map((p) => ({ name: p.name_th || p.name, code: p.id ?? p.code })))
        setDistrictsCache(districtData)
        setSubdistrictsCache(subData)
        const dmap = {}
        for (const d of districtData || []) {
          const pid = String(d.province_id ?? d.province_code ?? d.provinceId ?? d.province)
          if (!dmap[pid]) dmap[pid] = []
          dmap[pid].push(d)
        }
        setDistrictsMap(dmap)
        const smap = {}
        for (const s of subData || []) {
          const did = String(s.district_id ?? s.district_code ?? s.amphure_id ?? s.district)
          if (!smap[did]) smap[did] = []
          smap[did].push(s)
        }
        setSubdistrictsMap(smap)
      } catch (err) {
        console.error('loadAll location data failed', err)
        setProvincesList([])
        setDistrictsCache(null)
        setSubdistrictsCache(null)
        setDistrictsMap(null)
        setSubdistrictsMap(null)
      }
    }
    loadAll()
    return () => { mounted = false }
  }, [])

  async function loadDistrictsForProvince(provinceNameOrCode) {
    try {
      if (!provinceNameOrCode) { setDistrictOptions([]); return }
      let provinceCode = provinceNameOrCode
      if (isNaN(Number(provinceNameOrCode))) {
        const p = provincesList.find((x) => x.name === provinceNameOrCode)
        provinceCode = p?.code
      }
      const pid = String(provinceCode)
      if (districtsMap) { const list = districtsMap[pid] || []; setDistrictOptions(list.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code }))); return }
      let districtsData = districtsCache
      if (!districtsData) { let res = await fetch(DISTRICTS_JSON_LOCAL); if (!res.ok) res = await fetch(DISTRICTS_JSON_FALLBACK); districtsData = await res.json(); setDistrictsCache(districtsData) }
      const filtered = districtsData.filter((d) => String(d.province_id ?? d.province_code) === pid)
      setDistrictOptions(filtered.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })))
    } catch (err) { console.error('loadDistrictsForProvince error', err); setDistrictOptions([]) }
  }

  async function loadSubdistrictsForDistrict(districtCode) {
    try {
      if (!districtCode) { setSubdistrictOptions([]); return }
      const did = String(districtCode)
      if (subdistrictsMap) { const list = subdistrictsMap[did] || []; setSubdistrictOptions(list.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip }))); return }
      let subs = subdistrictsCache
      if (!subs) { let res = await fetch(SUBDISTRICTS_JSON_LOCAL); if (!res.ok) res = await fetch(SUBDISTRICTS_JSON_FALLBACK); subs = await res.json(); setSubdistrictsCache(subs) }
      const filtered = subs.filter((s) => String(s.district_id ?? s.district_code) === did)
      setSubdistrictOptions(filtered.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })))
    } catch (err) { console.error('loadSubdistrictsForDistrict error', err); setSubdistrictOptions([]) }
  }

  function parseBusinessSchedule(raw) {
    if (!raw) return businessSchedule
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch (e) { return businessSchedule }
  }

  const handleProfileAvatarSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => { if (typeof reader.result === 'string') { setProfileImage({ file, preview: reader.result }); setProfile((p) => ({ ...p, avatarUrl: reader.result })) } }
    reader.readAsDataURL(file)
  }

  const openProfileModal = async () => {
    // initialize from current profile
    setBusinessSchedule(parseBusinessSchedule(profile?.businessHours))
    try {
      const raw = profile?.address
      if (raw && typeof raw === 'string') {
        const parsed = JSON.parse(raw)
        setAddressParts({
          street: parsed.street || '',
          subdistrict: parsed.subdistrict?.id ?? parsed.subdistrict ?? '',
          district: parsed.district?.id ?? parsed.district ?? '',
          province: parsed.province?.id ?? parsed.province ?? '',
          postcode: parsed.postcode || parsed.subdistrict?.zipcode || '',
        })
        try { const prov = parsed.province?.id ?? parsed.province ?? ''; if (prov) await loadDistrictsForProvince(prov); const dist = parsed.district?.id ?? parsed.district ?? ''; if (dist) await loadSubdistrictsForDistrict(dist) } catch (e) {}
      } else if (raw && typeof raw === 'object') {
        setAddressParts({ street: raw.street || '', subdistrict: raw.subdistrict?.id ?? raw.subdistrict ?? '', district: raw.district?.id ?? raw.district ?? '', province: raw.province?.id ?? raw.province ?? '', postcode: raw.postcode || '' })
        try { const prov = raw.province?.id ?? raw.province ?? ''; if (prov) await loadDistrictsForProvince(prov); const dist = raw.district?.id ?? raw.district ?? ''; if (dist) await loadSubdistrictsForDistrict(dist) } catch (e) {}
      } else {
        setAddressParts({ street: String(profile?.address || '') || '', subdistrict: '', district: '', province: '', postcode: '' })
      }
    } catch (e) { setAddressParts({ street: String(profile?.address || '') || '', subdistrict: '', district: '', province: '', postcode: '' }) }
    setProfileImage({ file: null, preview: profile?.avatarUrl || '' })
    setProfileModalOpen(true)
    setProfileTab('info')
    setModalError('')
    setProfileSubmitting(false)
    setPasswordSubmitting(false)
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    if (!storeIdResolved) return
    setProfileSubmitting(true)
    setModalError('')
    try {
      const payload = {
        storeName: profile?.storeName,
        contactName: profile?.contactName,
        email: profile?.email,
        phone: profile?.phone,
        address: JSON.stringify({ street: addressParts.street || '', subdistrict: addressParts.subdistrict || '', district: addressParts.district || '', province: addressParts.province || '', postcode: addressParts.postcode || '' }),
        businessHours: JSON.stringify(businessSchedule),
        avatarUrl: profile?.avatarUrl,
      }
      const response = await api.patch(`/store/${storeIdResolved}/profile`, payload)
      const updatedProfile = response.data?.data?.storeProfile ?? payload
      setProfile((prev) => ({ ...prev, ...updatedProfile }))
      try { const rawAddr = updatedProfile.address; if (rawAddr) { const parsedAddr = typeof rawAddr === 'string' ? JSON.parse(rawAddr) : rawAddr; setAddressParts({ street: parsedAddr.street || '', subdistrict: parsedAddr.subdistrict?.id ?? parsedAddr.subdistrict ?? '', district: parsedAddr.district?.id ?? parsedAddr.district ?? '', province: parsedAddr.province?.id ?? parsedAddr.province ?? '', postcode: parsedAddr.postcode || '' }) } } catch (e) {}
      try { setBusinessSchedule(parseBusinessSchedule(updatedProfile.businessHours)) } catch (e) {}
      setProfileImage({ file: null, preview: '' })
      setModalError('')
      setProfileModalOpen(false)
    } catch (error) {
      setModalError(error?.response?.data?.error?.message || 'บันทึกข้อมูลร้านไม่สำเร็จ')
    } finally { setProfileSubmitting(false) }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault(); if (!storeIdResolved) return
    if (profilePasswords.newPassword !== profilePasswords.confirmPassword) { setModalError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน'); return }
    setPasswordSubmitting(true); setModalError('')
    try { await api.post(`/store/${storeIdResolved}/change-password`, { old_password: profilePasswords.currentPassword, new_password: profilePasswords.newPassword }); setModalError('เปลี่ยนรหัสผ่านสำเร็จ'); setProfileModalOpen(false) } catch (e) { setModalError(e?.response?.data?.error?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ') } finally { setPasswordSubmitting(false) }
  }
  // Export options
  const [exportAggregateBy, setExportAggregateBy] = useState('overview') // 'overview' | 'byCustomer' | 'byProduct'
  const [exportStatusFilter, setExportStatusFilter] = useState('all') // 'all' | 'active' | 'nearing' | 'expired'
  const [exportIncludeDetails, setExportIncludeDetails] = useState(true)
  // Pivot export options
  const [exportMode, setExportMode] = useState('raw') // 'raw' | 'aggregate' | 'pivot'
  const [pivotByCustomer, setPivotByCustomer] = useState(true)
  const [pivotByProduct, setPivotByProduct] = useState(false)
  const [pivotByStatus, setPivotByStatus] = useState(false)
  const [pivotByMonth, setPivotByMonth] = useState(false)
  const [pivotAggType, setPivotAggType] = useState('count') // 'count' currently supported

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

// Dashboard header is provided by DashboardLayout (shared), so notification
// state and SSE are handled there. Removed duplicate header/notification logic.

  // ---------- โปรไฟล์เมนูเหมือนหน้า Warranty ----------
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false)

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
      // do not re-fetch here to avoid rapid loading state toggles;
      // rely on optimistic update and SSE / periodic fetch on mount
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
      if (isProfileMenuOpen && profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [isProfileMenuOpen])

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

  // responsive donut size
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  useEffect(() => {
    function onResize() { setWindowWidth(window.innerWidth) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const donutSize = windowWidth < 420 ? 140 : 200

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

      // If user requested pivot mode, build raw data sheet + pivot summary sheet
      if (exportMode === 'pivot') {
        // Flatten items
        const flat = []
        for (const h of (filteredWarranties || [])) {
          for (const it of (h.items || [])) {
            const status = it.status || it._status || deriveItemStatusCode(it, profile?.notifyDaysInAdvance ?? 14)
            const created = h.createdAt || h.created_at || ''
            const createdMonth = created ? (new Date(created)).toISOString().slice(0,7) : ''
            flat.push({
              headerId: h.id || h.headerId || '',
              customer: h.customerName || h.customer_name || '',
              customerEmail: h.customerEmail || h.customer_email || '',
              product: it.productName || it.product_name || '',
              serial: it.serial || it.serialNumber || '',
              status,
              createdAt: created,
              createdMonth,
              expiryDate: it.expiryDate || it.expiry_date || ''
            })
          }
        }
        const dataSheet = XLSX.utils.json_to_sheet(flat)
        XLSX.utils.book_append_sheet(wb, dataSheet, 'Data')

        // Determine grouping keys
        const groupFields = []
        if (pivotByCustomer) groupFields.push('customer')
        if (pivotByProduct) groupFields.push('product')
        if (pivotByStatus) groupFields.push('status')
        if (pivotByMonth) groupFields.push('createdMonth')

        // Aggregate
        const map = new Map()
        if (groupFields.length === 0) {
          // total only
          const total = { Count: flat.length }
          const ws = XLSX.utils.json_to_sheet([total])
          XLSX.utils.book_append_sheet(wb, ws, 'Pivot')
        } else {
          for (const r of flat) {
            const keyParts = groupFields.map(f => String(r[f] ?? ''))
            const key = keyParts.join('||')
            const entry = map.get(key) || { __count: 0, __values: Object.fromEntries(groupFields.map((f, i) => [f, keyParts[i]])) }
            entry.__count += 1
            map.set(key, entry)
          }
          const rows = []
          for (const e of map.values()) {
            const out = { }
            for (const f of groupFields) out[f] = e.__values[f]
            out.Count = e.__count
            rows.push(out)
          }
          const ws = XLSX.utils.json_to_sheet(rows)
          XLSX.utils.book_append_sheet(wb, ws, 'Pivot')
        }
      } else {
        // existing behavior: raw/aggregate modes
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
      }

      const now = new Date().toISOString().slice(0,19).replaceAll(':','-')
      const fileName = `warranty-export-${exportMode}-${exportAggregateBy}-${exportStatusFilter}-${exportIncludeDetails ? 'details' : 'nodetails'}-${now}.xlsx`
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
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-sky-100/60 pb-12 px-2 sm:px-6 md:px-8 overflow-x-hidden">
      {/* Header provided by shared `/dashboard` layout */}

      <main className="mx-auto max-w-6xl px-0 py-8">
        <div className="mb-6">
          <StoreTabs />
        </div>

        {/* การ์ดหลักแบบหน้าการจัดการ */}
        <section className="rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm">
          {/* หัวการ์ด */}
          <div className="flex items-center justify-between px-3 sm:px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">ภาพรวม & การรับประกัน</h2>
              <p className="text-sm text-slate-500">สรุปภาพรวมการรับประกันและสินค้าของร้าน</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <label className="text-xs text-slate-500">โหมดส่งออก</label>
              <select value={exportMode} onChange={(e) => setExportMode(e.target.value)} className="rounded-md border px-2 py-1 text-sm max-w-[140px] sm:max-w-[190px]">
                <option value="raw">Raw</option>
                <option value="aggregate">Aggregate</option>
                <option value="pivot">Pivot</option>
              </select>

              {exportMode !== 'pivot' && (
                <>
                  <label className="text-xs text-slate-500">สรุปตาม</label>
                  <select value={exportAggregateBy} onChange={(e) => setExportAggregateBy(e.target.value)} className="rounded-md border px-2 py-1 text-sm max-w-[140px] sm:max-w-[190px]">
                    <option value="overview">ภาพรวม</option>
                    <option value="byCustomer">สรุปตามลูกค้า</option>
                    <option value="byProduct">สรุปตามสินค้า</option>
                  </select>

                  <label className="text-xs text-slate-500">สถานะ</label>
                  <select value={exportStatusFilter} onChange={(e) => setExportStatusFilter(e.target.value)} className="rounded-md border px-2 py-1 text-sm max-w-[120px] sm:max-w-[160px]">
                    <option value="all">ทั้งหมด</option>
                    <option value="active">กำลังใช้งาน</option>
                    <option value="nearing">ใกล้หมดอายุ</option>
                    <option value="expired">หมดอายุ</option>
                  </select>

                  <label className="text-sm flex items-center gap-2">
                    <input type="checkbox" checked={exportIncludeDetails} onChange={(e) => setExportIncludeDetails(e.target.checked)} />
                    <span className="text-xs text-slate-600">รวมรายละเอียด</span>
                  </label>
                </>
              )}

              {exportMode === 'pivot' && (
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="text-xs text-slate-500">จัดกลุ่มตาม</div>
                  <label className="text-xs text-slate-600 flex items-center gap-1"><input type="checkbox" checked={pivotByCustomer} onChange={(e) => setPivotByCustomer(e.target.checked)} /> ลูกค้า</label>
                  <label className="text-xs text-slate-600 flex items-center gap-1"><input type="checkbox" checked={pivotByProduct} onChange={(e) => setPivotByProduct(e.target.checked)} /> สินค้า</label>
                  <label className="text-xs text-slate-600 flex items-center gap-1"><input type="checkbox" checked={pivotByStatus} onChange={(e) => setPivotByStatus(e.target.checked)} /> สถานะ</label>
                  <label className="text-xs text-slate-600 flex items-center gap-1"><input type="checkbox" checked={pivotByMonth} onChange={(e) => setPivotByMonth(e.target.checked)} /> เดือนสร้าง</label>
                  <label className="text-xs text-slate-500">Agg</label>
                  <select value={pivotAggType} onChange={(e) => setPivotAggType(e.target.value)} className="rounded-md border px-2 py-1 text-sm max-w-[120px]">
                    <option value="count">Count</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={exportOverviewToExcel}
                className={`h-10 min-w-0 sm:min-w-[96px] rounded-full border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700 bg-white hover:-translate-y-0.5 hover:bg-sky-50 transition self-center`}
                aria-label="ส่งออกเป็น Excel"
              >
                ส่งออก Excel
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* KPI Overview */}
          <div className="px-3 sm:px-6 py-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-4 rounded-2xl bg-white p-3 sm:p-4 shadow-sm ring-1 ring-black/3 min-w-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600 text-lg font-semibold">📄</div>
                <div>
                  <div className="text-xs text-slate-500">ใบรับประกัน</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{totals.totalHeaders}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-white p-3 sm:p-4 shadow-sm ring-1 ring-black/3 min-w-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 text-lg font-semibold">✅</div>
                <div>
                  <div className="text-xs text-slate-500">กำลังใช้งาน</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-600">{totals.active}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-white p-3 sm:p-4 shadow-sm ring-1 ring-black/3 min-w-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 text-lg font-semibold">⚠️</div>
                <div>
                  <div className="text-xs text-slate-500">ใกล้หมดอายุ</div>
                  <div className="mt-1 text-2xl font-bold text-amber-600">{totals.nearing}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/3 min-w-0">
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
          <div className="px-3 sm:px-6 py-6">
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

            <div className="flex flex-col md:flex-row items-center md:justify-between">
              <div className="flex-1 min-w-0 flex justify-center">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl w-full">
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
              <div className="md:ml-8 mt-4 md:mt-0 flex items-center justify-center min-w-0">
                <SimpleDonut counts={totals} size={donutSize} thickness={30} />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Aggregate view when user selected byCustomer / byProduct */}
          {exportAggregateBy === 'byCustomer' && (
            <div className="px-3 sm:px-6 py-6">
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
            <div className="px-4 sm:px-6 py-6">
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

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-4 sm:py-6">
          <div className="w-full max-w-full sm:max-w-lg mx-auto rounded-3xl border border-sky-200 bg-white shadow-2xl max-h-[94vh] overflow-x-hidden overflow-y-auto box-border">
            <div className="sticky top-0 z-30 flex items-center justify-between border-b border-sky-100 px-3 sm:px-6 py-3 sm:py-4 bg-white">
              <div className="flex items-center gap-3">
                {profileAvatarSrc ? (
                  <img src={profileAvatarSrc} alt="Store profile" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-sky-200 text-2xl">🏪</div>
                )}
                <div>
                  <div className="text-base font-semibold text-gray-900">แก้ไขข้อมูลโปรไฟล์</div>
                  <div className="text-xs text-sky-600">ข้อมูลจะใช้โชว์ในหัวหน้า dashboard</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileModalOpen(false)
                  setModalError('')
                  setProfileSubmitting(false)
                  setPasswordSubmitting(false)
                }}
                className="text-2xl text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

              <div className="px-4 sm:px-6 pt-2 overflow-y-auto pb-20" style={{ maxHeight: 'calc(94vh - 140px)' }}>
                <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setProfileTab('info'); setModalError('') }}
                  className={`flex-1 min-w-0 rounded-2xl px-4 py-2 text-sm font-medium ${profileTab === 'info' ? 'bg-sky-100 text-sky-700' : 'bg-sky-50 text-gray-500'}`}
                >
                  ข้อมูลร้านค้า
                </button>
                <button
                  type="button"
                  onClick={() => { setProfileTab('password'); setModalError('') }}
                  className={`flex-1 min-w-0 rounded-2xl px-4 py-2 text-sm font-medium ${profileTab === 'password' ? 'bg-sky-100 text-sky-700' : 'bg-sky-50 text-gray-500'}`}
                >
                  เปลี่ยนรหัสผ่าน
                </button>
              </div>

            {profileTab === 'info' ? (
              <form id="profileForm" onSubmit={handleProfileSubmit} className="px-4 sm:px-6 pb-6">
                <input ref={profileImageInputRef} accept="image/*" className="sr-only" onChange={handleProfileAvatarSelect} type="file" />
                <input
                  type="hidden"
                  name="address"
                  value={JSON.stringify({
                    street: addressParts.street,
                    province: {
                      id: addressParts.province,
                      name: (provincesList.find((p) => String(p.code) === String(addressParts.province))?.name) || addressParts.province || '',
                    },
                    district: {
                      id: addressParts.district,
                      name: (districtOptions.find((d) => String(d.code) === String(addressParts.district))?.name) || addressParts.district || '',
                    },
                    subdistrict: {
                      id: addressParts.subdistrict,
                      name: (subdistrictOptions.find((s) => String(s.code) === String(addressParts.subdistrict))?.name) || addressParts.subdistrict || '',
                      zipcode: addressParts.postcode || (subdistrictOptions.find((s) => String(s.code) === String(addressParts.subdistrict))?.zipcode || ''),
                    },
                    postcode: addressParts.postcode,
                  })}
                />
                <input type="hidden" name="businessHours" value={JSON.stringify(businessSchedule)} />
                <div className="mb-4 flex items-center gap-4">
                  {profileAvatarSrc ? (
                    <img src={profileAvatarSrc} alt="Store profile" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-sky-200 text-3xl">🏪</div>
                  )}
                  <div>
                    <button
                      type="button"
                      onClick={() => profileImageInputRef.current?.click()}
                      className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-sky-400"
                    >
                      อัปโหลดรูปใหม่
                    </button>
                    <div className="mt-1 text-xs text-gray-400">รองรับไฟล์ .jpg, .png ขนาดไม่เกิน 2 MB</div>
                  </div>
                </div>
                {modalError && profileTab === 'info' && (
                  <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{modalError}</div>
                )}
                <div className="grid gap-3">
                  {[
                    ['storeName', 'ชื่อร้าน'],
                    ['contactName', 'ชื่อผู้ติดต่อ'],
                    ['email', 'อีเมล'],
                    ['phone', 'เบอร์ติดต่อ'],
                    ['address', 'ที่อยู่'],
                    ['businessHours', 'เวลาทำการ'],
                  ].map(([key, label]) => (
                      <label key={key} className="text-sm text-gray-600">
                        {label}
                        {key === 'address' ? (
                          <div className="mt-2 grid gap-2">
                            <textarea
                              placeholder="เลขที่ ซอย ถนน"
                              value={addressParts.street}
                              onChange={(e) => setAddressParts((p) => ({ ...p, street: e.target.value }))}
                              rows={2}
                              className="mt-1 w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none bg-sky-50/60"
                              type="text"
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="sr-only">จังหวัด</label>
                                <select
                                  value={addressParts.province}
                                  onChange={async (e) => {
                                    const code = e.target.value
                                    setAddressParts((p) => ({ ...p, province: code, district: '', subdistrict: '', postcode: '' }))
                                    await loadDistrictsForProvince(code)
                                    setSubdistrictOptions([])
                                  }}
                                  className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                >
                                  <option value="">เลือกจังหวัด</option>
                                  {provincesList.length > 0 ? provincesList.map((p) => (
                                    <option key={p.code} value={p.code}>{p.name}</option>
                                  )) : null}
                                </select>
                              </div>

                              <div>
                                <label className="sr-only">อำเภอ/เขต</label>
                                <select
                                  value={addressParts.district}
                                  onChange={async (e) => {
                                    const code = e.target.value
                                    setAddressParts((p) => ({ ...p, district: code, subdistrict: '', postcode: '' }))
                                    await loadSubdistrictsForDistrict(code)
                                  }}
                                  className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                >
                                  <option value="" disabled>{districtOptions.length ? 'เลือกอำเภอ/เขต' : 'เลือกอำเภอ/เขต'}</option>
                                  {districtOptions.map((d) => (
                                    <option key={d.code} value={d.code}>{d.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="sr-only">ตำบล/แขวง</label>
                                <select
                                  value={addressParts.subdistrict}
                                  onChange={(e) => {
                                    const code = e.target.value
                                    const found = subdistrictOptions.find((s) => String(s.code) === String(code))
                                    setAddressParts((p) => ({ ...p, subdistrict: code, postcode: found?.zipcode || '' }))
                                  }}
                                  className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                >
                                  <option value="" disabled>{subdistrictOptions.length ? 'เลือกตำบล/แขวง' : 'เลือกตำบล/แขวง'}</option>
                                  {subdistrictOptions.map((s) => (
                                    <option key={s.code} value={s.code}>{s.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                placeholder="รหัสไปรษณีย์"
                                value={addressParts.postcode}
                                onChange={(e) => setAddressParts((p) => ({ ...p, postcode: e.target.value }))}
                                className="mt-1 w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none bg-sky-50/60"
                                type="text"
                              />
                              <div className="text-xs text-gray-400 flex items-center">ตัวอย่าง: เลขที่/ซอย/ถนน, ตำบล, อำเภอ, จังหวัด</div>
                            </div>
                          </div>
                        ) : key !== 'businessHours' ? (
                          <input
                            required
                            value={profile?.[key] ?? ''}
                            onChange={(e) => setProfile((prev) => ({ ...prev, [key]: e.target.value }))}
                            readOnly={key === 'email'}
                            className={`mt-1 w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none ${key === 'email' ? 'bg-slate-100' : 'bg-sky-50/60'}`}
                            type="text"
                          />
                        ) : (
                          <div className="mt-2 rounded-lg border border-sky-100 bg-white p-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {[
                                ['mon', 'จ.'],
                                ['tue', 'อ.'],
                                ['wed', 'พ.'],
                                ['thu', 'พฤ.'],
                                ['fri', 'ศ.'],
                                ['sat', 'ส.'],
                                ['sun', 'อา.'],
                                ].map(([d, lbl]) => (
                                <div key={d} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs md:text-sm">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={!!businessSchedule[d]?.on}
                                      onChange={() => setBusinessSchedule((s) => ({ ...s, [d]: { ...s[d], on: !s[d].on } }))}
                                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                    />
                                    <div className="w-8 text-xs text-gray-700">{lbl}</div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-0 sm:ml-2 flex-wrap min-w-0">
                                    <input
                                      type="time"
                                      value={businessSchedule[d]?.start || '09:00'}
                                      onChange={(e) => setBusinessSchedule((s) => ({ ...s, [d]: { ...s[d], start: e.target.value } }))}
                                      className="h-8 w-16 sm:w-20 rounded border border-gray-200 px-2 text-xs min-w-0"
                                      disabled={!businessSchedule[d]?.on}
                                    />
                                    <span className="text-xs text-gray-400">—</span>
                                    <input
                                      type="time"
                                      value={businessSchedule[d]?.end || '18:00'}
                                      onChange={(e) => setBusinessSchedule((s) => ({ ...s, [d]: { ...s[d], end: e.target.value } }))}
                                      className="h-8 w-16 sm:w-20 rounded border border-gray-200 px-2 text-xs min-w-0"
                                      disabled={!businessSchedule[d]?.on}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 text-xs text-slate-400">ขนาดกะทัดรัดสำหรับการแก้ไข (responsive)</div>
                          </div>
                        )}
                      </label>
                  ))}
                </div>
              </form>
            ) : (
              <form id="passwordForm" onSubmit={handlePasswordSubmit} className="px-4 sm:px-6 pb-6">
                {modalError && profileTab === 'password' && (
                  <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{modalError}</div>
                )}
                <div className="grid gap-3">
                  {[
                    ['currentPassword', 'รหัสผ่านเก่า'],
                    ['newPassword', 'รหัสผ่านใหม่'],
                    ['confirmPassword', 'ยืนยันรหัสผ่านใหม่'],
                  ].map(([key, label]) => (
                    <label key={key} className="text-sm text-gray-600">
                      {label}
                      <input
                        required
                        value={profilePasswords[key]}
                        onChange={(e) => setProfilePasswords((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                        type="password"
                      />
                    </label>
                  ))}
                </div>
              </form>
            )}

            </div>

            <div className="border-t border-slate-100 px-4 sm:px-6 py-3 bg-white sticky bottom-0 z-40">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setProfileModalOpen(false); setModalError(''); }}
                  className="rounded-full px-4 py-2 text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                {profileTab === 'info' ? (
                  <button
                    type="submit"
                    form="profileForm"
                    disabled={profileSubmitting}
                    className={`rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow transition ${profileSubmitting ? 'cursor-not-allowed opacity-70' : 'hover:bg-sky-500'}`}
                  >
                    {profileSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="passwordForm"
                    disabled={passwordSubmitting}
                    className={`rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow transition ${passwordSubmitting ? 'cursor-not-allowed opacity-70' : 'hover:bg-sky-400'}`}
                  >
                    {passwordSubmitting ? 'กำลังบันทึก...' : 'ยืนยัน'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}