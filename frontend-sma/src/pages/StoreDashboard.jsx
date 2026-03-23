import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { api, API_URL, getToken } from '../lib/api'
import { stripEmojisAndSpecials } from '../lib/text'
import { useAuth } from '../store/auth'
import StoreTabs from '../components/StoreTabs'
import SimpleDonut from '../components/SimpleDonut'
import BarChart from '../components/BarChart'
import ExtendWarrantyModal from '../components/ExtendWarrantyModal'
import SatisfactionSurveyModal from '../components/SatisfactionSurveyModal'
import AppLogo from '../components/AppLogo'
import EmptyStateCard from '../components/EmptyStateCard'
import warrantyCopy from '../lib/warranty_copy.json'
import introJs from 'intro.js'
import 'intro.js/introjs.css'

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
  const [chartMode, setChartMode] = useState('created') // 'created' | 'expiring'
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
  const [pwStrength, setPwStrength] = useState(0)
  const [pwChecks, setPwChecks] = useState({
    length: false,
    lower: false,
    upper: false,
    digit: false,
    symbol: false,
  })
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  useEffect(() => {
    const pw = profilePasswords.newPassword || ''
    const checks = {
      length: pw.length >= 8,
      lower: /[a-z]/.test(pw),
      upper: /[A-Z]/.test(pw),
      digit: /[0-9]/.test(pw),
      symbol: /[^A-Za-z0-9]/.test(pw),
    }
    setPwChecks(checks)
    const count = [checks.length, checks.lower, checks.upper, checks.digit, checks.symbol].filter(Boolean).length
    if (!pw) setPwStrength(0)
    else if (count <= 2) setPwStrength(1)
    else if (count <= 4) setPwStrength(2)
    else setPwStrength(3)
  }, [profilePasswords.newPassword])
  const [profileStoreTypeValue, setProfileStoreTypeValue] = useState('')
  const [profileCustomStoreType, setProfileCustomStoreType] = useState('')

  // Extend warranty modal state
  const [extendModalOpen, setExtendModalOpen] = useState(false)
  const [selectedItemForExtend, setSelectedItemForExtend] = useState(null)
  const [extendListPage, setExtendListPage] = useState(1)
  const ITEMS_PER_PAGE = 10

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
        setProvincesList(provData.map((p) => ({ name: p.name_th || p.name, code: p.id ?? p.code })).sort((a, b) => a.name.localeCompare(b.name, 'th')))
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
      if (districtsMap) { const list = districtsMap[pid] || []; setDistrictOptions(list.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })).sort((a, b) => a.name.localeCompare(b.name, 'th'))); return }
      let districtsData = districtsCache
      if (!districtsData) { let res = await fetch(DISTRICTS_JSON_LOCAL); if (!res.ok) res = await fetch(DISTRICTS_JSON_FALLBACK); districtsData = await res.json(); setDistrictsCache(districtsData) }
      const filtered = districtsData.filter((d) => String(d.province_id ?? d.province_code) === pid)
      setDistrictOptions(filtered.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })).sort((a, b) => a.name.localeCompare(b.name, 'th')))
    } catch (err) { console.error('loadDistrictsForProvince error', err); setDistrictOptions([]) }
  }

  async function loadSubdistrictsForDistrict(districtCode) {
    try {
      if (!districtCode) { setSubdistrictOptions([]); return }
      const did = String(districtCode)
      if (subdistrictsMap) { const list = subdistrictsMap[did] || []; setSubdistrictOptions(list.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })).sort((a, b) => a.name.localeCompare(b.name, 'th'))); return }
      let subs = subdistrictsCache
      if (!subs) { let res = await fetch(SUBDISTRICTS_JSON_LOCAL); if (!res.ok) res = await fetch(SUBDISTRICTS_JSON_FALLBACK); subs = await res.json(); setSubdistrictsCache(subs) }
      const filtered = subs.filter((s) => String(s.district_id ?? s.district_code) === did)
      setSubdistrictOptions(filtered.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })).sort((a, b) => a.name.localeCompare(b.name, 'th')))
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
        try { const prov = parsed.province?.id ?? parsed.province ?? ''; if (prov) await loadDistrictsForProvince(prov); const dist = parsed.district?.id ?? parsed.district ?? ''; if (dist) await loadSubdistrictsForDistrict(dist) } catch (e) { }
      } else if (raw && typeof raw === 'object') {
        setAddressParts({ street: raw.street || '', subdistrict: raw.subdistrict?.id ?? raw.subdistrict ?? '', district: raw.district?.id ?? raw.district ?? '', province: raw.province?.id ?? raw.province ?? '', postcode: raw.postcode || '' })
        try { const prov = raw.province?.id ?? raw.province ?? ''; if (prov) await loadDistrictsForProvince(prov); const dist = raw.district?.id ?? raw.district ?? ''; if (dist) await loadSubdistrictsForDistrict(dist) } catch (e) { }
      } else {
        setAddressParts({ street: String(profile?.address || '') || '', subdistrict: '', district: '', province: '', postcode: '' })
      }
    } catch (e) { setAddressParts({ street: String(profile?.address || '') || '', subdistrict: '', district: '', province: '', postcode: '' }) }
    // init store type selector from profile.storeType
    try {
      const rawType = (profile?.storeType || '').toString().trim()
      const known = ['electronics', 'appliance', 'furniture', 'automotive', 'machine']
      let base = ''
      let custom = ''
      if (rawType) {
        if (rawType.startsWith('other:')) {
          base = 'other'
          custom = rawType.slice(6).trim()
        } else if (known.includes(rawType)) {
          base = rawType
        } else {
          base = 'other'
          custom = rawType
        }
      }
      setProfileStoreTypeValue(base)
      setProfileCustomStoreType(custom)
    } catch (e) {
      setProfileStoreTypeValue('')
      setProfileCustomStoreType('')
    }
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
      const baseType = (profileStoreTypeValue || '').toString().trim()
      let finalStoreType = baseType
      if (baseType === 'other') {
        finalStoreType = `other:${String(profileCustomStoreType || '').trim()}`
      }
      if (!finalStoreType && profile?.storeType) {
        finalStoreType = profile.storeType
      }
      const payload = {
        storeName: profile?.storeName,
        contactName: profile?.contactName,
        email: profile?.email,
        phone: profile?.phone,
        storeType: finalStoreType,
        address: JSON.stringify({ street: addressParts.street || '', subdistrict: addressParts.subdistrict || '', district: addressParts.district || '', province: addressParts.province || '', postcode: addressParts.postcode || '' }),
        businessHours: JSON.stringify(businessSchedule),
        avatarUrl: profile?.avatarUrl,
      }
      const response = await api.patch(`/store/${storeIdResolved}/profile`, payload)
      const updatedProfile = response.data?.data?.storeProfile ?? payload
      setProfile((prev) => ({ ...prev, ...updatedProfile }))
      try { const rawAddr = updatedProfile.address; if (rawAddr) { const parsedAddr = typeof rawAddr === 'string' ? JSON.parse(rawAddr) : rawAddr; setAddressParts({ street: parsedAddr.street || '', subdistrict: parsedAddr.subdistrict?.id ?? parsedAddr.subdistrict ?? '', district: parsedAddr.district?.id ?? parsedAddr.district ?? '', province: parsedAddr.province?.id ?? parsedAddr.province ?? '', postcode: parsedAddr.postcode || '' }) } } catch (e) { }
      try { setBusinessSchedule(parseBusinessSchedule(updatedProfile.businessHours)) } catch (e) { }
      setProfileImage({ file: null, preview: '' })
      setModalError('')
      setProfileModalOpen(false)
    } catch (error) {
      setModalError(error?.response?.data?.error?.message || 'บันทึกข้อมูลร้านไม่สำเร็จ')
    } finally { setProfileSubmitting(false) }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    if (!storeIdResolved) return
    if (profilePasswords.newPassword !== profilePasswords.confirmPassword) {
      setModalError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน')
      return
    }
    if ((profilePasswords.newPassword || '').length < 8) {
      setModalError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    if (pwStrength < 3) {
      setModalError('กรุณาตั้งรหัสผ่านใหม่ให้ถึงระดับความปลอดภัยสูงก่อนบันทึก')
      return
    }
    setPasswordSubmitting(true)
    setModalError('')
    try {
      await api.post(`/store/${storeIdResolved}/change-password`, {
        old_password: profilePasswords.currentPassword,
        new_password: profilePasswords.newPassword,
      })
      setProfilePasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setModalError('')
      setProfileModalOpen(false)
    } catch (e) {
      setModalError(e?.response?.data?.error?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    } finally {
      setPasswordSubmitting(false)
    }
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
  const [pivotFields, setPivotFields] = useState({ customer: true, customerEmail: false, product: true, serial: false, expiryDate: true, createdAt: true })
  const overviewTourStartedRef = useRef(false)
  // Popup แบบประเมินความพึงพอใจของร้านค้า (ครั้งเดียวหลังออกใบครบ 3 ใบ)
  const [surveyOpen, setSurveyOpen] = useState(false)
  const surveyCheckedRef = useRef(false)

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
      const res = await api.get('/notifications')
      const data = res?.data?.data || res?.data || []
      const arr = Array.isArray(data) ? data : []
      arr.sort((a, b) => new Date(b.createdAt || b.time || b.created_at || 0) - new Date(a.createdAt || a.time || a.created_at || 0))
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
    } catch (e) { }
  }

  useEffect(() => { fetchSummary() }, [fetchSummary])
  // fetch notifications on mount so unread count shows before user clicks bell
  useEffect(() => { fetchNotifications().catch(() => { }) }, [fetchNotifications])

  // ตรวจสอบเงื่อนไขแสดง popup แบบประเมินความพึงพอใจ (ฝั่งร้านค้า)
  useEffect(() => {
    if (!user) return
    if (user.role !== 'STORE') return
    if (loading) return
    if (surveyCheckedRef.current) return

    surveyCheckedRef.current = true

    api
      .get('/public/usage-survey')
      .then((res) => {
        if (res?.data?.shouldShow) {
          setSurveyOpen(true)
        }
      })
      .catch(() => {
        // ไม่ต้องทำอะไร ถ้าเรียก endpoint นี้ไม่สำเร็จ เพื่อไม่ให้กระทบ dashboard หลัก
      })
  }, [user, loading])

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

  // Welcome onboarding modal ถูกย้ายไปหน้า WarrantyDashboard (default page)

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
        label: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][date.getDay()],
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
        label: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][date.getMonth()],
        value: (filteredWarranties || []).filter(w => {
          const wDate = new Date(w.createdAt || w.created_at)
          return wDate.getMonth() === date.getMonth() && wDate.getFullYear() === date.getFullYear()
        }).length
      }
    }).reverse()
  }, [filteredWarranties])

  // ---------- Intro.js tour สำหรับแท็บ "ภาพรวม" ----------
  const overviewTourSteps = useMemo(() => [
    {
      element: '#step-overview-stats',
      intro: 'ดูสรุปสถิติทั้งหมดของร้านคุณได้ที่นี่ เพื่อติดตามการเติบโต',
      position: 'bottom',
      tooltipClass: 'custom-tooltip-left',
    },
    {
      element: '#step-overview-chart',
      intro: 'ตรวจสอบสถานะการรับประกันและกราฟภาพรวมรายเดือนได้อย่างรวดเร็ว',
      position: 'bottom',
      tooltipClass: 'custom-tooltip-left',
    },
    {
      element: '#step-header-complaint',
      intro: 'หากพบปัญหาการใช้งาน หรือต้องการความช่วยเหลือ สามารถกดแจ้งปัญหาได้ที่นี่',
      position: 'bottom',
    },
    {
      element: '#step-header-profile',
      intro: 'จัดการข้อมูลร้านค้า แก้ไขโปรไฟล์ หรือออกจากระบบได้ที่เมนูนี้',
      position: 'bottom',
    },
  ], [])

  // Export current overview or aggregates to Excel
  // Export current overview or aggregates to Excel
  async function exportOverviewToExcel() {
    try {
      if (!storeIdResolved) return
      setLoading(true)

      const response = await api.get(`/store/${storeIdResolved}/export-warranties`, {
        responseType: 'blob', // สำคัญ! รับเป็นไฟล์
      })

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url

      // Extract filename from header or default
      let fileName = `warranty-report-${storeIdResolved}.xlsx`
      const contentDisposition = response.headers['content-disposition']
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/)
        if (fileNameMatch && fileNameMatch.length === 2) fileName = fileNameMatch[1]
      }

      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      setLoading(false)
    } catch (err) {
      console.error('Export to Excel failed', err)
      alert('ไม่สามารถดาวน์โหลดไฟล์ได้: ' + (err?.response?.data?.error || err.message || String(err)))
      setLoading(false)
    }
  }

  // Run overview tour ครั้งแรกที่เข้าแท็บนี้ (per store + browser)
  useEffect(() => {
    if (loading) return
    if (!storeIdResolved) return
    if (overviewTourStartedRef.current) return

    try {
      const key = `wp_seen_tour_overview_v2_${storeIdResolved}`
      const ls = typeof window !== 'undefined' ? window.localStorage : null
      const seen = ls ? ls.getItem(key) : null
      if (seen) return

      if (typeof window === 'undefined' || typeof document === 'undefined') return

      let attempts = 0
      const maxAttempts = 20
      const intervalMs = 250
      let timer = null

      const tryStart = () => {
        attempts += 1
        const statsEl = document.querySelector('#step-overview-stats')
        const chartEl = document.querySelector('#step-overview-chart')
        const complaintEl = document.querySelector('#step-header-complaint')
        const profileEl = document.querySelector('#step-header-profile')

        const ready = statsEl && chartEl && complaintEl && profileEl
        const timedOut = attempts >= maxAttempts

        if (!ready && !timedOut) return

        if (timer) window.clearInterval(timer)

        // ถ้า DOM ยังไม่พร้อมครบ แม้หมดเวลาแล้ว ให้ยกเลิกโดยไม่ mark ว่าเคยดู
        if (!ready) return

        if (ls) ls.setItem(key, '1')
        overviewTourStartedRef.current = true

        const intro = introJs()
        intro.setOptions({
          steps: overviewTourSteps,
          showProgress: true,
          showBullets: false,
          exitOnOverlayClick: false,
          overlayOpacity: 0.5,
          nextLabel: 'ถัดไป',
          prevLabel: 'ย้อนกลับ',
          skipLabel: 'ข้าม',
          doneLabel: 'เสร็จสิ้น',
          showStepNumbers: false,
        })
        intro.start()
      }

      timer = window.setInterval(tryStart, intervalMs)
      return () => {
        if (timer) window.clearInterval(timer)
      }
    } catch (e) {
      // ignore
    }
  }, [loading, storeIdResolved, overviewTourSteps])

  if (loading) return <div className="p-6 text-sm text-slate-500">กำลังโหลดข้อมูลสรุป...</div>
  if (error) return <div className="p-6 text-sm text-rose-600">{error}</div>

  const pct = (n) => (totals.totalItems ? Math.round((n / totals.totalItems) * 100) : 0)

  return (
    <div className="min-h-screen pb-12 px-2 sm:px-6 md:px-8 overflow-x-hidden" style={{ background: 'rgb(231, 243, 252)' }}>
      {/* Header provided by shared `/dashboard` layout */}

      <main className="mx-auto max-w-6xl px-0 py-8">
        <div className="mb-6">
          <StoreTabs />
        </div>

        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
              ยินดีต้อนรับ, {storeDisplayName}
            </h1>
            <p className="text-lg text-black/70">จัดการการรับประกันสินค้าและลูกค้าของคุณ</p>
          </div>
          <button
            type="button"
            onClick={exportOverviewToExcel}
            className="flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold text-white shadow-md hover:opacity-90 transition"
            style={{ background: 'rgb(40, 167, 69)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            ส่งออกข้อมูล Excel
          </button>
        </div>
        {/* If no warranties show Empty State card */}
        {!loading && (!warranties || warranties.length === 0) ? (
          <div className="mb-6">
            <EmptyStateCard
              title={warrantyCopy.emptyState.dashboard.title}
              message={warrantyCopy.emptyState.dashboard.message}
              primaryText={warrantyCopy.emptyState.dashboard.primary_cta}
              secondaryText={warrantyCopy.emptyState.dashboard.secondary_cta}
              onPrimary={() => navigate('/dashboard/warranty')}
            />
          </div>
        ) : null}

        {/* Consolidated Stats & Donut Row */}
        <div
          id="step-overview-stats"
          className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
        >
          {/* Card: ใบรับประกันทั้งหมด */}
          <div className="flex items-center gap-4 rounded-xl bg-white border border-black/10 p-4 shadow-sm">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-white text-2xl"
              style={{ background: 'rgb(0, 113, 235)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="text-base font-medium text-black/70">ใบรับประกันทั้งหมด</div>
              <div className="text-4xl font-bold text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
                {totals.totalHeaders}
              </div>
            </div>
          </div>

          {/* Card: ลูกค้าทั้งหมด */}
          <div className="flex items-center gap-4 rounded-xl bg-white border border-black/10 p-4 shadow-sm">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-white text-2xl"
              style={{ background: 'rgb(40, 167, 69)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-base font-medium text-black/70">ลูกค้าทั้งหมด</div>
              <div className="text-4xl font-bold text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
                {(() => {
                  const custSet = new Set()
                  for (const h of (filteredWarranties || [])) {
                    const key = (h.customerEmail || h.customer_email || h.customerName || h.customer_name || 'Unknown').toLowerCase()
                    custSet.add(key)
                  }
                  return custSet.size
                })()}
              </div>
            </div>
          </div>

          {/* Card: Status Donut (Compact) */}
          <div
            id="step-overview-chart"
            className="flex items-center gap-4 rounded-xl bg-white border border-black/10 p-4 shadow-sm relative overflow-hidden"
          >
            <div className="flex-shrink-0 relative z-10">
              <SimpleDonut counts={totals} size={110} thickness={15} />
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <div className="text-base font-medium text-black/70 mb-2">สถานะการรับประกัน</div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                    <span className="text-black/80">ปกติ</span>
                  </div>
                  <span className="font-bold text-black">{totals.active}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                    <span className="text-black/80">ใกล้หมด</span>
                  </div>
                  <span className="font-bold text-black">{totals.nearing}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
                    <span className="text-black/80">หมดอายุ</span>
                  </div>
                  <span className="font-bold text-black">{totals.expired}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Warranty Chart - Responsive (No Scroll, 6 Months) */}
        <div className="mb-6">
          {/* ✅ Dropdown เลือกโหมดกราฟ */}
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <select
              value={chartMode}
              onChange={e => setChartMode(e.target.value)}
              className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none shadow-sm"
            >
              <option value="created">ใบรับประกันที่สร้าง</option>
              <option value="expiring">ใบรับประกันที่ใกล้หมดอายุ</option>
            </select>
          </div>
          <BarChart
            data={(() => {
              const now = new Date()
              return [...Array(6)].map((_, i) => {
                const date = new Date(now.getFullYear(), now.getMonth() - (5 - i))
                const monthLabel = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][date.getMonth()]
                let count = 0
                if (chartMode === 'created') {
                  count = (filteredWarranties || []).filter((w) => {
                    const wDate = new Date(w.createdAt || w.created_at)
                    return wDate.getMonth() === date.getMonth() && wDate.getFullYear() === date.getFullYear()
                  }).length
                } else {
                  // expiring: นับจำนวนรายการ (items) ที่ใกล้หมดอายุในเดือนนั้น
                  for (const w of (filteredWarranties || [])) {
                    for (const item of (w.items || [])) {
                      if (!item.expiryDate) continue
                      const exp = new Date(item.expiryDate)
                      if (exp.getMonth() === date.getMonth() && exp.getFullYear() === date.getFullYear()) {
                        count++
                      }
                    }
                  }
                }
                return { label: monthLabel, value: count }
              })
            })()}
            height={300}
            title={chartMode === 'created' ? 'ใบรับประกันรายเดือน (ย้อนหลัง 6 เดือน)' : 'สินค้าที่ใกล้หมดอายุรายเดือน (ย้อนหลัง 6 เดือน)'}
            subtitle={chartMode === 'created' ? 'แกนซ้าย: จำนวนใบรับประกัน' : 'แกนซ้าย: จำนวนสินค้าที่ใกล้หมดอายุ'}
            showLine={false}
            yAxisMax={50}
          />
        </div>

        {/* Expiring Soon Widget */}
        {(() => {
          // Get ALL warranty items
          const today = new Date()

          const allItems = []
          for (const w of (filteredWarranties || [])) {
            for (const item of (w.items || [])) {
              const exp = item.expiryDate ? new Date(item.expiryDate) : null
              const daysLeft = exp ? Math.ceil((exp - today) / (1000 * 60 * 60 * 24)) : null
              allItems.push({
                ...item,
                warrantyCode: w.code,
                customerName: w.customerName || w.customer_name || '-',
                customerEmail: w.customerEmail || w.customer_email || '-',
                daysLeft,
                isExpiringSoon: daysLeft !== null && daysLeft > 0 && daysLeft <= 15,
                isExpired: daysLeft !== null && daysLeft <= 0,
              })
            }
          }

          // Sort: expiring soon first, then by days left
          allItems.sort((a, b) => {
            if (a.isExpiringSoon && !b.isExpiringSoon) return -1
            if (!a.isExpiringSoon && b.isExpiringSoon) return 1
            if (a.daysLeft === null) return 1
            if (b.daysLeft === null) return -1
            return a.daysLeft - b.daysLeft
          })

          const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE)
          const currentPage = Math.min(extendListPage, totalPages || 1)
          const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
          const pageItems = allItems.slice(startIdx, startIdx + ITEMS_PER_PAGE)

          if (allItems.length === 0) {
            // ไม่มีรายการที่ใกล้หมดอายุ/หมดอายุ แสดงหน้าเปล่าเฉยๆ (ไม่ต้องซ้ำ EmptyState ด้านบน)
            return null
          }

          return (
            <div className="mt-6 rounded-xl bg-white border border-blue-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">📅</div>
                  <div>
                    <h3 className="text-xl font-bold text-blue-700">ต่ออายุใบรับประกัน</h3>
                    <p className="text-sm text-blue-600">รายการทั้งหมด {allItems.length} รายการ</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                {/* Desktop Table */}
                <table className="w-full text-sm hidden md:table">
                  <thead>
                    <tr className="text-left text-blue-700 border-b border-blue-100">
                      <th className="pb-2 font-medium">ลูกค้า</th>
                      <th className="pb-2 font-medium">สินค้า</th>
                      <th className="pb-2 font-medium">หมดอายุ</th>
                      <th className="pb-2 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item, idx) => (
                      <tr
                        key={item.id || idx}
                        className={`border-b hover:bg-blue-50/50 ${item.isExpired ? 'bg-rose-50' : item.isExpiringSoon ? 'bg-amber-50' : 'border-blue-50'
                          }`}
                      >
                        <td className="py-3">
                          <div className="font-medium text-gray-900">{item.customerName}</div>
                          <div className="text-xs text-gray-500">{item.customerEmail}</div>
                        </td>
                        <td className="py-3">
                          <div className="font-medium text-gray-900">{item.productName || '-'}</div>
                          {item.serial && <div className="text-xs text-gray-500">S/N: {item.serial}</div>}
                        </td>
                        <td className="py-3">
                          <div className={`font-medium ${item.isExpired ? 'text-rose-600' : item.isExpiringSoon ? 'text-amber-600' : 'text-gray-700'
                            }`}>
                            {item.expiryDate
                              ? new Date(item.expiryDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '-'
                            }
                          </div>
                          {item.daysLeft !== null && (
                            <div className={`text-xs ${item.isExpired ? 'text-rose-500' : item.isExpiringSoon ? 'text-amber-500' : 'text-gray-500'
                              }`}>
                              {item.isExpired ? `หมดแล้ว ${Math.abs(item.daysLeft)} วัน` : `อีก ${item.daysLeft} วัน`}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemForExtend(item)
                              setExtendModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition"
                          >
                            <span>📅</span> ต่ออายุ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {pageItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className={`p-4 rounded-xl border shadow-sm ${item.isExpired
                        ? 'bg-rose-50 border-rose-100'
                        : item.isExpiringSoon
                          ? 'bg-amber-50 border-amber-100'
                          : 'bg-white border-blue-100'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium text-gray-900">{item.customerName}</div>
                          <div className="text-xs text-gray-500">{item.customerEmail}</div>
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full font-medium ${item.isExpired
                          ? 'bg-rose-100 text-rose-700'
                          : item.isExpiringSoon
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                          }`}>
                          {item.isExpired
                            ? 'หมดอายุ'
                            : item.isExpiringSoon
                              ? 'ใกล้หมด'
                              : 'ปกติ'}
                        </div>
                      </div>

                      <div className="mb-3 pl-2 border-l-2 border-black/10">
                        <div className="text-sm font-medium text-gray-800">{item.productName || '-'}</div>
                        {item.serial && <div className="text-xs text-gray-500">S/N: {item.serial}</div>}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-black/5 mt-2">
                        <div>
                          <div className="text-xs text-gray-500">วันหมดอายุ</div>
                          <div className={`text-sm font-medium ${item.isExpired ? 'text-rose-600' : 'text-gray-700'}`}>
                            {item.expiryDate
                              ? new Date(item.expiryDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '-'
                            }
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItemForExtend(item)
                            setExtendModalOpen(true)
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition shadow-sm"
                        >
                          <span>📅</span> ต่ออายุ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-blue-100">
                  <div className="text-sm text-gray-500">
                    หน้า {currentPage} / {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setExtendListPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentPage <= 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                    >
                      ← ก่อนหน้า
                    </button>
                    <button
                      type="button"
                      onClick={() => setExtendListPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentPage >= totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                    >
                      ถัดไป →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </main>

      {/* Extend Warranty Modal */}
      <ExtendWarrantyModal
        isOpen={extendModalOpen}
        onClose={() => {
          setExtendModalOpen(false)
          setSelectedItemForExtend(null)
        }}
        item={selectedItemForExtend}
        onSuccess={() => {
          // Refresh data
          fetchSummary()
        }}
      />

      {/* Popup แบบประเมินความพึงพอใจของร้านค้า */}
      <SatisfactionSurveyModal
        open={surveyOpen}
        onClose={() => setSurveyOpen(false)}
        context="store"
      />

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-4 sm:py-6">
          <div className="w-full max-w-full sm:max-w-lg mx-auto rounded-3xl border border-sky-200 bg-white shadow-2xl max-h-[94vh] overflow-x-hidden overflow-y-auto box-border">
            <div className="sticky top-0 z-30 flex items-center justify-between border-b border-sky-100 px-3 sm:px-6 py-3 sm:py-4 bg-white">
              <div className="flex items-center gap-3">
                {profileAvatarSrc ? (
                  <img src={profileAvatarSrc} alt="Store profile" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <img src="/home-assets/store.png" alt="Store profile" className="h-12 w-12 rounded-full object-cover" />
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
                      <img src="/home-assets/store.png" alt="Store profile" className="h-16 w-16 rounded-full object-cover" />
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
                      ['storeType', 'ประเภทร้านค้า'],
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
                              onChange={(e) => setAddressParts((p) => ({ ...p, street: stripEmojisAndSpecials(e.target.value) }))}
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
                                onChange={(e) => setAddressParts((p) => ({ ...p, postcode: e.target.value.replace(/[^0-9]/g, '') }))}
                                maxLength={5}
                                className="mt-1 w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none bg-sky-50/60"
                                type="text"
                              />
                              <div className="text-xs text-gray-400 flex items-center">ตัวอย่าง: เลขที่/ซอย/ถนน, ตำบล, อำเภอ, จังหวัด</div>
                            </div>
                          </div>
                        ) : key === 'storeType' ? (
                          <div className="mt-1 space-y-2">
                            <select
                              value={profileStoreTypeValue}
                              onChange={(e) => {
                                const v = e.target.value
                                setProfileStoreTypeValue(v)
                                if (v !== 'other') setProfileCustomStoreType('')
                              }}
                              className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                              required
                            >
                              <option value="">เลือกประเภทร้านค้า</option>
                              <option value="electronics">อิเล็กทรอนิกส์</option>
                              <option value="appliance">เครื่องใช้ไฟฟ้า</option>
                              <option value="furniture">เฟอร์นิเจอร์</option>
                              <option value="automotive">ยานยนต์</option>
                              <option value="machine">เครื่องจักร / เครื่องมือช่าง</option>
                              <option value="other">อื่น ๆ</option>
                            </select>
                            {profileStoreTypeValue === 'other' && (
                              <input
                                value={profileCustomStoreType}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^a-zA-Z0-9ก-๙\s.\-/]/g, '')
                                  setProfileCustomStoreType(raw)
                                }}
                                placeholder="ระบุประเภทร้านค้า"
                                className="w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none bg-sky-50/60"
                                type="text"
                              />
                            )}
                          </div>
                        ) : key !== 'businessHours' ? (
                          <input
                            required
                            value={profile?.[key] ?? ''}
                            onChange={(e) => {
                              let val = e.target.value
                              if (key === 'phone') val = val.replace(/[^0-9]/g, '')
                              if (key === 'storeName' || key === 'contactName') val = val.replace(/[^a-zA-Z0-9ก-๙\s.\-]/g, '')
                              setProfile((prev) => ({ ...prev, [key]: val }))
                            }}
                            readOnly={key === 'email'}
                            maxLength={key === 'phone' ? 10 : undefined}
                            className={`mt-1 w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none ${key === 'email' ? 'bg-slate-100' : 'bg-sky-50/60'}`}
                            type="text"
                          />
                        ) : (
                          <div className="mt-2 rounded-lg border border-sky-100 bg-white p-2">
                            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-xs text-gray-500">
                                กำหนดเวลาเปิด-ปิดในแต่ละวัน หรือใช้ทางลัดเพื่อตั้งเวลาเดียวกันทุกวัน
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setBusinessSchedule((prev) => {
                                    const entries = Object.entries(prev || {})
                                    const firstOn = entries.find(([, v]) => v?.on && v.start && v.end)
                                    if (!firstOn) return prev
                                    const [, firstVal] = firstOn
                                    const next = { ...prev }
                                    for (const [k, v] of entries) {
                                      if (v?.on) {
                                        next[k] = { ...v, start: firstVal.start, end: firstVal.end }
                                      }
                                    }
                                    return next
                                  })
                                }}
                                className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 hover:border-sky-300 whitespace-nowrap"
                              >
                                ใช้เวลาเดียวกันทุกวันที่เลือก
                              </button>
                            </div>
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
                                      onChange={() =>
                                        setBusinessSchedule((s) => {
                                          const current = s?.[d] || {}
                                          const nextOn = !current.on
                                          const next = { ...(s || {}) }
                                          next[d] = {
                                            ...current,
                                            on: nextOn,
                                            ...(nextOn && {
                                              start: current.start || '09:00',
                                              end: current.end || '18:00',
                                            }),
                                          }
                                          return next
                                        })
                                      }
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
                          onChange={(e) => {
                            let val = e.target.value
                            if (key === 'newPassword' || key === 'confirmPassword') {
                              val = stripEmojis(val).replace(/[\u0E00-\u0E7F]/g, '')
                            }
                            setProfilePasswords((prev) => ({ ...prev, [key]: val }))
                          }}
                          className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                          type="password"
                        />
                        {key === 'newPassword' && profilePasswords.newPassword ? (
                          <div
                            className={
                              "mt-2 rounded-lg border px-3 py-2 " +
                              (pwStrength <= 1
                                ? 'border-red-100 bg-red-50/70'
                                : pwStrength === 2
                                ? 'border-amber-100 bg-amber-50/70'
                                : 'border-emerald-100 bg-emerald-50/70')
                            }
                          >
                            <div className="flex items-center justify-between text-[11px] font-medium">
                              <span className="text-gray-600 flex items-center gap-1">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                                ความปลอดภัยของรหัสผ่านใหม่
                              </span>
                              <span
                                className={
                                  pwStrength <= 1
                                    ? 'text-red-600'
                                    : pwStrength === 2
                                    ? 'text-yellow-600'
                                    : 'text-emerald-600'
                                }
                              >
                                {pwStrength <= 1
                                  ? 'ความปลอดภัยต่ำ'
                                  : pwStrength === 2
                                  ? 'ความปลอดภัยปานกลาง'
                                  : 'ความปลอดภัยสูง'}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className={
                                  'h-full transition-all duration-200 ' +
                                  (pwStrength <= 1
                                    ? 'bg-red-500'
                                    : pwStrength === 2
                                    ? 'bg-yellow-500'
                                    : 'bg-emerald-500')
                                }
                                style={{ width: `${pwStrength <= 1 ? 33 : pwStrength === 2 ? 66 : 100}%` }}
                              />
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                              <p className={pwChecks.length ? 'text-emerald-700' : 'text-gray-500'}>
                                <span className="mr-1">{pwChecks.length ? '✓' : '•'}</span>
                                ยาวอย่างน้อย 8 ตัวอักษรขึ้นไป
                              </p>
                              <p className={pwChecks.lower ? 'text-emerald-700' : 'text-gray-500'}>
                                <span className="mr-1">{pwChecks.lower ? '✓' : '•'}</span>
                                มีตัวอักษรตัวพิมพ์เล็ก (a-z)
                              </p>
                              <p className={pwChecks.upper ? 'text-emerald-700' : 'text-gray-500'}>
                                <span className="mr-1">{pwChecks.upper ? '✓' : '•'}</span>
                                มีตัวอักษรตัวพิมพ์ใหญ่ (A-Z)
                              </p>
                              <p className={pwChecks.digit ? 'text-emerald-700' : 'text-gray-500'}>
                                <span className="mr-1">{pwChecks.digit ? '✓' : '•'}</span>
                                มีตัวเลข (0-9)
                              </p>
                              <p className={pwChecks.symbol ? 'text-emerald-700' : 'text-gray-500'}>
                                <span className="mr-1">{pwChecks.symbol ? '✓' : '•'}</span>
                                มีอักขระพิเศษ เช่น ! @ # $ %
                              </p>
                              <p className="text-[10px] text-gray-400 sm:col-span-2 mt-1">
                                กรุณาตั้งรหัสผ่านใหม่ด้วยตัวอักษรภาษาอังกฤษ (a-z, A-Z) ตัวเลข และสัญลักษณ์ โดยไม่ใช้ตัวอักษรไทยหรืออีโมจิ
                              </p>
                            </div>
                          </div>
                        ) : null}
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

    </div >
  )
}