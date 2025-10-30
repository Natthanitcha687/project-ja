// frontend-sma/src/pages/WarrantyDashboard.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import ImageUpload from '../components/ImageUpload'
import ImagePreview from '../components/ImagePreview'
import AppLogo from '../components/AppLogo'
import Footer from '../components/Footer' // ✅
import StoreTabs from '../components/StoreTabs'

const defaultFilters = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'active', label: 'ใช้งานได้' },
  { value: 'nearing_expiration', label: 'ใกล้หมดอายุ' },
  { value: 'expired', label: 'หมดอายุ' },
]

const initialStoreProfile = {
  storeName: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  businessHours: '',
  avatarUrl: '',
  storeType: '',
  notifyDaysInAdvance: 14,
}

const STATUS_CODE_BY_LABEL = {
  'ใช้งานได้': 'active',
  'ใกล้หมดอายุ': 'nearing_expiration',
  'หมดอายุ': 'expired',
}

// ✅ กำหนดจำนวนใบ/หน้า = 5
const PAGE_SIZE = 5

function StatusBadge({ label, className }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  )
}

function IconButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative grid h-10 w-10 place-items-center rounded-full bg-white shadow ring-1 ring-black/5 hover:bg-gray-50"
      aria-label={label}
    >
      <span className="text-xl">{icon}</span>
    </button>
  )
}

function SectionTitle({ children }) {
  return <h2 className="text-lg font-semibold text-gray-900">{children}</h2>
}

/* ===== helpers ===== */
function pad3(n) {
  const s = String(n)
  return s.length >= 3 ? s : '0'.repeat(3 - s.length) + s
}
function nextSerialFromList(list) {
  // legacy simple incrementer (kept for fallback)
  let max = 0
  for (const w of list || []) {
    const m = String(w?.serial || '').match(/^SN(\d+)$/i)
    if (m) max = Math.max(max, Number(m[1] || 0))
  }
  return `SN${pad3(max + 1 || 1)}`
}

// random alphanumeric suffix
function randAlnum(len = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// Derive a small 1-2 char batch/branch code from store id (stable)
function batchCodeFromStore(storeId) {
  if (!storeId) return '00'
  const v = Number(storeId) || 0
  const a = String(v % 100).padStart(2, '0')
  return a
}

function collectAllSerials(headers = [], creating = []) {
  const set = new Set()
  for (const h of headers || []) {
    for (const it of h.items || []) {
      if (it && it.serial) set.add(String(it.serial).trim())
    }
  }
  for (const it of creating || []) {
    if (it && it.serial) set.add(String(it.serial).trim())
  }
  return set
}

// Generate an 8-16 char serial like: YYMMDD + batch(2) + RAND(4) => 12 char
function generateUniqueSerial(headers = [], creating = [], storeId = null, attempts = 8) {
  const existing = collectAllSerials(headers, creating)
  for (let i = 0; i < attempts; i++) {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const batch = batchCodeFromStore(storeId)
    const rand = randAlnum(4)
    const cand = `${yy}${mm}${dd}${batch}${rand}` // e.g. 2410290301AB
    if (!existing.has(cand)) return cand
  }
  // fallback: timestamp + random
  return `TS${Date.now().toString().slice(-8)}${randAlnum(3)}`
}
function toISODate(d) {
  if (!d || isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}
function addMonthsKeepDay(startISO, months) {
  if (!startISO) return ''
  const [y, m, d] = startISO.split('-').map(Number)
  if (!y || !m || !d) return ''
  const base = new Date(Date.UTC(y, m - 1, d))
  const targetMonth = base.getUTCMonth() + months
  const targetYear = base.getUTCFullYear() + Math.floor(targetMonth / 12)
  const targetMonNorm = ((targetMonth % 12) + 12) % 12
  let result = new Date(Date.UTC(targetYear, targetMonNorm, d))
  while (result.getUTCMonth() !== targetMonNorm) {
    result = new Date(Date.UTC(targetYear, targetMonNorm + 1, 0))
  }
  return toISODate(result)
}
function addDays(startISO, days) {
  if (!startISO) return ''
  const [y, m, d] = startISO.split('-').map(Number)
  if (!y || !m || !d) return ''
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() + Number(days || 0))
  return toISODate(base)
}
function deriveItemStatusCode(item, notifyDays = 14) {
  if (!item?.expiryDate) return 'active'
  const today = new Date()
  const exp = new Date(item.expiryDate)
  const days = Math.ceil((exp - today) / (24 * 3600 * 1000))
  if (days < 0) return 'expired'
  if (days <= notifyDays) return 'nearing_expiration'
  return 'active'
}

export default function WarrantyDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const storeIdResolved = useMemo(() => {
    if (!user) return null
    return Number(user.sub ?? user.id ?? null)
  }, [user])

  // NOTE: warranties = “ใบรับประกัน (Header)” แต่ละใบมี items อยู่ใน field .items
  const [warranties, setWarranties] = useState([])
  const [filters, setFilters] = useState(defaultFilters)
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')

  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)
  const [profileTab, setProfileTab] = useState('info')
  const profileMenuRef = useRef(null)
  const profileImageInputRef = useRef(null)

  const [storeProfile, setStoreProfile] = useState(initialStoreProfile)
  const [profileImage, setProfileImage] = useState({ file: null, preview: '' })
  const [profilePasswords, setProfilePasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [modalError, setModalError] = useState('')
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  const [isWarrantyModalOpen, setWarrantyModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')

  // แก้ไขระดับ “รายการสินค้า”
  const [selectedItem, setSelectedItem] = useState(null)

  // แสดง/ซ่อนรายละเอียดต่อ “ใบ”
  const [expandedByHeader, setExpandedByHeader] = useState({})

  // Notifications state (for bell)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)

  const [warrantySubmitting, setWarrantySubmitting] = useState(false)
  const [warrantyModalError, setWarrantyModalError] = useState('')
  const [downloadingPdfId, setDownloadingPdfId] = useState(null)

  // รูปใน modal edit
  const [warrantyImages, setWarrantyImages] = useState([])

  const [imagePreview, setImagePreview] = useState({ open: false, images: [], index: 0 })

  // ✅ สำหรับแก้ไขอีเมลลูกค้าระดับใบ
  const [editHeaderEmail, setEditHeaderEmail] = useState('')

  const profileAvatarSrc = profileImage.preview || storeProfile.avatarUrl || ''

  /* ---------- สร้างหลายสินค้าในใบเดียว + auto expiry ---------- */
  const makeItem = (seedSN = null, lockEmail = false) => ({
    customer_email: '',
    product_name: '',
    model: '', // ✅ เพิ่มฟิลด์รุ่นในโหมดสร้าง
    duration_months: 12,
    // ✅ เพิ่มโหมดกำหนดเอง
    duration_mode: 'preset',      // 'preset' | 'custom'
    custom_unit: 'months',        // 'months' | 'days'
    custom_value: '',             // จำนวนที่ผู้ใช้กรอกเอง
    serial: seedSN || nextSerialFromList(warranties),
    lockedEmail: !!lockEmail,
    purchase_date: '',
    expiry_date: '',
    warranty_terms: '',
    note: '',
    images: [],
  })
  // start empty; modal open will seed the first item with a generated serial
  const [createItems, setCreateItems] = useState([])

  // ✅ เพิ่มรายการใหม่พร้อมดึงอีเมลจาก "รายการที่ 1" ให้เลย
  const addItem = () =>
    setCreateItems(prev => {
      // pick first non-empty email to seed, if any
      const emailSeed = (prev || []).find(p => p.customer_email)?.customer_email || ''
      const seedSN = generateUniqueSerial(warranties, prev, storeIdResolved)
      // newly added items are locked for email editing
      return [...prev, { ...makeItem(seedSN, true), customer_email: emailSeed }]
    })

  const removeItem = (idx) => setCreateItems(prev => prev.filter((_, i) => i !== idx))

  // ✅ ถ้าแก้อีเมลในรายการแรก ให้เติมไปยังรายการอื่น "เฉพาะตัวที่ยังว่าง"
  const patchItem = (idx, patch) => {
    setCreateItems(prev => {
      const next = prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
      const t = next[idx]
      const changedPurchase = 'purchase_date' in patch
      const changedPreset = 'duration_months' in patch
      const changedCustom = 'duration_mode' in patch || 'custom_unit' in patch || 'custom_value' in patch

      if ((changedPurchase || changedPreset || changedCustom) && t.purchase_date) {
        if (t.duration_mode === 'custom' && t.custom_value) {
          next[idx].expiry_date = computeExpiry(t.purchase_date, {
            unit: t.custom_unit || 'months',
            value: Number(t.custom_value) || 0,
          })
        } else {
          const m = Number(t.duration_months || 0) || 0
          next[idx].expiry_date = m > 0 ? addMonthsKeepDay(t.purchase_date, m) : ''
        }
      }

      // If any item's customer_email changed to a non-empty value, sync to all items
      if ('customer_email' in patch) {
        const email = String(patch.customer_email || '').trim()
        if (email) {
          for (let i = 0; i < next.length; i++) {
            next[i] = { ...next[i], customer_email: email }
          }
        }
      }
      return next
    })
  }

  const onPickImages = (idx, files) => {
    const arr = Array.from(files || []).slice(0, 5)
    patchItem(idx, { images: arr })
  }

  useEffect(() => {
    if (!isProfileMenuOpen) return
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isProfileMenuOpen])

  // click outside handler for notifications dropdown
  const notifRef = useRef(null)
  useEffect(() => {
    if (!notifOpen) return
    function onDoc(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [notifOpen])

  // helper: determine if account is new (show welcome message)
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

  async function fetchNotifications() {
    if (!storeIdResolved) return
    setNotifLoading(true)
    try {
      // try store-scoped notifications first, fallback to /notifications
      let res
      try {
        res = await api.get(`/store/${storeIdResolved}/notifications`)
      } catch (e) {
        res = await api.get(`/notifications`)
      }
      const data = res?.data?.data || res?.data || []
      setNotifications(Array.isArray(data) ? data : [])
    } catch (e) {
      setNotifications([])
    } finally {
      setNotifLoading(false)
    }
  }

  // ====== กรองระดับ "รายการ" แล้วจัดกลุ่มกลับเป็นใบ ======
  const filteredHeaders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return (warranties || [])
      .map(header => {
        // คำค้นระดับ "ใบ"
        const headerHay = [
          header.code, header.customerName, header.customerEmail, header.customerPhone,
        ].map(x => String(x || '').toLowerCase())
        const headerMatch = term ? headerHay.some(s => s.includes(term)) : false

        const items = (header.items || []).filter(it => {
          const code =
            it.statusCode ||
            STATUS_CODE_BY_LABEL[it.statusTag] ||
            deriveItemStatusCode(it, storeProfile.notifyDaysInAdvance)

          const passStatus = activeFilter === 'all' ? true : code === activeFilter
          if (!passStatus) return false

          // “ทั้งหมด” + คำค้นตรงกับตัวใบ → แสดงสินค้าทั้งใบ
          if (headerMatch && activeFilter === 'all') return true

          // ✅ ค้นหาที่ระดับ "สินค้า" จากชื่อสินค้าเท่านั้น
          const nameText = String(it.productName || '').toLowerCase()
          const passSearch = term ? nameText.includes(term) : true

          // ให้แท็บอื่นๆ โชว์รายการในใบนั้นที่ผ่านสถานะ แม้คำค้นจะตรงแค่ตัวใบ
          return passSearch || headerMatch
        })

        return { ...header, _filteredItems: items, _headerMatch: headerMatch }
      })
      .filter(h => h._filteredItems.length > 0)
  }, [warranties, activeFilter, searchTerm, storeProfile.notifyDaysInAdvance])

  // ✅ Pagination state + helper
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [searchTerm, activeFilter]) // รีเซ็ตเมื่อค้นหาหรือเปลี่ยนแท็บ

  const { totalPages, currentPage, paginatedHeaders } = useMemo(() => {
    const total = Math.max(1, Math.ceil((filteredHeaders?.length || 0) / PAGE_SIZE))
    const safe = Math.min(Math.max(1, page), total)
    const start = (safe - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    return {
      totalPages: total,
      currentPage: safe,
      paginatedHeaders: (filteredHeaders || []).slice(start, end),
    }
  }, [filteredHeaders, page])

  useEffect(() => {
    // ถ้าจำนวนหน้าลดลง ให้เลื่อนไปหน้าสุดท้ายที่ยังมีอยู่
    setPage(p => (p !== currentPage ? currentPage : p))
  }, [currentPage])

  function pageNumbers(total, current, windowSize = 5) {
    const half = Math.floor(windowSize / 2)
    let start = Math.max(1, current - half)
    let end = Math.min(total, start + windowSize - 1)
    start = Math.max(1, Math.min(start, end - windowSize + 1))
    const arr = []
    for (let i = start; i <= end; i++) arr.push(i)
    return arr
  }
  const pages = pageNumbers(totalPages, currentPage, 5)

  const openProfileModal = () => {
    setProfileModalOpen(true)
    setProfileTab('info')
    setProfileMenuOpen(false)
    setModalError('')
    setProfileSubmitting(false)
    setPasswordSubmitting(false)
  }

  const handleProfileAvatarSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setProfileImage({ file, preview: reader.result })
        setStoreProfile((prev) => ({ ...prev, avatarUrl: reader.result }))
      }
    }
    reader.readAsDataURL(file)
  }

  const fetchDashboard = useCallback(async () => {
    if (!storeIdResolved) {
      setDashboardLoading(false)
      return
    }
    setDashboardError('')
    setDashboardLoading(true)
    try {
      const response = await api.get(`/store/${storeIdResolved}/dashboard`)
      const payload = response.data?.data ?? {}

      if (payload.storeProfile) {
        setStoreProfile({ ...initialStoreProfile, ...payload.storeProfile })
        setProfileImage({ file: null, preview: '' })
      }

      if (Array.isArray(payload.warranties)) {
        setWarranties(payload.warranties)
      } else {
        setWarranties([])
      }

      const fetchedStatuses = Array.isArray(payload.filters?.statuses)
        ? payload.filters.statuses
        : []

      const normalizedStatusOptions = fetchedStatuses
        .map((option) => ({
          value: option?.code || STATUS_CODE_BY_LABEL[option?.label] || option?.label,
          label: option?.label || option?.code || '',
        }))
        .filter((option) => option.value && option.label)

      const seen = new Set()
      const merged = [{ value: 'all', label: 'ทั้งหมด' }]
      for (const option of normalizedStatusOptions) {
        if (seen.has(option.value)) continue
        seen.add(option.value)
        merged.push(option)
      }
      if (merged.length === 1) merged.push(...defaultFilters.slice(1))
      setFilters(merged)
      setActiveFilter((current) => (merged.some((option) => option.value === current) ? current : 'all'))
      setDashboardError('')
    } catch (error) {
      setDashboardError(error?.response?.data?.error?.message || 'ไม่สามารถโหลดข้อมูลแดชบอร์ดได้')
    } finally {
      setDashboardLoading(false)
    }
  }, [storeIdResolved])

  /* ========== โหมดแก้ไข: state + auto-expiry ========== */
  const [editForm, setEditForm] = useState(null)
  const [manualExpiry, setManualExpiry] = useState(false)
  const computeExpiry = useCallback((purchaseISO, monthsOrCustom) => {
    if (!purchaseISO) return ''
    if (typeof monthsOrCustom === 'object' && monthsOrCustom) {
      const { unit = 'months', value = 0 } = monthsOrCustom
      if (!value) return ''
      return unit === 'days'
        ? addDays(purchaseISO, value)
        : addMonthsKeepDay(purchaseISO, value)
    }
    const m = Number(monthsOrCustom || 0)
    if (!m) return ''
    return addMonthsKeepDay(purchaseISO, m)
  }, [])

  const openWarrantyModal = (mode, item = null) => {
    setModalMode(mode)
    setSelectedItem(item)
    setWarrantyModalError('')
    setWarrantySubmitting(false)
    setWarrantyImages(item?.images || [])

    if (mode === 'create') {
      // generate an initial unique serial for the first item
      const seed = generateUniqueSerial(warranties, [], storeIdResolved)
      setCreateItems([makeItem(seed, false)])
      setEditForm(null)
      setManualExpiry(false)
      setEditHeaderEmail('')
    } else if (mode === 'edit' && item) {
      const hasDays = typeof item.durationDays === 'number' && item.durationDays > 0
      const hasMonths = typeof item.durationMonths === 'number' && item.durationMonths > 0

      setEditForm({
        product_name: item.productName || '',
        model: item.model || '', // ✅ ผูก model ตอนแก้ไข
        duration_months: hasMonths
          ? item.durationMonths
          : Math.max(1, Math.round((item.durationDays || 30) / 30)),
        duration_mode: hasDays ? 'custom' : 'preset',
        custom_unit: hasDays ? 'days' : 'months',
        custom_value: hasDays ? item.durationDays : '',
        serial: item.serial || '',
        purchase_date: item.purchaseDate || '',
        expiry_date: item.expiryDate || '',
        warranty_terms: item.coverageNote || '',
        note: item.note || '',
      })
      setEditHeaderEmail(item?._headerEmail || '') // ✅ อีเมลลูกค้าระดับใบ
      setManualExpiry(false)
    }

    setWarrantyModalOpen(true)
  }

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    if (!storeIdResolved) return
    setProfileSubmitting(true)
    setModalError('')
    try {
      const payload = {
        storeName: storeProfile.storeName,
        contactName: storeProfile.contactName,
        email: storeProfile.email,
        phone: storeProfile.phone,
        address: storeProfile.address,
        businessHours: storeProfile.businessHours,
        avatarUrl: storeProfile.avatarUrl,
      }
      const response = await api.patch(`/store/${storeIdResolved}/profile`, payload)
      const updatedProfile = response.data?.data?.storeProfile ?? payload
      setStoreProfile((prev) => ({ ...prev, ...updatedProfile }))
      setProfileImage({ file: null, preview: '' })
      setModalError('')
      setProfileModalOpen(false)
    } catch (error) {
      setModalError(error?.response?.data?.error?.message || 'บันทึกข้อมูลร้านไม่สำเร็จ')
    } finally {
      setProfileSubmitting(false)
    }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    if (!storeIdResolved) return
    if (profilePasswords.newPassword !== profilePasswords.confirmPassword) {
      setModalError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน')
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
    } catch (error) {
      setModalError(error?.response?.data?.error?.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้')
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const handleLogout = () => {
    logout?.()
    setProfileMenuOpen(false)
    navigate('/signin', { replace: true })
  }

  /* ========== บันทึกใบรับประกัน ========== */
  const handleWarrantySubmit = async (event) => {
    event.preventDefault()
    if (!storeIdResolved) return
    setWarrantySubmitting(true)
    setWarrantyModalError('')

    try {
      if (modalMode === 'edit' && selectedItem) {
        const purchase = String(editForm?.purchase_date || '').trim()

        // คำนวณ expiry อัตโนมัติ ถ้าไม่ได้กรอกเอง
        let expiryAuto = ''
        if (!manualExpiry && purchase) {
          if (editForm?.duration_mode === 'custom' && editForm?.custom_value) {
            expiryAuto = computeExpiry(purchase, {
              unit: editForm.custom_unit || 'months',
              value: Number(editForm.custom_value) || 0,
            })
          } else {
            expiryAuto = computeExpiry(purchase, Number(editForm?.duration_months || 0))
          }
        }

        const expiryManual = String(editForm?.expiry_date || '').trim()
        const fd = new FormData()
        fd.append('productName', String(editForm?.product_name || '').trim())
        fd.append('model', String(editForm?.model || '').trim()) // ✅ ส่ง model ตอนแก้ไข
        fd.append('serial', String(editForm?.serial || '').trim())
        fd.append('purchaseDate', purchase)

        // ✅ ส่ง durationMonths ก็ต่อเมื่อหน่วยเป็น "เดือน"
        if (editForm?.duration_mode !== 'custom') {
          const months = Number(editForm?.duration_months || 0)
          if (months) fd.append('durationMonths', String(months))
        } else if (editForm?.custom_unit === 'months') {
          const months = Number(editForm?.custom_value || 0)
          if (months) fd.append('durationMonths', String(months))
        }
        // ถ้าเป็นวัน ให้พึ่ง expiryDate ที่คำนวณไว้

        const finalExpiry = manualExpiry ? expiryManual : (expiryManual || expiryAuto)
        if (finalExpiry) fd.append('expiryDate', finalExpiry)

        fd.append('coverageNote', String(editForm?.warranty_terms || '').trim())
        fd.append('note', String(editForm?.note || '').trim())

        await api.patch(`/warranty-items/${selectedItem.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        // ✅ ถ้าอีเมลลูกค้า (ระดับใบ) เปลี่ยน ให้แพตช์ header
        if (selectedItem?._headerId && (editHeaderEmail.trim() !== (selectedItem?._headerEmail || ''))) {
          try {
            await api.patch(`/warranties/${selectedItem._headerId}`, {
              customerEmail: editHeaderEmail.trim(),
            })
          } catch (e) {
            console.warn('Patch warranty header email failed:', e?.response?.data || e?.message)
          }
        }

        await fetchDashboard()
        setWarrantyModalOpen(false)
        setWarrantySubmitting(false)
        return
      }

      // โหมดสร้างหลายรายการในใบเดียว
      const payload = {
        items: createItems.map((it) => {
          let monthsForApi = 0
          let computedExpiry = (it.expiry_date || '').trim()

          if (!computedExpiry && it.purchase_date) {
            if (it.duration_mode === 'custom' && it.custom_value) {
              const v = Number(it.custom_value) || 0
              computedExpiry = computeExpiry(it.purchase_date, { unit: it.custom_unit || 'months', value: v })
              monthsForApi = it.custom_unit === 'months' ? v : 0
            } else {
              const m = Number(it.duration_months || 0) || 12
              computedExpiry = computeExpiry(it.purchase_date, m)
              monthsForApi = m
            }
          } else {
            monthsForApi = it.duration_mode === 'preset' ? Number(it.duration_months || 0) || 12
              : (it.custom_unit === 'months' ? Number(it.custom_value || 0) || 0 : 0)
          }

          return {
            customer_email: (it.customer_email || '').trim(),
            product_name: (it.product_name || '').trim(),
            model: (it.model || '').trim() || null, // ✅ ส่งรุ่นไป backend
            purchase_date: (it.purchase_date || '').trim(),
            serial: (it.serial || '').trim(),
            warranty_terms: (it.warranty_terms || '').trim(),
            note: (it.note || '').trim(),
            duration_months: monthsForApi,          // ถ้าเลือก "วัน" จะเป็น 0
            expiry_date: computedExpiry || '',
          }
        }),
      }

      const res = await api.post(`/store/${storeIdResolved}/warranties`, payload)
      const createdHeader = res.data?.data?.warranty

      // อัปโหลดรูปให้แต่ละ “รายการ” ที่สร้าง
      if (createdHeader?.items?.length) {
        for (let i = 0; i < createdHeader.items.length; i++) {
          const files = createItems[i]?.images || []
          if (files.length) {
            const fd = new FormData()
            files.forEach(f => fd.append('images', f))
            await api.post(`/warranty-items/${createdHeader.items[i].id}/images`, fd, {
              headers: { 'Content-Type': 'multipart/form-data' },
            })
          }
        }
      }

      await fetchDashboard()
      setWarrantyModalOpen(false)
    } catch (error) {
      setWarrantyModalError(error?.response?.data?.error?.message || 'ไม่สามารถบันทึกใบรับประกันได้')
    } finally {
      setWarrantySubmitting(false)
    }
  }

  const handleDownloadPdf = async (warrantyId) => {
    if (!warrantyId) return
    try {
      setDownloadingPdfId(warrantyId)
      const response = await api.get(`/warranties/${warrantyId}/pdf`, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (error) {
      setDashboardError(error?.response?.data?.error?.message || 'ไม่สามารถดาวน์โหลดใบรับประกันได้')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  // อัปโหลด/ลบรูปที่ “รายการ”
  const handleImageUpload = async (files) => {
    if (!selectedItem?.id) return
    const formData = new FormData()
    files.forEach(file => formData.append('images', file))
    try {
      const response = await api.post(`/warranty-items/${selectedItem.id}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const updatedItem = response.data?.data?.item
      if (updatedItem) {
        setWarrantyImages(updatedItem.images || [])
        await fetchDashboard()
      }
    } catch (error) {
      throw new Error(error?.response?.data?.error?.message || 'ไม่สามารถอัปโหลดรูปภาพได้')
    }
  }

  const handleImageDelete = async (imageId) => {
    if (!selectedItem?.id) return
    try {
      const response = await api.delete(`/warranty-items/${selectedItem.id}/images/${imageId}`)
      const updatedItem = response.data?.data?.item
      if (updatedItem) {
        setWarrantyImages(updatedItem.images || [])
        await fetchDashboard()
      }
    } catch (error) {
      throw new Error(error?.response?.data?.error?.message || 'ไม่สามารถลบรูปภาพได้')
    }
  }

  const storeDisplayName = storeProfile.storeName || user?.store?.name || user?.storeName || user?.name || 'ร้านของฉัน'
  const storeEmail = storeProfile.email || user?.store?.email || user?.email || ''

  return (
    <>
      {/* 🟦 BG: ปรับให้เหมือนโค้ด1 */}
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-sky-100/60 pb-16">
        {/* 🟦 Header: ใช้สไตล์และโลโก้มุมซ้ายบนแบบโค้ด1 */}
        <header className="sticky top-0 z-30 border-b border-sky-100 bg-white/80 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
            {/* โลโก้มุมซ้ายบนจากโค้ด1 */}
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

              <div className="flex items-center gap-3" ref={profileMenuRef}>
              {/* Notifications bell */}
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
                  <button
                    type="button"
                    onClick={openProfileModal}
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

        <main className="mx-auto mt-8 max-w-6xl px-4">
          {/* 🟦 กล่องแจ้ง error: ใช้โทนฟ้าแบบโค้ด1 */}
          {dashboardError && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
              <span>{dashboardError}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDashboardError('')}
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-sky-600 shadow hover:bg-sky-100"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={fetchDashboard}
                  className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-sky-500"
                >
                  ลองอีกครั้ง
                </button>
              </div>
            </div>
          )}

          <div className="rounded-3xl border border-sky-100 bg-gradient-to-b from-white to-sky-50 p-6 shadow-xl">
            {dashboardLoading ? (
              <div className="grid min-h-[320px] place-items-center text-sm text-slate-500">กำลังโหลดข้อมูล...</div>
            ) : !storeIdResolved ? (
              <div className="grid min-h-[320px] place-items-center text-center text-sm text-slate-500">
                <div>
                  <div className="text-base font-medium text-slate-700">หน้านี้สำหรับบัญชีร้านค้าเท่านั้น</div>
                  <p className="mt-1 text-xs text-slate-500">กรุณาเข้าสู่ระบบด้วยบัญชีร้านค้าเพื่อเข้าถึงแดชบอร์ด</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <StoreTabs />
                </div>

                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <SectionTitle>จัดการการรับประกัน</SectionTitle>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2 rounded-full bg-white p-1"></div>
                    <button
                      type="button"
                      onClick={() => openWarrantyModal('create')}
                      className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow hover:-translate-y-0.5 hover:bg-sky-500 transition"
                    >
                      สร้างใบรับประกัน
                    </button>
                  </div>
                </div>

                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <div className="flex flex-1 items-center rounded-2xl bg-white px-4 py-2 shadow ring-1 ring-black/5">
                    <span className="text-slate-400">🔍</span>
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="w-full bg-transparent px-3 py-2 text-sm focus:outline-none"
                      placeholder="ค้นหาด้วยรหัสใบรับประกัน, ชื่อลูกค้า, อีเมลลูกค้า, ชื่อสินค้า"
                    />
                  </div>

                  {/* 🟦 ปุ่มกรอง: ใช้โทนสีและ logic เดียวกับโค้ด1 */}
                  <div className="flex flex-wrap gap-2">
                    {filters.map((f) => {
                      const isActive = activeFilter === f.value
                      const colors = isActive
                        ? f.value === 'active'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : f.value === 'nearing_expiration'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : f.value === 'expired'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-slate-900 text-white border-slate-900'
                        : f.value === 'active'
                        ? 'bg-white text-emerald-700 border-emerald-400'
                        : f.value === 'nearing_expiration'
                        ? 'bg-white text-amber-700 border-amber-300'
                        : f.value === 'expired'
                        ? 'bg-white text-rose-700 border-rose-300'
                        : 'bg-white text-slate-800 border-slate-300'

                      return (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => setActiveFilter(f.value)}
                          className={`px-4 h-10 rounded-full text-sm border font-medium hover:-translate-y-0.5 transition ${colors}`}
                        >
                          {f.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* รายการใบรับประกัน (แบ่งหน้า 5 ใบ/หน้า) */}
                <div className="mb-8 grid gap-4">
                  {paginatedHeaders.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                      ยังไม่มีใบรับประกัน
                    </div>
                  ) : (
                    paginatedHeaders.map(header => {
                      const expanded = !!expandedByHeader[header.id]
                      return (
                        // 🟦 การ์ดใบรับประกัน: โทนสเลทแบบโค้ด1
                        <div key={header.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-md transition hover:shadow-lg">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="text-lg font-semibold text-slate-900">Warranty Card</div>
                              <div className="mt-2 grid gap-1 text-sm text-slate-700 md:grid-cols-2">
                                <div>รหัสใบรับประกัน: <span className="font-medium text-slate-900">{header.code || '-'}</span></div>
                                <div>ลูกค้า: <span className="font-medium text-slate-900">{header.customerName || '-'}</span></div>
                                <div>เบอร์โทรศัพท์: <span className="font-medium text-slate-900">{header.customerPhone || '-'}</span></div>
                                <div>อีเมลลูกค้า: <span className="font-medium text-slate-900">{header.customerEmail || '-'}</span></div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <button
                                type="button"
                                onClick={() => header && handleDownloadPdf(header.id)}
                                disabled={!header || downloadingPdfId === header.id}
                                className={`h-10 min-w-[96px] rounded-full bg-sky-600 px-5 text-sm font-medium text-white shadow transition ${
                                  !header || downloadingPdfId === header.id ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-0.5 hover:bg-sky-500'
                                }`}
                              >
                                {downloadingPdfId === header.id ? 'กำลังดาวน์โหลด…' : 'PDF'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setExpandedByHeader(prev => ({ ...prev, [header.id]: !prev[header.id] }))}
                                className="rounded-full border border-sky-300 px-4 py-2 text-xs font-semibold text-sky-700 bg-white hover:-translate-y-0.5 hover:bg-sky-50 transition"
                              >
                                {expanded ? 'ซ่อนรายละเอียด' : 'รายละเอียดเพิ่มเติม'}
                              </button>
                            </div>
                          </div>

                          {/* สรุปรายการในใบ */}
                          <p className="mt-4 rounded-xl bg-white/70 p-3 text-xs text-slate-700">
                            ใบนี้มีทั้งหมด {header._filteredItems?.length ?? header.items?.length ?? 0} รายการ
                          </p>

                          {/* รายการในใบ */}
                          {expanded && (
                            <div className="mt-4 grid gap-4">
                              {(header._filteredItems || []).map((it) => (
                                <div key={it.id} className="flex flex-col justify-between gap-6 rounded-2xl bg-white p-4 shadow ring-1 ring-black/5 md:flex-row">
                                  <div className="flex-1 space-y-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <div className="text-base font-semibold text-slate-900">{it.productName}</div>
                                      <StatusBadge label={it.statusTag} className={it.statusColor} />
                                      
                                    </div>
                                    <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                                      <div>Serial No.: <span className="font-medium text-slate-900">{it.serial || '-'}</span></div>
                                      <div>วันที่เริ่มรับประกัน: <span className="font-medium text-slate-900">{it.purchaseDate || '-'}</span></div>
                                      <div>วันหมดอายุ: <span className="font-medium text-slate-900">{it.expiryDate || '-'}</span></div>
                                      <div>จำนวนวันคงเหลือ: <span className="font-medium text-slate-900">{it.daysLeft ?? 0} วัน</span></div>
                                      <div>รุ่น: <span className="font-medium text-slate-900">{it.model || '-'}</span></div>
                                    </div>
                                    <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">{it.coverageNote || '-'}</p>

                                    {it.images && it.images.length > 0 && (
                                      <div className="space-y-2">
                                        <div className="text-sm font-medium text-slate-700">รูปภาพประกอบ</div>
                                        <div className="flex gap-2 overflow-x-auto">
                                          {it.images.map((image, index) => (
                                            <div key={image.id || index} className="group relative flex-shrink-0 cursor-pointer">
                                              <img
                                                src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${image.url}`}
                                                alt={image.originalName || 'Warranty image'}
                                                className="h-20 w-20 rounded-lg object-cover transition-transform group-hover:scale-105"
                                                onClick={() => setImagePreview({ open: true, images: it.images, index })}
                                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                                              />
                                              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                                <span className="text-xs text-white">👁️</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid place-items-center gap-4">
                                    {/* 🟦 โทนกรอบรูปด้านขวาเป็น slate เหมือนโค้ด1 */}
                                    <div className="relative h-32 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                                      {it.images && it.images.length > 0 ? (
                                        <div
                                          className="group relative h-full w-full cursor-pointer"
                                          onClick={() => setImagePreview({ open: true, images: it.images, index: 0 })}
                                        >
                                          <img
                                            src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${it.images[0].url}`}
                                            alt="Warranty preview"
                                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                          />
                                          {it.images.length > 1 && (
                                            <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
                                              +{it.images.length - 1}
                                            </div>
                                          )}
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                            <span className="text-white">👁️ ดูรูป</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                                          <div className="text-center">
                                            <div className="mb-1 text-2xl">📷</div>
                                            <div>ไม่มีรูปภาพ</div>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => openWarrantyModal('edit', { ...it, _headerId: header.id, _headerEmail: header.customerEmail })} // ✅ ส่งข้อมูลใบมาด้วย
                                      className="flex items-center gap-2 rounded-full border border-sky-500 px-4 py-2 text-sm font-medium text-sky-700 bg-white hover:-translate-y-0.5 hover:bg-sky-50 transition"
                                    >
                                      <span>แก้ไข</span>
                                      <span aria-hidden>✏️</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* ✅ Pagination footer — ใช้โทนสเลทแบบโค้ด1 */}
                {filteredHeaders.length > 0 && (
                  <div className="mt-6 flex flex-col items-center gap-3 md:flex-row md:justify-between">
                    <div className="text-xs text-slate-500">
                      หน้า <span className="font-medium text-slate-900">{currentPage}</span> จาก{' '}
                      <span className="font-medium text-slate-900">{totalPages}</span>
                      {' • '}
                      แสดง {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredHeaders.length)}–
                      {Math.min(currentPage * PAGE_SIZE, filteredHeaders.length)} จาก {filteredHeaders.length} ใบ
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${
                          currentPage === 1
                            ? 'cursor-not-allowed bg-white text-slate-300 ring-1 ring-black/10'
                            : 'bg-white text-slate-700 ring-1 ring-black/10 hover:-translate-y-0.5 hover:bg-slate-50 transition'
                        }`}
                      >
                        ก่อนหน้า
                      </button>
                      {pages.map((n) => (
                        <button
                          key={n}
                          onClick={() => setPage(n)}
                          className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${
                            n === currentPage ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-black/10 hover:-translate-y-0.5 hover:bg-slate-50 transition'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${
                          currentPage === totalPages
                            ? 'cursor-not-allowed bg-white text-slate-300 ring-1 ring-black/10'
                            : 'bg-white text-slate-700 ring-1 ring-black/10 hover:-translate-y-0.5 hover:bg-slate-50 transition'
                        }`}
                      >
                        ถัดไป
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <div className="w-full max-w-lg rounded-3xl border border-sky-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-sky-100 px-6 py-4">
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

              <div className="px-6 pt-4">
                <div className="mb-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setProfileTab('info'); setModalError('') }}
                    className={`flex-1 rounded-2xl px-4 py-2 text-sm font-medium ${profileTab === 'info' ? 'bg-sky-100 text-sky-700' : 'bg-sky-50 text-gray-500'}`}
                  >
                    ข้อมูลร้านค้า
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProfileTab('password'); setModalError('') }}
                    className={`flex-1 rounded-2xl px-4 py-2 text-sm font-medium ${profileTab === 'password' ? 'bg-sky-100 text-sky-700' : 'bg-sky-50 text-gray-500'}`}
                  >
                    เปลี่ยนรหัสผ่าน
                  </button>
                </div>
              </div>

              {profileTab === 'info' ? (
                <form onSubmit={handleProfileSubmit} className="px-6 pb-6">
                  <input ref={profileImageInputRef} accept="image/*" className="hidden" onChange={handleProfileAvatarSelect} type="file" />
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
                        <input
                          required
                          value={storeProfile[key] ?? ''}
                          onChange={(e) => setStoreProfile((prev) => ({ ...prev, [key]: e.target.value }))}
                          readOnly={key === 'email'}
                          className={`mt-1 w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none ${key === 'email' ? 'bg-slate-100' : 'bg-sky-50/60'}`}
                          type="text"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="submit"
                      disabled={profileSubmitting}
                      className={`rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow transition ${profileSubmitting ? 'cursor-not-allowed opacity-70' : 'hover:bg-sky-500'}`}
                    >
                      {profileSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="px-6 pb-6">
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
                  <div className="mt-6 flex justify-end">
                    <button
                      type="submit"
                      disabled={passwordSubmitting}
                      className={`rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow transition ${passwordSubmitting ? 'cursor-not-allowed opacity-70' : 'hover:bg-sky-400'}`}
                    >
                      {passwordSubmitting ? 'กำลังบันทึก...' : 'ยืนยัน'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {isWarrantyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
              {/* header */}
              <div className="flex items-center justify-between rounded-t-3xl bg-sky-600 px-6 py-4 text-white">
                <div>
                  <div className="text-base font-semibold">{modalMode === 'create' ? 'สร้างใบรับประกันใหม่' : 'แก้ไขรายการสินค้า'}</div>
                  {modalMode === 'create' && <div className="text-xs text-sky-100">ใบรับประกัน 1 ใบ สามารถเพิ่มสินค้าหลายรายการได้</div>}
                </div>
                <button
                  type="button"
                  onClick={() => { setWarrantyModalOpen(false); setWarrantyModalError(''); setWarrantySubmitting(false) }}
                  className="text-2xl text-white/80 hover:text-white"
                >
                  ×
                </button>
              </div>

              <form className="grid" onSubmit={handleWarrantySubmit}>
                <div className="max-h-[85vh] overflow-y-auto px-6 pt-5 pb-3">
                  {warrantyModalError && (
                    <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{warrantyModalError}</div>
                  )}

                  {modalMode === 'edit' ? (
                    <>
                      {/* ✅ แก้ไขอีเมลลูกค้า (ระดับใบ) */}
                      <label className="mb-3 block text-sm text-gray-100">
                        {/* spacer on dark header */}
                      </label>
                      <label className="text-sm text-gray-600 block">
                        อีเมลลูกค้า 
                        <input
                          value={editHeaderEmail}
                          onChange={e => setEditHeaderEmail(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                          placeholder="example@email.com"
                          type="email"
                        />
                      </label>

                      {/* ฟอร์มแก้ไขแบบ controlled + auto-expiry */}
                      <label className="mt-3 text-sm text-gray-600">
                        ชื่อสินค้าที่ทำการซ่อม
                        <input
                          name="product_name"
                          value={editForm?.product_name ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, product_name: e.target.value }))}
                          className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                          placeholder="กรอกชื่อสินค้าที่ทำการซ่อม"
                          type="text"
                          required
                        />
                      </label>

                      {/* ✅ รุ่น (Model) ในโหมดแก้ไข */}
                      <label className="mt-3 text-sm text-gray-600">
                        รุ่นสินค้าที่ทำการซ่อม
                        <input
                          name="model"
                          value={editForm?.model ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
                          className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                          placeholder="กรอกรุ่นสินค้าที่ทำการซ่อม"
                          type="text"
                        />
                      </label>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="text-sm text-gray-600">
                          ระยะเวลารับประกัน
                          <select
                            name="duration_months"
                            value={editForm?.duration_mode === 'preset' ? (editForm?.duration_months ?? 12) : 'other'}
                            onChange={e => {
                              const v = e.target.value
                              setEditForm(f => {
                                if (v === 'other') {
                                  const next = { ...f, duration_mode: 'custom', custom_unit: 'months', custom_value: 12 }
                                  if (!manualExpiry) next.expiry_date = computeExpiry(next.purchase_date, { unit: 'months', value: 12 })
                                  return next
                                } else {
                                  const vNum = Number(v || 12)
                                  const next = { ...f, duration_mode: 'preset', duration_months: vNum }
                                  if (!manualExpiry) next.expiry_date = computeExpiry(next.purchase_date, vNum)
                                  return next
                                }
                              })
                            }}
                            className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                          >
                            {[6, 12, 18, 24].map(month => (
                              <option key={month} value={month}>{month} เดือน</option>
                            ))}
                            <option value="other">อื่นๆ (ระบุเอง)</option>
                          </select>
                        </label>

                        <label className="text-sm text-gray-600">
                          Serial No.
                          <input
                            name="serial"
                            value={editForm?.serial ?? ''}
                            onChange={e => setEditForm(f => ({ ...f, serial: e.target.value }))}
                            className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                            placeholder="กรอก Serial No."
                            type="text"
                            required
                          />
                        </label>
                      </div>

                      {editForm?.duration_mode === 'custom' && (
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <label className="text-sm text-gray-600">
                            จำนวน (วัน/เดือน)
                            <input
                              inputMode="numeric"
                              value={editForm?.custom_value ?? ''}
                              onChange={e =>
                                setEditForm(f => {
                                  const next = { ...f, custom_value: e.target.value }
                                  if (!manualExpiry) {
                                    next.expiry_date = computeExpiry(next.purchase_date, {
                                      unit: f.custom_unit || 'months',
                                      value: Number(e.target.value || 0),
                                    })
                                  }
                                  return next
                                })
                              }
                              className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                              placeholder="เช่น 45"
                              type="number"
                              min="1"
                            />
                          </label>
                          <label className="text-sm text-gray-600">
                            รูปแบบเวลา
                            <div className="mt-1 flex h-[42px] items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 px-3">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="unit-edit"
                                  checked={editForm?.custom_unit === 'days'}
                                  onChange={() =>
                                    setEditForm(f => {
                                      const next = { ...f, custom_unit: 'days' }
                                      if (!manualExpiry && f.purchase_date && f.custom_value) {
                                        next.expiry_date = computeExpiry(f.purchase_date, { unit: 'days', value: Number(f.custom_value) })
                                      }
                                      return next
                                    })
                                  }
                                />
                                วัน
                              </label>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="unit-edit"
                                  checked={editForm?.custom_unit === 'months'}
                                  onChange={() =>
                                    setEditForm(f => {
                                      const next = { ...f, custom_unit: 'months' }
                                      if (!manualExpiry && f.purchase_date && f.custom_value) {
                                        next.expiry_date = computeExpiry(f.purchase_date, { unit: 'months', value: Number(f.custom_value) })
                                      }
                                      return next
                                    })
                                  }
                                />
                                เดือน
                              </label>
                            </div>
                          </label>
                        </div>
                      )}

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="text-sm text-gray-600">
                          วันเริ่มการรับประกัน
                          <input
                            name="purchase_date"
                            value={editForm?.purchase_date ?? ''}
                            onChange={e => {
                              const v = e.target.value
                              setEditForm(f => {
                                const next = { ...f, purchase_date: v }
                                if (!manualExpiry) {
                                  if (next.duration_mode === 'custom' && next.custom_value) {
                                    next.expiry_date = computeExpiry(v, { unit: next.custom_unit || 'months', value: Number(next.custom_value || 0) })
                                  } else {
                                    next.expiry_date = computeExpiry(v, next.duration_months)
                                  }
                                }
                                return next
                              })
                            }}
                            className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                            type="date"
                            required
                          />
                        </label>
                        <label className="text-sm text-gray-600">
                          วันหมดอายุ 
                          <input
                            name="expiry_date"
                            value={editForm?.expiry_date ?? ''}
                            onChange={e => {
                              setManualExpiry(true)
                              setEditForm(f => ({ ...f, expiry_date: e.target.value }))
                            }}
                            onBlur={() => {
                              setManualExpiry(prev => (editForm?.expiry_date ? prev : false))
                            }}
                            className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                            type="date"
                          />
                        </label>
                      </div>

                      <label className="mt-3 text-sm text-gray-600">
                        เงื่อนไขการรับประกัน
                        <textarea
                          name="warranty_terms"
                          value={editForm?.warranty_terms ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, warranty_terms: e.target.value }))}
                          className="mt-1 min-h-[96px] w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                          placeholder="กรอกเงื่อนไขการรับประกัน"
                          required
                        />
                      </label>

                      <div className="mt-3 space-y-2">
                        <label className="text-sm text-gray-600">รูปภาพประกอบ</label>
                        <ImageUpload
                          images={warrantyImages}
                          onUpload={handleImageUpload}
                          onDelete={handleImageDelete}
                          maxImages={5}
                          disabled={warrantySubmitting}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* โหมดสร้างหลายรายการในใบเดียว */}
                      {createItems.map((it, idx) => (
                        <div key={idx} className="mb-6 rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-semibold text-sky-700">รายการที่ {idx + 1}</div>
                            {createItems.length > 1 && (
                              <button type="button" onClick={() => removeItem(idx)} className="text-xs text-rose-600 hover:underline">
                                ลบรายการ
                              </button>
                            )}
                          </div>

                          <label className="text-sm text-gray-600 block">
                                อีเมลลูกค้า
                                <input
                                  value={it.customer_email}
                                  onChange={e => patchItem(idx, { customer_email: e.target.value })}
                                  readOnly={!!it.lockedEmail}
                                  className={`mt-1 w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none ${it.lockedEmail ? 'bg-slate-100' : 'bg-white'}`}
                                  placeholder="กรอกอีเมลลูกค้า"
                                  type="email"
                                  required
                                />
                          </label>

                          <label className="mt-3 text-sm text-gray-600 block">
                            ชื่อสินค้าที่ทำการซ่อม
                            <input
                              value={it.product_name}
                              onChange={e => patchItem(idx, { product_name: e.target.value })}
                              className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                              placeholder="กรอกชื่อสินค้าที่ทำการซ่อม"
                              type="text"
                              required
                            />
                          </label>

                          {/* ✅ รุ่น (Model) ต่อรายการ — ไม่แชร์กันทั้งใบ */}
                          <label className="mt-3 text-sm text-gray-600 block">
                            รุ่นสินค้าที่ทำการซ่อม
                            <input
                              value={it.model}
                              onChange={e => patchItem(idx, { model: e.target.value })}
                              className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                              placeholder="กรอกรุ่นสินค้าที่ทำการซ่อม"
                              type="text"
                            />
                          </label>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <label className="text-sm text-gray-600 block">
                              ระยะเวลาการรับประกัน 
                              <select
                                value={it.duration_mode === 'preset' ? it.duration_months : 'other'}
                                onChange={e => {
                                  const v = e.target.value
                                  if (v === 'other') {
                                    patchItem(idx, { duration_mode: 'custom', custom_unit: 'months', custom_value: 12 })
                                  } else {
                                    patchItem(idx, { duration_mode: 'preset', duration_months: Number(v || 12) })
                                  }
                                }}
                                className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                              >
                                {[1,3,6, 12, 18, 24].map(month => (
                                  <option key={month} value={month}>{month} เดือน</option>
                                ))}
                                <option value="other">อื่นๆ (ระบุเอง)</option>
                              </select>
                            </label>

                            <label className="text-sm text-gray-600 block">
                              Serial No. 
                              <input
                                value={it.serial}
                                // serial is generated for create-mode items and should not be edited by default
                                readOnly
                                className="mt-1 w-full rounded-2xl border border-sky-100 bg-slate-50 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                placeholder="เช่น 2410290301AB"
                                type="text"
                                required
                              />
                            </label>
                          </div>

                          {it.duration_mode === 'custom' && (
                            <div className="mt-2 grid gap-3 md:grid-cols-2">
                              <label className="text-sm text-gray-600 block">
                                จำนวน (วัน/เดือน)
                                <input
                                  inputMode="numeric"
                                  value={it.custom_value}
                                  onChange={e => patchItem(idx, { custom_value: e.target.value })}
                                  className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                  placeholder="เช่น 45"
                                  type="number"
                                  min="1"
                                />
                              </label>
                              <label className="text-sm text-gray-600 block">
                                รูปแบบเวลา
                                <div className="mt-1 flex h-[42px] items-center gap-3 rounded-2xl border border-sky-100 bg-white px-3">
                                  <label className="flex items-center gap-2 text-sm">
                                    <input
                                      type="radio"
                                      name={`unit-${idx}`}
                                      checked={it.custom_unit === 'days'}
                                      onChange={() => patchItem(idx, { custom_unit: 'days' })}
                                    />
                                    วัน
                                  </label>
                                  <label className="flex items-center gap-2 text-sm">
                                    <input
                                      type="radio"
                                      name={`unit-${idx}`}
                                      checked={it.custom_unit === 'months'}
                                      onChange={() => patchItem(idx, { custom_unit: 'months' })}
                                    />
                                    เดือน
                                  </label>
                                </div>
                              </label>
                            </div>
                          )}

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <label className="text-sm text-gray-600 block">
                              วันที่เริ่มรับประกัน
                              <input
                                value={it.purchase_date}
                                onChange={e => patchItem(idx, { purchase_date: e.target.value })}
                                className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                type="date"
                                required
                              />
                            </label>
                            <label className="text-sm text-gray-600 block">
                              วันหมดอายุ 
                              <input
                                value={it.expiry_date}
                                onChange={e => patchItem(idx, { expiry_date: e.target.value })}
                                className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                type="date"
                              />
                            </label>
                          </div>

                          <label className="mt-3 text-sm text-gray-600 block">
                            เงื่อนไขการรับประกัน
                            <textarea
                              value={it.warranty_terms}
                              onChange={e => patchItem(idx, { warranty_terms: e.target.value })}
                              className="mt-1 min-h-[96px] w-full rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                              placeholder="กรอกเงื่อนไขการรับประกัน"
                              required
                            />
                          </label>

                          {/* แนบรูปตอนสร้างเลย */}
                          <div className="mt-3">
                            <div className="text-sm text-gray-600">รูปภาพประกอบ (อัปโหลดได้สูงสุด 5 รูป)</div>
                            <div className="mt-2 rounded-2xl border border-dashed border-gray-300 p-4">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => onPickImages(idx, e.target.files)}
                              />
                              {it.images?.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {it.images.map((f, i) => (
                                    <div key={i} className="h-14 w-14 overflow-hidden rounded-lg border">
                                      <img
                                        src={URL.createObjectURL(f)}
                                        alt={`preview-${i}`}
                                        className="h-full w-full object-cover"
                                        onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="mt-2 text-xs text-gray-500">รองรับ JPG, PNG, GIF, WebP (สูงสุด 5MB, 5 รูป)</div>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="pb-2">
                        <button
                          type="button"
                          onClick={addItem}
                          className="rounded-full border border-sky-500 px-4 py-2 text-sm font-medium text-sky-600 hover:bg-sky-50"
                        >
                          ➕ เพิ่มสินค้า
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* footer */}
                <div className="sticky bottom-0 z-10 rounded-b-3xl bg-white px-6 py-4 shadow-[0_-6px_12px_-8px_rgba(0,0,0,0.08)]">
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={warrantySubmitting}
                      className={`rounded-full bg-sky-600 px-6 py-2 text-sm font-semibold text-white shadow transition ${warrantySubmitting ? 'cursor-not-allowed opacity-70' : 'hover:bg-sky-500'}`}
                    >
                      {warrantySubmitting ? 'กำลังบันทึก...' : modalMode === 'create' ? 'บันทึก' : 'ยืนยัน'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {imagePreview.open && (
          <ImagePreview
            images={imagePreview.images}
            initialIndex={imagePreview.index}
            onClose={() => setImagePreview({ open: false, images: [], index: 0 })}
          />
        )}
      </div>

      {/* ✅ วาง Footer นอก div ที่มี pb-12 เพื่อไม่ให้ลอย/มีช่องว่างด้านล่าง */}
      <Footer />
    </>
  )
}
