// frontend-sma/src/pages/WarrantyDashboard.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { API_URL, getToken } from '../lib/api'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import Swal from 'sweetalert2'
import ImageUpload from '../components/ImageUpload'
import ImagePreview from '../components/ImagePreview'
import AppLogo from '../components/AppLogo'
import Footer from '../components/Footer' // ✅
import StoreTabs from '../components/StoreTabs'
import WelcomeOnboardingModal from '../components/WelcomeOnboardingModal'
import introJs from 'intro.js'
import 'intro.js/introjs.css'
import { getConditionsForStoreType } from '../data/warrantyConditionTemplates'
import { FiTrash2 } from 'react-icons/fi'



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
  address: '', // No change needed here
  businessHours: '',
  avatarUrl: '',
  storeType: '',
  notifyDaysInAdvance: 14,
}

// Thailand provinces for select (used in signup and store profile)
const TH_PROVINCES = [
  'กระบี่', 'กรุงเทพมหานคร', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง', 'อุดรธานี', 'อุทัยธานี', 'อุตรดิตถ์', 'อุบลราชธานี'
]

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
  {
    [
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
        <div className="flex items-center gap-2 ml-0 sm:ml-2">
          <input
            type="time"
            value={businessSchedule[d]?.start || '09:00'}
            onChange={(e) => setBusinessSchedule((s) => ({ ...s, [d]: { ...s[d], start: e.target.value } }))}
            className="h-8 w-16 sm:w-20 rounded border border-gray-200 px-2 text-xs"
            disabled={!businessSchedule[d]?.on}
          />
          <span className="text-xs text-gray-400">—</span>
          <input
            type="time"
            value={businessSchedule[d]?.end || '18:00'}
            onChange={(e) => setBusinessSchedule((s) => ({ ...s, [d]: { ...s[d], end: e.target.value } }))}
            className="h-8 w-16 sm:w-20 rounded border border-gray-200 px-2 text-xs"
            disabled={!businessSchedule[d]?.on}
          />
        </div>
      </div>
    ))
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

// Collect existing serials from fetched headers and the in-memory creating list
function collectAllSerials(headers = [], creating = []) {
  const set = new Set()
  try {
    for (const h of headers || []) {
      if (!h || !Array.isArray(h.items)) continue
      for (const it of h.items) {
        if (it && it.serial) set.add(String(it.serial))
      }
    }
    for (const c of creating || []) {
      if (c && c.serial) set.add(String(c.serial))
    }
  } catch (e) {
    // ignore
  }
  return set
}

// Simple 2-digit batch code derived from storeId (fallback '00')
function batchCodeFromStore(storeId) {
  try {
    const id = Number(storeId) || 0
    return String(id % 100).padStart(2, '0')
  } catch {
    return '00'
  }
}

// Random uppercase alphanumeric string of length n
function randAlnum(n = 4) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let out = ''
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
function toISODate(d) {
  if (!d || isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}
function formatAddress(raw) {
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

function formatBusinessHours(raw) {
  if (!raw) return ''
  try {
    const sched = typeof raw === 'string' ? JSON.parse(raw) : raw
    // show short summary like "จ.-ศ. 09:00-18:00"
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const labels = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']
    const ranges = []
    for (let i = 0; i < days.length; i++) {
      const d = days[i]
      const s = sched?.[d]
      if (s && s.on) ranges.push(`${labels[i]} ${s.start}-${s.end}`)
    }
    return ranges.slice(0, 3).join(' • ') || ''
  } catch (e) {
    return String(raw || '')
  }
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
  const [addressParts, setAddressParts] = useState({ street: '', subdistrict: '', district: '', province: '', postcode: '' })
  // ✅ Customer address (used in create-warranty modal) — structured address selector like SignUp
  const [customerAddressParts, setCustomerAddressParts] = useState({ street: '', province: '', district: '', subdistrict: '', postcode: '' })
  const [customerDistrictOptions, setCustomerDistrictOptions] = useState([])
  const [customerSubdistrictOptions, setCustomerSubdistrictOptions] = useState([])
  const [profileImage, setProfileImage] = useState({ file: null, preview: '' })
  const [profileStoreTypeValue, setProfileStoreTypeValue] = useState('')
  const [profileCustomStoreType, setProfileCustomStoreType] = useState('')
  // Dynamic province/district/subdistrict lists (reuse same data as SignUp)
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

  // ===== Onboarding welcome modal & Joyride (แสดงเฉพาะหน้า การรับประกัน) =====
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  useEffect(() => {
    try {
      const key = `wp_seen_welcome_${storeIdResolved}`
      const seen = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
      if (storeIdResolved && !seen) {
        setShowWelcomeModal(true)
        if (typeof window !== 'undefined') window.localStorage.setItem(key, '1')
      }
    } catch (e) {
      // ignore
    }
  }, [storeIdResolved])

  const tourSteps = useMemo(() => [
    {
      element: '#step-create-warranty',
      intro: 'คลิกที่นี่เพื่อสร้างใบรับประกันใหม่ให้ลูกค้า',
      position: 'bottom',
    },
    {
      element: '#step-search-filter',
      intro: 'ค้นหาใบรับประกัน หรือกรองดูตามสถานะการคุ้มครองได้ที่นี่',
      position: 'bottom',
    },
    {
      element: '#step-warranty-list',
      intro: 'รายการใบรับประกันทั้งหมดของคุณจะแสดงอยู่ที่นี่',
      position: 'bottom',
    },
  ], [])

  const handleStartTour = () => {
    // รอจน DOM พร้อมครบทุก element ที่ต้องใช้ในทัวร์
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    let attempts = 0
    const maxAttempts = 20 // รวม ~5 วินาที
    const intervalMs = 250
    let timer = null

    const tryStart = () => {
      attempts += 1
      const createEl = document.querySelector('#step-create-warranty')
      const filterEl = document.querySelector('#step-search-filter')
      const listEl = document.querySelector('#step-warranty-list')

      if ((createEl && filterEl && listEl) || attempts >= maxAttempts) {
        if (timer) window.clearInterval(timer)

        const intro = introJs()
        intro.setOptions({
          steps: tourSteps,
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
    }

    timer = window.setInterval(tryStart, intervalMs)
  }

  // load provinces/districts/subdistricts and build lookup maps
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
        setProvincesList(TH_PROVINCES.map((p, i) => ({ name: p, code: String(i) })))
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
      if (!provinceNameOrCode) {
        setDistrictOptions([])
        return
      }
      let provinceCode = provinceNameOrCode
      if (isNaN(Number(provinceNameOrCode))) {
        const p = provincesList.find((x) => x.name === provinceNameOrCode)
        provinceCode = p?.code
      }
      const pid = String(provinceCode)
      if (districtsMap) {
        const list = districtsMap[pid] || []
        setDistrictOptions(list.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })).sort((a, b) => a.name.localeCompare(b.name, 'th')))
        return
      }

      let districtsData = districtsCache
      if (!districtsData) {
        let res = await fetch(DISTRICTS_JSON_LOCAL)
        if (!res.ok) res = await fetch(DISTRICTS_JSON_FALLBACK)
        districtsData = await res.json()
        setDistrictsCache(districtsData)
      }
      const filtered = districtsData.filter((d) => String(d.province_id ?? d.province_code) === pid)
      setDistrictOptions(filtered.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })).sort((a, b) => a.name.localeCompare(b.name, 'th')))
    } catch (err) {
      console.error('loadDistrictsForProvince error', err)
      setDistrictOptions([])
    }
  }

  async function loadSubdistrictsForDistrict(districtCode) {
    try {
      if (!districtCode) {
        setSubdistrictOptions([])
        return
      }
      const did = String(districtCode)
      if (subdistrictsMap) {
        const list = subdistrictsMap[did] || []
        setSubdistrictOptions(list.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })).sort((a, b) => a.name.localeCompare(b.name, 'th')))
        return
      }

      let subs = subdistrictsCache
      if (!subs) {
        let res = await fetch(SUBDISTRICTS_JSON_LOCAL)
        if (!res.ok) res = await fetch(SUBDISTRICTS_JSON_FALLBACK)
        subs = await res.json()
        setSubdistrictsCache(subs)
      }
      const filtered = subs.filter((s) => String(s.district_id ?? s.district_code) === did)
      setSubdistrictOptions(filtered.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })).sort((a, b) => a.name.localeCompare(b.name, 'th')))
    } catch (err) {
      console.error('loadSubdistrictsForDistrict error', err)
      setSubdistrictOptions([])
    }
  }

  // ✅ customer-address helpers (separate options from store profile modal)
  async function loadCustomerDistrictsForProvince(provinceCode) {
    try {
      if (!provinceCode) {
        setCustomerDistrictOptions([])
        return
      }
      const pid = String(provinceCode)
      if (districtsMap) {
        const list = districtsMap[pid] || []
        setCustomerDistrictOptions(list.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })).sort((a, b) => a.name.localeCompare(b.name, 'th')))
        return
      }

      let districtsData = districtsCache
      if (!districtsData) {
        let res = await fetch(DISTRICTS_JSON_LOCAL)
        if (!res.ok) res = await fetch(DISTRICTS_JSON_FALLBACK)
        districtsData = await res.json()
        setDistrictsCache(districtsData)
      }
      const filtered = (districtsData || []).filter((d) => String(d.province_id ?? d.province_code ?? d.provinceId ?? d.province) === pid)
      setCustomerDistrictOptions(filtered.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })).sort((a, b) => a.name.localeCompare(b.name, 'th')))
    } catch (err) {
      console.error('loadCustomerDistrictsForProvince error', err)
      setCustomerDistrictOptions([])
    }
  }

  async function loadCustomerSubdistrictsForDistrict(districtCode) {
    try {
      if (!districtCode) {
        setCustomerSubdistrictOptions([])
        return
      }
      const did = String(districtCode)
      if (subdistrictsMap) {
        const list = subdistrictsMap[did] || []
        setCustomerSubdistrictOptions(list.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })).sort((a, b) => a.name.localeCompare(b.name, 'th')))
        return
      }

      let subs = subdistrictsCache
      if (!subs) {
        let res = await fetch(SUBDISTRICTS_JSON_LOCAL)
        if (!res.ok) res = await fetch(SUBDISTRICTS_JSON_FALLBACK)
        subs = await res.json()
        setSubdistrictsCache(subs)
      }
      const filtered = (subs || []).filter((s) => String(s.district_id ?? s.district_code ?? s.amphure_id ?? s.district) === did)
      setCustomerSubdistrictOptions(filtered.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })).sort((a, b) => a.name.localeCompare(b.name, 'th')))
    } catch (err) {
      console.error('loadCustomerSubdistrictsForDistrict error', err)
      setCustomerSubdistrictOptions([])
    }
  }
  // compact business hours state for profile modal (small responsive control)
  const defaultBusinessSchedule = {
    mon: { on: true, start: '09:00', end: '18:00' },
    tue: { on: true, start: '09:00', end: '18:00' },
    wed: { on: true, start: '09:00', end: '18:00' },
    thu: { on: true, start: '09:00', end: '18:00' },
    fri: { on: true, start: '09:00', end: '18:00' },
    sat: { on: false, start: '09:00', end: '12:00' },
    sun: { on: false, start: '09:00', end: '12:00' },
  }

  const [businessSchedule, setBusinessSchedule] = useState(defaultBusinessSchedule)

  function parseBusinessSchedule(raw) {
    if (!raw) return defaultBusinessSchedule
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      // ensure all keys exist
      return { ...defaultBusinessSchedule, ...parsed }
    } catch (e) {
      // couldn't parse, fallback to using raw text as an 'open all days' simplified schedule
      return defaultBusinessSchedule
    }
  }
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

  // Notifications and header are handled by the shared DashboardLayout

  const [warrantySubmitting, setWarrantySubmitting] = useState(false)
  const [warrantyModalError, setWarrantyModalError] = useState('')
  const [downloadingPdfId, setDownloadingPdfId] = useState(null)
  const [deletingWarrantyId, setDeletingWarrantyId] = useState(null)

  // รูปใน modal edit
  const [warrantyImages, setWarrantyImages] = useState([])

  const [imagePreview, setImagePreview] = useState({ open: false, images: [], index: 0 })

  // ✅ Modal สำหรับแสดงเงื่อนไขการรับประกัน
  const [conditionsModal, setConditionsModal] = useState({ open: false, conditions: [], custom: '' })
  // ✅ State สำหรับช่องเพิ่มเงื่อนไขใหม่ (ปุ่ม "+")
  const [editAddConditionText, setEditAddConditionText] = useState('')
  const [editAddConditionOpen, setEditAddConditionOpen] = useState(false)
  const [createAddConditionText, setCreateAddConditionText] = useState({})
  const [createAddConditionOpen, setCreateAddConditionOpen] = useState({})

  // ✅ สำหรับแก้ไขอีเมลลูกค้าระดับใบ
  const [editHeaderEmail, setEditHeaderEmail] = useState('')

  const profileAvatarSrc = profileImage.preview || storeProfile.avatarUrl || ''

  const location = useLocation()

  /* ---------- สร้างหลายสินค้าในใบเดียว + auto expiry ---------- */
  const makeItem = (seedSN = null, lockEmail = false) => ({
    customer_email: '',
    customer_address: '',
    product_name: '',
    model: '', // ✅ เพิ่มฟิลด์รุ่นในโหมดสร้าง
    price: '', // ✅ ราคาสินค้า (บาท) - optional
    duration_months: 12,
    // ✅ เพิ่มโหมดกำหนดเอง
    duration_mode: 'preset',      // 'preset' | 'custom'
    custom_unit: 'months',        // 'months' | 'days'
    custom_value: '',             // จำนวนที่ผู้ใช้กรอกเอง
    // serial จะให้ผู้ใช้กรอกเอง (optional)
    serial: seedSN || '',
    lockedEmail: !!lockEmail,
    purchase_date: '',
    expiry_date: '',
    warranty_terms: '',
    // ✅ เพิ่มสำหรับ checkbox เงื่อนไข
    selectedConditions: [],       // array of selected condition strings
    customCondition: '',          // ข้อความเพิ่มเติมจากช่อง "อื่นๆ"
    note: '',
    images: [],
  })
  // start empty; modal open will seed the first item (ไม่ auto-generate serial แล้ว)
  const [createItems, setCreateItems] = useState([])

  // ✅ เพิ่มรายการใหม่พร้อมดึงอีเมลจาก "รายการที่ 1" ให้เลย
  const addItem = () =>
    setCreateItems(prev => {
      // pick first non-empty email to seed, if any
      const emailSeed = (prev || []).find(p => p.customer_email)?.customer_email || ''
      const addrSeed = (prev || []).find(p => p.customer_address)?.customer_address || ''
      // newly added items are locked for email editing; serial เริ่มว่าง ให้ผู้ใช้กรอกเอง
      return [...prev, { ...makeItem(null, true), customer_email: emailSeed, customer_address: addrSeed }]
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

      // If any item's customer_address changed, sync to all items
      if ('customer_address' in patch) {
        const addr = String(patch.customer_address ?? '')
        for (let i = 0; i < next.length; i++) {
          next[i] = { ...next[i], customer_address: addr }
        }
      }
      return next
    })
  }


  // ✅ Customer address JSON builder (same shape as SignUp / store profile)
  function buildCustomerAddressJson(parts) {
    const prov = provincesList.find((p) => String(p.code) === String(parts?.province))
    const dist = customerDistrictOptions.find((d) => String(d.code) === String(parts?.district))
    const sub = customerSubdistrictOptions.find((s) => String(s.code) === String(parts?.subdistrict))
    const postcode = (parts?.postcode || sub?.zipcode || '').toString()

    return JSON.stringify({
      street: (parts?.street || '').toString(),
      province: parts?.province ? { id: parts.province, name: prov?.name || '' } : '',
      district: parts?.district ? { id: parts.district, name: dist?.name || '' } : '',
      subdistrict: parts?.subdistrict ? { id: parts.subdistrict, name: sub?.name || '', zipcode: postcode } : '',
      postcode,
    })
  }

  // Keep customer address UI in sync with createItems[0].customer_address (and auto-sync to all items via patchItem)
  const syncCustomerAddress = (updater) => {
    setCustomerAddressParts((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : (updater || prev)
      const hasAny = ['street', 'province', 'district', 'subdistrict', 'postcode'].some((k) => String(next?.[k] || '').trim())
      try {
        if (!hasAny) {
          patchItem(0, { customer_address: '' })
        } else {
          patchItem(0, { customer_address: buildCustomerAddressJson(next) })
        }
      } catch (e) { }
      return next
    })
  }

  const onPickImages = (idx, files) => {
    const arr = Array.from(files || []).slice(0, 5)
    patchItem(idx, { images: arr })
  }

  useEffect(() => {
    // Open SSE connection for real-time notifications
    const token = getToken()
    if (!token) return
    const es = new EventSource(`${API_URL.replace(/\/+$/, '')}/notifications/stream?token=${token}`)

    es.addEventListener('notification', (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        setNotifications((p) => [payload, ...(p || [])])
      } catch (e) { }
    })

    es.onerror = () => { /* silent close on error */ }

    return () => es.close()
  }, [])

  // --- จุดที่แก้ไข: เติม useEffect ครอบส่วนนี้ ---
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
  // ------------------------------------------

  // click outside handler for notifications dropdown
  // notifications dropdown is handled by the shared DashboardLayout

  async function fetchNotifications() {
    if (!storeIdResolved) return
    setNotifLoading(true)
    try {
      const res = await api.get(`/notifications`)
      const data = res?.data?.data || res?.data || []
      let arr = Array.isArray(data) ? data : []

      // ✅ ร้านเห็นเฉพาะ 2 แบบ
      const allow = new Set(['expiry_daily_summary', 'complaint_created'])
      arr = arr.filter(n => allow.has(n?.data?.type))

      arr.sort(
        (a, b) =>
          new Date(b.createdAt || b.time || b.created_at || 0) -
          new Date(a.createdAt || a.time || a.created_at || 0)
      )
      setNotifications(arr)
    } catch (e) {
      setNotifications([])
    } finally {
      setNotifLoading(false)
    }
  }


  async function markAllAsRead() {
    setNotifications(prev => (prev || []).map(n => ({ ...n, read: true })))
    try {
      setNotifLoading(true)
      await api.post('/notifications/mark-all-read')
      // do not re-fetch here; rely on optimistic update and SSE
    } catch (e) { }
    finally { setNotifLoading(false) }
  }

  async function markOneAsRead(id) {
    try {
      setNotifications(prev => (prev || []).map(n => (String(n.id) === String(id) ? { ...n, read: true } : n)))
      await api.patch(`/notifications/${id}/read`)
      await fetchNotifications()
    } catch (e) { }
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

  const openProfileModal = async () => {
    // initialize compact business hours from current store profile when opening
    setBusinessSchedule(parseBusinessSchedule(storeProfile.businessHours))
    // initialize address parts from current store profile
    try {
      const raw = storeProfile.address
      if (raw && typeof raw === 'string') {
        const parsed = JSON.parse(raw)
        setAddressParts({
          street: parsed.street || '',
          subdistrict: parsed.subdistrict || '',
          district: parsed.district || '',
          province: parsed.province?.id ?? parsed.province ?? '',
          postcode: parsed.postcode || '',
        })
        // populate district/subdistrict options based on parsed province/district
        try {
          const prov = parsed.province?.id ?? parsed.province ?? ''
          if (prov) await loadDistrictsForProvince(prov)
          const dist = parsed.district?.id ?? parsed.district ?? ''
          if (dist) await loadSubdistrictsForDistrict(dist)
        } catch (e) { }
      } else if (raw && typeof raw === 'object') {
        setAddressParts({
          street: raw.street || '',
          subdistrict: raw.subdistrict || '',
          district: raw.district || '',
          province: raw.province?.id ?? raw.province ?? '',
          postcode: raw.postcode || '',
        })
        try {
          const prov = raw.province?.id ?? raw.province ?? ''
          if (prov) await loadDistrictsForProvince(prov)
          const dist = raw.district?.id ?? raw.district ?? ''
          if (dist) await loadSubdistrictsForDistrict(dist)
        } catch (e) { }
      } else {
        setAddressParts({ street: String(storeProfile.address || '') || '', subdistrict: '', district: '', province: '', postcode: '' })
      }
    } catch (e) {
      setAddressParts({ street: String(storeProfile.address || '') || '', subdistrict: '', district: '', province: '', postcode: '' })
    }
    // init store type selector from storeProfile.storeType
    try {
      const rawType = (storeProfile.storeType || '').toString().trim()
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
    setProfileModalOpen(true)
    setProfileTab('info')
    setProfileMenuOpen(false)
    setModalError('')
    setProfileSubmitting(false)
    setPasswordSubmitting(false)
  }

  // Auto-open profile modal when query contains openProfile=1 (useful when navigating from other pages)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search)
      if (params.get('openProfile') === '1') {
        openProfileModal()
      }
    } catch (e) { }
  }, [location.search])

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
        // parse address JSON if present
        try {
          const raw = payload.storeProfile.address
          if (raw && typeof raw === 'string') {
            const parsed = JSON.parse(raw)
            setAddressParts({
              street: parsed.street || '',
              subdistrict: parsed.subdistrict || '',
              district: parsed.district || '',
              province: parsed.province || '',
              postcode: parsed.postcode || '',
            })
          } else if (raw && typeof raw === 'object') {
            setAddressParts({
              street: raw.street || '',
              subdistrict: raw.subdistrict || '',
              district: raw.district || '',
              province: raw.province || '',
              postcode: raw.postcode || '',
            })
          } else {
            setAddressParts({ street: String(payload.storeProfile.address || '') || '', subdistrict: '', district: '', province: '', postcode: '' })
          }
        } catch (e) {
          setAddressParts({ street: String(payload.storeProfile.address || '') || '', subdistrict: '', district: '', province: '', postcode: '' })
        }
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
    console.log('openWarrantyModal', mode, item)
    setModalMode(mode)
    setSelectedItem(item)
    setWarrantyModalError('')
    setWarrantySubmitting(false)
    setWarrantyImages(item?.images || [])

    if (mode === 'create') {
      // เริ่มต้นรายการแรกโดยไม่สร้าง Serial ให้เอง (ให้ผู้ใช้กรอกเองได้)
      setCreateItems([makeItem(null, false)])
      setEditForm(null)
      setManualExpiry(false)
      setEditHeaderEmail('')
      // ✅ reset customer address selector when opening create modal
      setCustomerAddressParts({ street: '', province: '', district: '', subdistrict: '', postcode: '' })
      setCustomerDistrictOptions([])
      setCustomerSubdistrictOptions([])

    } else if (mode === 'edit' && item) {
      const hasDays = typeof item.durationDays === 'number' && item.durationDays > 0
      const hasMonths = typeof item.durationMonths === 'number' && item.durationMonths > 0

      setEditForm({
        product_name: item.productName || '',
        model: item.model || '', // ✅ ผูก model ตอนแก้ไข
        price: item.price != null ? String(item.price) : '', // ✅ โหลดราคาตอนแก้ไข
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
        // ✅ โหลดเงื่อนไขที่เลือกไว้
        selectedConditions: Array.isArray(item.selectedConditions) ? item.selectedConditions : [],
        customCondition: item.customCondition || '',
      })
      setEditHeaderEmail(item?._headerEmail || '') // ✅ อีเมลลูกค้าระดับใบ
      setEditHeaderAddress(item?._headerAddress || '') // ✅ ที่อยู่ลูกค้าระดับใบ (raw JSON/string)

      // ✅ แปลงที่อยู่ลูกค้า (JSON หรือสตริง) เป็นโครงสร้างสำหรับตัวเลือกจังหวัด/อำเภอ/ตำบล
      try {
        let parsed = item?._headerAddress || ''
        if (parsed && typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed)
          } catch {
            // ถ้าไม่ใช่ JSON ปล่อยให้เป็นสตริงธรรมดา แสดงใน street อย่างเดียว
            setEditCustomerAddressParts({
              street: String(parsed || ''),
              province: '',
              district: '',
              subdistrict: '',
              postcode: '',
            })
            setEditCustomerDistrictOptions([])
            setEditCustomerSubdistrictOptions([])
            setWarrantyModalOpen(true)
            return
          }
        }

        const street = parsed?.street || parsed?.address || ''
        const provinceCode = parsed?.province?.id || parsed?.province?.code || ''
        const districtCode = parsed?.district?.id || parsed?.district?.code || ''
        const subdistrictCode = parsed?.subdistrict?.id || parsed?.subdistrict?.code || ''
        const postcode = parsed?.postcode || parsed?.subdistrict?.zipcode || ''

        const baseParts = {
          street: String(street || ''),
          province: provinceCode ? String(provinceCode) : '',
          district: districtCode ? String(districtCode) : '',
          subdistrict: subdistrictCode ? String(subdistrictCode) : '',
          postcode: postcode ? String(postcode) : '',
        }

        setEditCustomerAddressParts(baseParts)

        // โหลดตัวเลือกอำเภอ/ตำบลตาม province/district ที่มีอยู่
        ;(async () => {
          try {
            if (baseParts.province) {
              if (districtsMap) {
                const list = (districtsMap[String(baseParts.province)] || []).map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code }))
                setEditCustomerDistrictOptions(list.sort((a, b) => a.name.localeCompare(b.name, 'th')))
              } else {
                await loadCustomerDistrictsForProvince(baseParts.province)
                setEditCustomerDistrictOptions(customerDistrictOptions)
              }
            } else {
              setEditCustomerDistrictOptions([])
            }

            if (baseParts.district) {
              if (subdistrictsMap) {
                const list = (subdistrictsMap[String(baseParts.district)] || []).map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip }))
                setEditCustomerSubdistrictOptions(list.sort((a, b) => a.name.localeCompare(b.name, 'th')))
              } else {
                await loadCustomerSubdistrictsForDistrict(baseParts.district)
                setEditCustomerSubdistrictOptions(customerSubdistrictOptions)
              }
            } else {
              setEditCustomerSubdistrictOptions([])
            }
          } catch {
            setEditCustomerDistrictOptions([])
            setEditCustomerSubdistrictOptions([])
          }
        })()
      } catch {
        setEditCustomerAddressParts({ street: '', province: '', district: '', subdistrict: '', postcode: '' })
        setEditCustomerDistrictOptions([])
        setEditCustomerSubdistrictOptions([])
      }
      setManualExpiry(false)
    }

    setWarrantyModalOpen(true)
  }

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Prevent background page scrolling when any modal / overlay is open
  // NOTE: previous implementation captured the "anyModalOpen" value in the cleanup
  // which could end up restoring the wrong value (e.g. storing 'hidden' and
  // later re-applying it). We only capture the previous overflow when we
  // actually open a modal and always restore that saved value in cleanup.
  useEffect(() => {
    const anyModalOpen = !!(isProfileModalOpen || isWarrantyModalOpen || imagePreview.open)
    if (!anyModalOpen) return // nothing to do when no modal

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      // always restore the value we captured when the modal was opened
      document.body.style.overflow = prevOverflow
    }
  }, [isProfileModalOpen, isWarrantyModalOpen, imagePreview.open])

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
      if (!finalStoreType && storeProfile.storeType) {
        finalStoreType = storeProfile.storeType
      }
      const payload = {
        storeName: storeProfile.storeName,
        contactName: storeProfile.contactName,
        email: storeProfile.email,
        phone: storeProfile.phone,
        storeType: finalStoreType,
        // send structured address as JSON string (matches signup format)
        address: JSON.stringify({
          street: addressParts.street || '',
          subdistrict: addressParts.subdistrict || '',
          district: addressParts.district || '',
          province: addressParts.province || '',
          postcode: addressParts.postcode || '',
        }),
        // send compact business schedule as JSON so backend can store the structured hours
        businessHours: JSON.stringify(businessSchedule),
        avatarUrl: storeProfile.avatarUrl,
      }
      const response = await api.patch(`/store/${storeIdResolved}/profile`, payload)
      const updatedProfile = response.data?.data?.storeProfile ?? payload
      setStoreProfile((prev) => ({ ...prev, ...updatedProfile }))
      // update addressParts and businessSchedule from returned profile so UI reflects stored values
      try {
        const rawAddr = updatedProfile.address
        if (rawAddr) {
          const parsedAddr = typeof rawAddr === 'string' ? JSON.parse(rawAddr) : rawAddr
          setAddressParts({
            street: parsedAddr.street || '',
            subdistrict: parsedAddr.subdistrict || '',
            district: parsedAddr.district || '',
            province: parsedAddr.province || '',
            postcode: parsedAddr.postcode || '',
          })
        }
      } catch (e) { }
      try {
        setBusinessSchedule(parseBusinessSchedule(updatedProfile.businessHours))
      } catch (e) { }
      setProfileImage({ file: null, preview: '' })
      setModalError('')
      setProfileModalOpen(false)
    } catch (error) {
      setModalError(error?.response?.data?.error?.message || 'บันทึกข้อมูลร้านไม่สำเร็จ')
    } finally {
      setProfileSubmitting(false)
    }
  }

  // ที่อยู่ลูกค้า (ระดับใบ) สำหรับโหมดแก้ไข
  const [editHeaderAddress, setEditHeaderAddress] = useState('')
  const [editCustomerAddressParts, setEditCustomerAddressParts] = useState({ street: '', province: '', district: '', subdistrict: '', postcode: '' })
  const [editCustomerDistrictOptions, setEditCustomerDistrictOptions] = useState([])
  const [editCustomerSubdistrictOptions, setEditCustomerSubdistrictOptions] = useState([])

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
    console.log('handleWarrantySubmit start', { modalMode, selectedItem })
    if (!storeIdResolved) return

    // ✅ Validate required fields before submitting
    if (modalMode === 'create') {
      const missing = []
      for (let i = 0; i < createItems.length; i++) {
        const it = createItems[i]
        if (!(it.customer_email || '').trim()) missing.push(`รายการที่ ${i + 1}: อีเมลลูกค้า`)
        if (!(it.product_name || '').trim()) missing.push(`รายการที่ ${i + 1}: ชื่อสินค้า`)
        if (!(it.purchase_date || '').trim()) missing.push(`รายการที่ ${i + 1}: วันที่ซื้อ`)
        // ✅ ตรวจ custom duration ต้อง >= 1
        if (it.duration_mode === 'custom' && (!it.custom_value || Number(it.custom_value) < 1)) {
          missing.push(`รายการที่ ${i + 1}: จำนวนวัน/เดือน (ต้อง 1 ขึ้นไป)`)
        }
        // ✅ ตรวจเงื่อนไขอย่างน้อย 1 ข้อ
        if (!Array.isArray(it.selectedConditions) || it.selectedConditions.length === 0) {
          missing.push(`รายการที่ ${i + 1}: เงื่อนไขการรับประกัน (เลือกอย่างน้อย 1 ข้อ)`)
        }
      }
      if (missing.length > 0) {
        Swal.fire({
          icon: 'warning',
          title: 'ข้อมูลไม่ครบถ้วน',
          html: `<div style="text-align:left">กรุณากรอกข้อมูลให้ครบ:<br/><ul style="margin-top:8px;padding-left:20px">${missing.map(m => `<li>${m}</li>`).join('')}</ul></div>`,
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#0284c7',
        })
        return
      }
    } else if (modalMode === 'edit') {
      if (!(editForm?.product_name || '').trim() || !(editForm?.purchase_date || '').trim()) {
        Swal.fire({
          icon: 'warning',
          title: 'ข้อมูลไม่ครบถ้วน',
          text: 'กรุณากรอกชื่อสินค้าและวันที่ซื้อ',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#0284c7',
        })
        return
      }
      // ✅ ตรวจ custom duration ต้อง >= 1
      if (editForm?.duration_mode === 'custom' && (!editForm?.custom_value || Number(editForm.custom_value) < 1)) {
        Swal.fire({
          icon: 'warning',
          title: 'ข้อมูลไม่ถูกต้อง',
          text: 'จำนวนวัน/เดือนต้องเป็นตัวเลข 1 ขึ้นไป',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#0284c7',
        })
        return
      }
      // ✅ ตรวจเงื่อนไขอย่างน้อย 1 ข้อ (โหมดแก้ไข)
      if (!Array.isArray(editForm?.selectedConditions) || editForm.selectedConditions.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'ข้อมูลไม่ครบถ้วน',
          text: 'กรุณาเลือกเงื่อนไขการรับประกันอย่างน้อย 1 ข้อ',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#0284c7',
        })
        return
      }
    }

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
        // ✅ ส่งราคาสินค้า (บาท)
        if (editForm?.price != null && editForm?.price !== '') {
          fd.append('price', String(editForm.price))
        } else {
          fd.append('price', '')
        }
        // ✅ ส่งเงื่อนไขที่เลือกจาก checkbox
        const selectedConds = Array.isArray(editForm?.selectedConditions) ? editForm.selectedConditions : []
        fd.append('selectedConditions', JSON.stringify(selectedConds))
        fd.append('customCondition', String(editForm?.customCondition || '').trim())

        await api.patch(`/warranty-items/${selectedItem.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        // ✅ ถ้าอีเมลหรือที่อยู่ลูกค้า (ระดับใบ) เปลี่ยน ให้แพตช์ header
        if (selectedItem?._headerId) {
          const emailTrim = editHeaderEmail.trim()

          // สร้าง JSON ที่อยู่ลูกค้ารูปแบบเดียวกับตอนสร้างใบ
          let addrJson = ''
          try {
            const prov = provincesList.find((p) => String(p.code) === String(editCustomerAddressParts.province))
            const dist = editCustomerDistrictOptions.find((d) => String(d.code) === String(editCustomerAddressParts.district))
            const sub = editCustomerSubdistrictOptions.find((s) => String(s.code) === String(editCustomerAddressParts.subdistrict))
            const postcode = (editCustomerAddressParts.postcode || sub?.zipcode || '').toString()

            const anyAddr = ['street', 'province', 'district', 'subdistrict', 'postcode'].some(
              (k) => String(editCustomerAddressParts?.[k] || '').trim()
            )

            if (anyAddr) {
              addrJson = JSON.stringify({
                street: (editCustomerAddressParts.street || '').toString(),
                province: editCustomerAddressParts.province
                  ? { id: editCustomerAddressParts.province, name: prov?.name || '' }
                  : '',
                district: editCustomerAddressParts.district
                  ? { id: editCustomerAddressParts.district, name: dist?.name || '' }
                  : '',
                subdistrict: editCustomerAddressParts.subdistrict
                  ? { id: editCustomerAddressParts.subdistrict, name: sub?.name || '', zipcode: postcode }
                  : '',
                postcode,
              })
            }
          } catch {
            addrJson = editHeaderAddress.trim() || ''
          }

          const emailChanged = emailTrim !== (selectedItem?._headerEmail || '')
          const addrChanged = addrJson !== (selectedItem?._headerAddress || '')

          if (emailChanged || addrChanged) {
            try {
              await api.patch(`/warranties/${selectedItem._headerId}`, {
                customerEmail: emailTrim || null,
                customerAddress: addrJson || null,
              })
            } catch (e) {
              console.warn('Patch warranty header info failed:', e?.response?.data || e?.message)
            }
          }
        }

        await fetchDashboard()
        setWarrantyModalOpen(false)
        setWarrantySubmitting(false)
        Swal.fire({
          icon: 'success',
          title: 'แก้ไขสำเร็จ',
          text: 'บันทึกข้อมูลใบรับประกันเรียบร้อยแล้ว',
          showConfirmButton: false,
          timer: 2000,
        })
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
            customer_address: (it.customer_address || '').trim(),
            product_name: (it.product_name || '').trim(),
            model: (it.model || '').trim() || null, // ✅ ส่งรุ่นไป backend
            price: it.price != null && it.price !== '' ? Number(it.price) || null : null, // ✅ ราคาสินค้า
            purchase_date: (it.purchase_date || '').trim(),
            serial: (it.serial || '').trim(),
            warranty_terms: (it.warranty_terms || '').trim(),
            note: (it.note || '').trim(),
            duration_months: monthsForApi,          // ถ้าเลือก "วัน" จะเป็น 0
            expiry_date: computedExpiry || '',
            // ✅ ส่งเงื่อนไขที่เลือกจาก checkbox
            selectedConditions: Array.isArray(it.selectedConditions) ? it.selectedConditions : [],
            customCondition: (it.customCondition || '').trim(),
          }
        }),
      }

      console.log('POST /store/' + storeIdResolved + '/warranties payload', payload)
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
      Swal.fire({
        icon: 'success',
        title: 'สร้างใบรับประกันสำเร็จ',
        text: `สร้างใบรับประกัน ${createItems.length} รายการเรียบร้อยแล้ว`,
        showConfirmButton: false,
        timer: 2500,
      })
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error?.response?.data?.error?.message || 'ไม่สามารถบันทึกใบรับประกันได้',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#e11d48',
      })
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
      const url = window.URL.createObjectURL(blob)

      // Safari-friendly approach
      const win = window.open(url, '_blank')
      if (!win) {
        // Fallback if popup blocked
        const a = document.createElement('a')
        a.href = url
        a.download = `warranty-${warrantyId}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60000)
    } catch (error) {
      setDashboardError(error?.response?.data?.error?.message || 'ไม่สามารถดาวน์โหลดใบรับประกันได้')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  const handleDeleteWarranty = async (header) => {
    if (!header?.id) return

    const result = await Swal.fire({
      title: 'ลบใบรับประกัน?',
      text: `คุณต้องการลบใบรับประกันรหัส ${header.code || '-'} นี้หรือไม่? การลบไม่สามารถย้อนกลับได้`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
    })

    if (!result.isConfirmed) return

    try {
      setDeletingWarrantyId(header.id)
      await api.delete(`/warranties/${header.id}`)
      await fetchDashboard()
      Swal.fire({
        icon: 'success',
        title: 'ลบใบรับประกันสำเร็จ',
        showConfirmButton: false,
        timer: 2000,
      })
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่สามารถลบใบรับประกันได้',
        text:
          error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          'เกิดข้อผิดพลาดในการลบใบรับประกัน',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#e11d48',
      })
    } finally {
      setDeletingWarrantyId(null)
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
  const storeAddrShort = formatAddress(storeProfile.address)

  return (
    <>
      {/* 🟦 BG: ปรับให้เหมือนโค้ด1 */}
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-sky-100/60 pb-16 overflow-x-hidden">
        {/* Header provided by shared `/dashboard` layout */}


        <main className="mx-auto mt-8 max-w-6xl px-2 sm:px-6 lg:px-8">
          {/* Welcome modal shown only for new store accounts on Warranty page */}
          <WelcomeOnboardingModal
            open={showWelcomeModal}
            onClose={() => setShowWelcomeModal(false)}
            title="ยินดีต้อนรับสู่ระบบการรับประกัน"
            description="สร้างใบรับประกันแรกของคุณและดูวิธีใช้งานฟีเจอร์สำคัญในไม่กี่ขั้นตอน"
            onStart={handleStartTour}
          />
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

          {/* Tabs + page heading moved outside the white card (match StoreDashboard layout) */}
          <div className="mb-6">
            <StoreTabs />
          </div>

          <div className="rounded-3xl border border-sky-100 bg-gradient-to-b from-white to-sky-50 p-4 sm:p-6 shadow-xl min-w-0">
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
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <SectionTitle>จัดการการรับประกัน</SectionTitle>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2 rounded-full bg-white p-1"></div>
                    <button
                      id="step-create-warranty"
                      type="button"
                      onClick={() => openWarrantyModal('create')}
                      className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow hover:-translate-y-0.5 hover:bg-sky-500 transition wp-tour-create-button"
                    >
                      สร้างใบรับประกัน
                    </button>
                  </div>
                </div>

                <div
                  id="step-search-filter"
                  className="mb-6 flex flex-wrap items-center gap-2 sm:gap-3 wp-tour-filter-area"
                >
                  <div className="flex w-full sm:flex-1 sm:w-auto min-w-0 items-center rounded-2xl bg-white px-3 py-2 sm:px-4 shadow ring-1 ring-black/5">
                    <span className="text-slate-400">🔍</span>
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="w-full bg-transparent px-2 py-2 text-sm focus:outline-none"
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
                          className={`px-2 sm:px-4 h-8 sm:h-10 rounded-full text-xs sm:text-sm border font-medium hover:-translate-y-0.5 transition ${colors}`}
                        >
                          {f.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* รายการใบรับประกัน (แบ่งหน้า 5 ใบ/หน้า) */}
                <div
                  id="step-warranty-list"
                  className="mb-8 grid gap-4 wp-tour-warranty-list"
                >
                  {paginatedHeaders.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                      ยังไม่มีใบรับประกัน
                    </div>
                  ) : (
                    paginatedHeaders.map(header => {
                      const expanded = !!expandedByHeader[header.id]
                      const totalItems = header._filteredItems?.length ?? header.items?.length ?? 0
                      const firstItemName =
                        (Array.isArray(header._filteredItems) && header._filteredItems[0]?.productName) ||
                        (Array.isArray(header.items) && header.items[0]?.productName) ||
                        null

                      const titleText = header.code
                        ? `ใบรับประกัน #${header.code}`
                        : 'ใบรับประกัน'

                      const createdAtDate = header.createdAt ? new Date(header.createdAt) : null
                      const createdLabel = createdAtDate
                        ? createdAtDate.toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '-'
                      return (
                        // 🟦 การ์ดใบรับประกัน: โทนสเลทแบบโค้ด1
                        <div key={header.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-md transition hover:shadow-lg min-w-0">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-lg font-semibold text-slate-900 truncate" title={titleText}>{titleText}</div>
                              <div className="mt-2 grid gap-1 text-sm text-slate-700 md:grid-cols-2">
                                <div>วันที่ออกใบรับประกัน: <span className="font-medium text-slate-900">{createdLabel}</span></div>
                                <div>ลูกค้า: <span className="font-medium text-slate-900">{header.customerName || '-'}</span></div>
                                <div>เบอร์โทรศัพท์: <span className="font-medium text-slate-900">{header.customerPhone || '-'}</span></div>
                                <div>อีเมลลูกค้า: <span className="font-medium text-slate-900">{header.customerEmail || '-'}</span></div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 items-stretch md:items-end">
                              <button
                                type="button"
                                onClick={() => header && handleDownloadPdf(header.id)}
                                disabled={!header || downloadingPdfId === header.id}
                                className={`h-9 w-full rounded-full border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-white transition md:h-10 md:w-auto md:min-w-[96px] md:px-4 md:py-2 md:text-sm ${
                                  !header || downloadingPdfId === header.id
                                    ? 'cursor-not-allowed opacity-70'
                                    : 'hover:-translate-y-0.5 hover:bg-sky-50'
                                }`}
                              >
                                {downloadingPdfId === header.id ? 'กำลังดาวน์โหลด…' : 'PDF'}
                              </button>
                              <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
                                <button
                                  type="button"
                                  onClick={() => setExpandedByHeader(prev => ({ ...prev, [header.id]: !prev[header.id] }))}
                                  className="w-full rounded-full border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-white hover:-translate-y-0.5 hover:bg-sky-50 transition md:w-auto md:px-4 md:py-2"
                                >
                                  {expanded ? 'ซ่อนรายละเอียด' : 'รายละเอียดเพิ่มเติม'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteWarranty(header)}
                                  disabled={deletingWarrantyId === header.id}
                                  className={`p-2 rounded-full transition-colors ${
                                    deletingWarrantyId === header.id
                                      ? 'cursor-not-allowed text-rose-300'
                                      : 'text-rose-500 hover:bg-rose-50 hover:text-rose-600'
                                  }`}
                                  aria-label="ลบใบรับประกัน"
                                >
                                  <FiTrash2 className="h-5 w-5" />
                                </button>
                              </div>
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
                                  <div className="flex-1 min-w-0 space-y-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <div className="text-base font-semibold text-slate-900">{it.productName}</div>
                                      <StatusBadge label={it.statusTag} className={it.statusColor} />

                                    </div>
                                    <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                                      <div>Serial No.: <span className="font-medium text-slate-900">{it.serial || '-'}</span></div>
                                      <div>วันที่เริ่มรับประกัน: <span className="font-medium text-slate-900">{it.purchaseDate || '-'}</span></div>
                                      <div>วันหมดอายุ: <span className="font-medium text-slate-900">{it.expiryDate || '-'}</span></div>
                                      <div>จำนวนวันคงเหลือ: <span className="font-medium text-slate-900">{Math.max(0, it.daysLeft ?? 0)} วัน</span></div>
                                      <div>รุ่น: <span className="font-medium text-slate-900">{it.model || '-'}</span></div>
                                    </div>
                                    {/* ✅ ปุ่มดูเงื่อนไขการรับประกัน */}
                                    {(Array.isArray(it.selectedConditions) && it.selectedConditions.length > 0) || it.customCondition ? (
                                      <button
                                        type="button"
                                        onClick={() => setConditionsModal({
                                          open: true,
                                          conditions: it.selectedConditions || [],
                                          custom: it.customCondition || ''
                                        })}
                                        className="rounded-xl border border-sky-400 bg-sky-500 px-4 py-2.5 text-sm text-white font-medium shadow-sm hover:bg-sky-600 hover:-translate-y-0.5 transition flex items-center gap-2"
                                      >
                                        <span>📋</span>
                                        <span>ดูเงื่อนไข ({(it.selectedConditions?.length || 0) + (it.customCondition ? 1 : 0)})</span>
                                      </button>
                                    ) : (
                                      <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-400">- ไม่มีเงื่อนไข -</p>
                                    )}

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
                                      onClick={() => openWarrantyModal('edit', { ...it, _headerId: header.id, _headerEmail: header.customerEmail, _headerAddress: header.customerAddress })} // ✅ ส่งข้อมูลใบมาด้วย
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
                        className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${currentPage === 1
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
                          className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${n === currentPage ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-black/10 hover:-translate-y-0.5 hover:bg-slate-50 transition'
                            }`}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${currentPage === totalPages
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
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-4 sm:py-6">
            {/* Constrain modal height to viewport and allow internal vertical scrolling; hide horizontal overflow */}
            <div className="w-full max-w-full sm:max-w-lg mx-auto rounded-3xl border border-sky-200 bg-white shadow-2xl max-h-[94vh] overflow-x-hidden overflow-y-auto box-border">
              <div className="sticky top-0 z-30 flex items-center justify-between border-b border-sky-100 px-6 py-4 bg-white">
                <div className="flex items-center gap-3">
                  {profileAvatarSrc ? (
                    <img src={profileAvatarSrc} alt="Store profile" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-sky-200 text-2xl">🏪</div>
                  )}
                  <div>
                    <div className="text-base font-semibold text-gray-900">แก้ไขข้อมูลร้านค้า</div>
                    <div className="text-xs text-sky-600">ข้อมูลจะใช้แสดงในใบรับประกัน</div>
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

              <div className="px-4 sm:px-6 pt-2 overflow-y-auto pb-6" style={{ maxHeight: 'calc(94vh - 160px)' }}>
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
                  <form id="profileForm" onSubmit={handleProfileSubmit} className="px-6 pb-6">
                    <input ref={profileImageInputRef} accept="image/*" className="sr-only" onChange={handleProfileAvatarSelect} type="file" />
                    {/* hidden combined fields for compatibility with signup-style submission */}
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

                    {modalError && profileTab === 'info' && (
                      <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{modalError}</div>
                    )}
                    <div className="grid gap-3 max-w-2xl mx-auto">
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
                                    )) : TH_PROVINCES.map((pv) => (
                                      <option key={pv} value={pv}>{pv}</option>
                                    ))}
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
                              value={storeProfile[key] ?? ''}
                              onChange={(e) => setStoreProfile((prev) => ({ ...prev, [key]: e.target.value }))}
                              readOnly={key === 'email'}
                              className={`mt-1 w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none ${key === 'email' ? 'bg-slate-200 border-slate-300' : 'bg-sky-50/60'}`}
                              type="text"
                            />
                          ) : (
                            <div className="flex justify-center">
                              <div className="mt-2 rounded-lg border border-sky-100 bg-white p-2 mx-auto max-w-sm w-full">
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
                                <div className="grid grid-cols-1 gap-2">
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

                              </div>
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                    {/* button moved to sticky footer */}
                  </form>
                ) : (
                  <form id="passwordForm" onSubmit={handlePasswordSubmit} className="px-6 pb-6">
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
                    {/* button moved to sticky footer */}
                  </form>
                )}
              </div>

              {/* Sticky footer always visible with submit button for the active tab */}
              <div className="border-t border-slate-100 px-6 py-3 bg-white sticky bottom-0 z-40">
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

        {isWarrantyModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            style={{ padding: '1rem', paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
          >
            <div className="w-full max-w-lg sm:max-w-2xl rounded-2xl sm:rounded-3xl bg-white shadow-2xl mx-auto overflow-hidden" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
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

              <form className="flex flex-col h-full" onSubmit={handleWarrantySubmit}>
                <div className="overflow-y-auto overflow-x-hidden px-5 sm:px-6 pt-5 pb-3 flex-1" style={{ maxHeight: '72vh' }}>
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
                        อีเมลลูกค้า <span className="text-red-500">*</span>
                        <div className="mt-1 w-full rounded-2xl border border-gray-200 bg-gray-100 px-4 py-2 text-sm text-gray-600">
                          {editHeaderEmail || '-'}
                        </div>
                      </label>

                      {/* ✅ ที่อยู่ลูกค้า (ระดับใบ) – ใช้ selector แบบเดียวกับหน้าสร้างใบรับประกัน */}
                      <div className="mt-3">
                        <div className="text-sm text-gray-600">ที่อยู่ลูกค้า</div>

                        <div className="mt-1 rounded-2xl border border-sky-100 bg-white p-4">
                          <div className="text-xs text-gray-500">เลขที่ / ซอย / ถนน</div>
                          <textarea
                            value={editCustomerAddressParts.street}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[@#$%^&*?|><]/g, '')
                              setEditCustomerAddressParts((p) => ({ ...p, street: v }))
                              setEditHeaderAddress((prev) => prev) // keep raw; will rebuild on submit
                            }}
                            className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                            placeholder="เช่น 123/4 ซ.สุขุมวิท 11"
                            rows={2}
                          />

                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div>
                              <div className="text-xs text-gray-500">จังหวัด</div>
                              <select
                                value={editCustomerAddressParts.province}
                                onChange={async (e) => {
                                  const code = e.target.value
                                  setEditCustomerAddressParts((p) => ({ ...p, province: code, district: '', subdistrict: '', postcode: '' }))
                                  try {
                                    await loadCustomerDistrictsForProvince(code)
                                    if (code) {
                                      if (districtsMap) {
                                        const list = (districtsMap[String(code)] || []).map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code }))
                                        setEditCustomerDistrictOptions(list.sort((a, b) => a.name.localeCompare(b.name, 'th')))
                                      } else {
                                        setEditCustomerDistrictOptions(customerDistrictOptions)
                                      }
                                    } else {
                                      setEditCustomerDistrictOptions([])
                                    }
                                    setEditCustomerSubdistrictOptions([])
                                  } catch {
                                    setEditCustomerDistrictOptions([])
                                    setEditCustomerSubdistrictOptions([])
                                  }
                                }}
                                className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                              >
                                <option value="">เลือกจังหวัด</option>
                                {provincesList.length > 0
                                  ? provincesList.map((p) => (
                                    <option key={p.code} value={p.code}>
                                      {p.name}
                                    </option>
                                  ))
                                  : TH_PROVINCES.map((pv) => (
                                    <option key={pv} value={pv}>
                                      {pv}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div>
                              <div className="text-xs text-gray-500">อำเภอ/เขต</div>
                              <select
                                value={editCustomerAddressParts.district}
                                onChange={async (e) => {
                                  const code = e.target.value
                                  setEditCustomerAddressParts((p) => ({ ...p, district: code, subdistrict: '', postcode: '' }))
                                  try {
                                    await loadCustomerSubdistrictsForDistrict(code)
                                    if (code) {
                                      if (subdistrictsMap) {
                                        const list = (subdistrictsMap[String(code)] || []).map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip }))
                                        setEditCustomerSubdistrictOptions(list.sort((a, b) => a.name.localeCompare(b.name, 'th')))
                                      } else {
                                        setEditCustomerSubdistrictOptions(customerSubdistrictOptions)
                                      }
                                    } else {
                                      setEditCustomerSubdistrictOptions([])
                                    }
                                  } catch {
                                    setEditCustomerSubdistrictOptions([])
                                  }
                                }}
                                disabled={!editCustomerAddressParts.province}
                                className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none disabled:opacity-60"
                              >
                                <option value="">{editCustomerAddressParts.province ? 'เลือกอำเภอ/เขต' : 'เลือกจังหวัดก่อน'}</option>
                                {editCustomerDistrictOptions.map((d) => (
                                  <option key={d.code} value={d.code}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <div className="text-xs text-gray-500">ตำบล/แขวง</div>
                              <select
                                value={editCustomerAddressParts.subdistrict}
                                onChange={(e) => {
                                  const code = e.target.value
                                  const found = editCustomerSubdistrictOptions.find((s) => String(s.code) === String(code))
                                  setEditCustomerAddressParts((p) => ({ ...p, subdistrict: code, postcode: found?.zipcode || '' }))
                                }}
                                disabled={!editCustomerAddressParts.district}
                                className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none disabled:opacity-60"
                              >
                                <option value="">{editCustomerAddressParts.district ? 'เลือกตำบล/แขวง' : 'เลือกอำเภอก่อน'}</option>
                                {editCustomerSubdistrictOptions.map((s) => (
                                  <option key={s.code} value={s.code}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div>
                              <div className="text-xs text-gray-500">รหัสไปรษณีย์</div>
                              <input
                                value={editCustomerAddressParts.postcode}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^0-9]/g, '')
                                  setEditCustomerAddressParts((p) => ({ ...p, postcode: v }))
                                }}
                                maxLength={5}
                                className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                placeholder="เช่น 10110"
                                type="text"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="flex items-end text-xs text-gray-400">
                              ตัวอย่าง: เลขที่/ซอย/ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ฟอร์มแก้ไขแบบ controlled + auto-expiry */}
                      <label className="mt-3 text-sm text-gray-600">
                        ชื่อสินค้าที่ทำการซ่อม <span className="text-red-500">*</span>
                        <input
                          name="product_name"
                          value={editForm?.product_name ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, product_name: e.target.value.replace(/[@#$%^&*?|><]/g, '') }))}
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
                          onChange={e => setEditForm(f => ({ ...f, model: e.target.value.replace(/[@#$%^&*?|><]/g, '') }))}
                          className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                          placeholder="กรอกรุ่นสินค้าที่ทำการซ่อม"
                          type="text"
                        />
                      </label>

                      {/* ✅ ราคาสินค้า (บาท) ในโหมดแก้ไข */}
                      <label className="mt-3 text-sm text-gray-600">
                        ราคาสินค้า (บาท)
                        <input
                          name="price"
                          value={editForm?.price ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, price: e.target.value.replace(/[^0-9.]/g, '') }))}
                          className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                          placeholder="กรอกราคาสินค้า (ไม่บังคับ)"
                          type="text"
                          inputMode="decimal"
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
                                  next.expiry_date = computeExpiry(next.purchase_date, { unit: 'months', value: 12 })
                                  return next
                                } else {
                                  const vNum = Number(v || 12)
                                  const next = { ...f, duration_mode: 'preset', duration_months: vNum }
                                  next.expiry_date = computeExpiry(next.purchase_date, vNum)
                                  return next
                                }
                              })
                            }}
                            className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                          >
                            {[1, 3, 6, 12, 18, 24].map(month => (
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
                            placeholder="กรอก Serial No. (ไม่บังคับ)"
                            type="text"
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
                              onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '')
                                setEditForm(f => {
                                  const next = { ...f, custom_value: val }
                                  next.expiry_date = computeExpiry(next.purchase_date, {
                                    unit: f.custom_unit || 'months',
                                    value: Number(val || 0),
                                  })
                                  return next
                                })
                              }}
                              className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                              placeholder="เช่น 45"
                              type="text"
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
                                  onChange={() => {
                                    setEditForm(f => {
                                      const next = { ...f, custom_unit: 'days' }
                                      if (f.purchase_date && f.custom_value) {
                                        next.expiry_date = computeExpiry(f.purchase_date, { unit: 'days', value: Number(f.custom_value) })
                                      }
                                      return next
                                    })
                                  }}
                                />
                                วัน
                              </label>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="unit-edit"
                                  checked={editForm?.custom_unit === 'months'}
                                  onChange={() => {
                                    setEditForm(f => {
                                      const next = { ...f, custom_unit: 'months' }
                                      if (f.purchase_date && f.custom_value) {
                                        next.expiry_date = computeExpiry(f.purchase_date, { unit: 'months', value: Number(f.custom_value) })
                                      }
                                      return next
                                    })
                                  }}
                                />
                                เดือน
                              </label>
                            </div>
                          </label>
                        </div>
                      )}

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="text-sm text-gray-600">
                          วันเริ่มการรับประกัน <span className="text-red-500">*</span>
                          <input
                            name="purchase_date"
                            value={editForm?.purchase_date ?? ''}
                            onChange={e => {
                              const v = e.target.value
                              setEditForm(f => {
                                const next = { ...f, purchase_date: v }
                                // Auto-calculate expiry based on duration
                                if (next.duration_mode === 'custom' && next.custom_value) {
                                  next.expiry_date = computeExpiry(v, { unit: next.custom_unit || 'months', value: Number(next.custom_value || 0) })
                                } else {
                                  next.expiry_date = computeExpiry(v, next.duration_months || 12)
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
                          <div className="mt-1 w-full rounded-2xl border border-gray-200 bg-gray-100 px-4 py-2 text-sm text-gray-600">
                            {editForm?.expiry_date ? new Date(editForm.expiry_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                            <div className="text-xs text-blue-600 mt-1"></div>
                          </div>
                        </label>
                      </div>

                      {/* ✅ เงื่อนไขการรับประกัน - แบบ Checkbox + เลือกทั้งหมด + ปุ่มเพิ่ม */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm text-gray-600">เงื่อนไขการรับประกัน <span className="text-red-500">*</span></div>
                          {(() => {
                            const conditionsData = getConditionsForStoreType(storeProfile.storeType)
                            const allConds = [...conditionsData.conditions, ...((editForm?.selectedConditions || []).filter(c => !conditionsData.conditions.includes(c)))]
                            const allSelected = allConds.length > 0 && allConds.every(c => (editForm?.selectedConditions || []).includes(c))
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditForm(f => ({ ...f, selectedConditions: allSelected ? [] : [...allConds] }))
                                }}
                                className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 transition"
                              >
                                {allSelected ? '☐ ยกเลิกทั้งหมด' : '☑ เลือกทั้งหมด'}
                              </button>
                            )
                          })()}
                        </div>
                        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3 max-h-60 overflow-y-auto">
                          {(() => {
                            const conditionsData = getConditionsForStoreType(storeProfile.storeType)
                            // รวมเงื่อนไขเทมเพลต + เงื่อนไขที่ user เพิ่มเอง
                            const customAdded = (editForm?.selectedConditions || []).filter(c => !conditionsData.conditions.includes(c))
                            const allConds = [...conditionsData.conditions, ...customAdded]
                            return (
                              <>
                                <div className="text-xs text-gray-500 mb-2">ประเภท: {conditionsData.label}</div>
                                {allConds.map((cond, i) => (
                                  <label key={i} className="flex items-start gap-2 py-1.5 border-b border-sky-100 last:border-0 cursor-pointer hover:bg-sky-100/50 rounded px-1">
                                    <input
                                      type="checkbox"
                                      checked={(editForm?.selectedConditions || []).includes(cond)}
                                      onChange={e => {
                                        const selected = editForm?.selectedConditions || []
                                        if (e.target.checked) {
                                          setEditForm(f => ({ ...f, selectedConditions: [...selected, cond] }))
                                        } else {
                                          setEditForm(f => ({ ...f, selectedConditions: selected.filter(c => c !== cond) }))
                                        }
                                      }}
                                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 shrink-0"
                                    />
                                    <span className="text-sm text-gray-700 flex-1">{cond}</span>
                                    {/* ปุ่มลบเฉพาะเงื่อนไขที่เพิ่มเอง */}
                                    {i >= conditionsData.conditions.length && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const selected = (editForm?.selectedConditions || []).filter(c => c !== cond)
                                          setEditForm(f => ({ ...f, selectedConditions: selected }))
                                        }}
                                        className="text-rose-400 hover:text-rose-600 text-lg leading-none shrink-0 ml-1"
                                        title="ลบเงื่อนไขนี้"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </label>
                                ))}
                              </>
                            )
                          })()}
                          {/* ปุ่ม "+" เพิ่มเงื่อนไขใหม่ */}
                          {editAddConditionOpen ? (
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="text"
                                value={editAddConditionText}
                                onChange={e => setEditAddConditionText(e.target.value.replace(/[@#$%^&*?|><]/g, ''))}
                                className="flex-1 rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
                                placeholder="พิมพ์เงื่อนไขใหม่..."
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && editAddConditionText.trim()) {
                                    e.preventDefault()
                                    const newCond = editAddConditionText.trim()
                                    const selected = editForm?.selectedConditions || []
                                    if (!selected.includes(newCond)) {
                                      setEditForm(f => ({ ...f, selectedConditions: [...selected, newCond] }))
                                    }
                                    setEditAddConditionText('')
                                    setEditAddConditionOpen(false)
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (editAddConditionText.trim()) {
                                    const newCond = editAddConditionText.trim()
                                    const selected = editForm?.selectedConditions || []
                                    if (!selected.includes(newCond)) {
                                      setEditForm(f => ({ ...f, selectedConditions: [...selected, newCond] }))
                                    }
                                  }
                                  setEditAddConditionText('')
                                  setEditAddConditionOpen(false)
                                }}
                                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
                              >
                                เพิ่ม
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditAddConditionText(''); setEditAddConditionOpen(false) }}
                                className="text-gray-400 hover:text-gray-600 text-lg"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditAddConditionOpen(true)}
                              className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 hover:border-sky-400 transition"
                            >
                              <span className="text-base leading-none">＋</span> เพิ่มเงื่อนไขใหม่
                            </button>
                          )}
                        </div>
                      </div>

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
                            อีเมลลูกค้า <span className="text-red-500">*</span>
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

                          {idx === 0 && (
                            <div className="mt-3">
                              <div className="text-sm text-gray-600">ที่อยู่ลูกค้า</div>

                              <div className="mt-1 rounded-2xl border border-sky-100 bg-white p-4">
                                <div className="text-xs text-gray-500">เลขที่ / ซอย / ถนน</div>
                                <textarea
                                  value={customerAddressParts.street}
                                  onChange={(e) => syncCustomerAddress((p) => ({ ...p, street: e.target.value.replace(/[@#$%^&*?|><]/g, '') }))}
                                  className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                  placeholder="เช่น 123/4 ซ.สุขุมวิท 11"
                                  rows={2}
                                />

                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                  <div>
                                    <div className="text-xs text-gray-500">จังหวัด</div>
                                    <select
                                      value={customerAddressParts.province}
                                      onChange={async (e) => {
                                        const code = e.target.value
                                        syncCustomerAddress((p) => ({ ...p, province: code, district: '', subdistrict: '', postcode: '' }))
                                        await loadCustomerDistrictsForProvince(code)
                                        setCustomerSubdistrictOptions([])
                                      }}
                                      className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                    >
                                      <option value="">เลือกจังหวัด</option>
                                      {provincesList.length > 0
                                        ? provincesList.map((p) => (
                                          <option key={p.code} value={p.code}>
                                            {p.name}
                                          </option>
                                        ))
                                        : TH_PROVINCES.map((pv) => (
                                          <option key={pv} value={pv}>
                                            {pv}
                                          </option>
                                        ))}
                                    </select>
                                  </div>

                                  <div>
                                    <div className="text-xs text-gray-500">อำเภอ/เขต</div>
                                    <select
                                      value={customerAddressParts.district}
                                      onChange={async (e) => {
                                        const code = e.target.value
                                        syncCustomerAddress((p) => ({ ...p, district: code, subdistrict: '', postcode: '' }))
                                        await loadCustomerSubdistrictsForDistrict(code)
                                      }}
                                      disabled={!customerAddressParts.province}
                                      className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none disabled:opacity-60"
                                    >
                                      <option value="">{customerAddressParts.province ? 'เลือกอำเภอ/เขต' : 'เลือกจังหวัดก่อน'}</option>
                                      {customerDistrictOptions.map((d) => (
                                        <option key={d.code} value={d.code}>
                                          {d.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <div className="text-xs text-gray-500">ตำบล/แขวง</div>
                                    <select
                                      value={customerAddressParts.subdistrict}
                                      onChange={(e) => {
                                        const code = e.target.value
                                        const found = customerSubdistrictOptions.find((s) => String(s.code) === String(code))
                                        syncCustomerAddress((p) => ({ ...p, subdistrict: code, postcode: found?.zipcode || '' }))
                                      }}
                                      disabled={!customerAddressParts.district}
                                      className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none disabled:opacity-60"
                                    >
                                      <option value="">{customerAddressParts.district ? 'เลือกตำบล/แขวง' : 'เลือกอำเภอก่อน'}</option>
                                      {customerSubdistrictOptions.map((s) => (
                                        <option key={s.code} value={s.code}>
                                          {s.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  <div>
                                    <div className="text-xs text-gray-500">รหัสไปรษณีย์</div>
                                    <input
                                      value={customerAddressParts.postcode}
                                      onChange={(e) => syncCustomerAddress((p) => ({ ...p, postcode: e.target.value.replace(/[^0-9]/g, '') }))}
                                      maxLength={5}
                                      className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                      placeholder="เช่น 10110"
                                      type="text"
                                      inputMode="numeric"
                                    />
                                  </div>
                                  <div className="flex items-end text-xs text-gray-400">
                                    ตัวอย่าง: เลขที่/ซอย/ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          <label className="mt-3 text-sm text-gray-600 block">
                            ชื่อสินค้าที่ทำการซ่อม <span className="text-red-500">*</span>
                            <input
                              value={it.product_name}
                              onChange={e => patchItem(idx, { product_name: e.target.value.replace(/[@#$%^&*?|><]/g, '') })}
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
                              onChange={e => patchItem(idx, { model: e.target.value.replace(/[@#$%^&*?|><]/g, '') })}
                              className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                              placeholder="กรอกรุ่นสินค้าที่ทำการซ่อม"
                              type="text"
                            />
                          </label>

                          {/* ✅ ราคาสินค้า (บาท) ต่อรายการ — ไม่แชร์กันทั้งใบ */}
                          <label className="mt-3 text-sm text-gray-600 block">
                            ราคาสินค้า (บาท)
                            <input
                              value={it.price}
                              onChange={e => patchItem(idx, { price: e.target.value.replace(/[^0-9.]/g, '') })}
                              className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                              placeholder="กรอกราคาสินค้า (ไม่บังคับ)"
                              type="text"
                              inputMode="decimal"
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
                                {[1, 3, 6, 12, 18, 24].map(month => (
                                  <option key={month} value={month}>{month} เดือน</option>
                                ))}
                                <option value="other">อื่นๆ (ระบุเอง)</option>
                              </select>
                            </label>

                            <label className="text-sm text-gray-600 block">
                              Serial No.
                              <input
                                value={it.serial}
                                onChange={e => patchItem(idx, { serial: e.target.value })}
                                className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                placeholder="กรอก Serial No. (ไม่บังคับ)"
                                type="text"
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
                                  onChange={e => patchItem(idx, { custom_value: e.target.value.replace(/[^0-9]/g, '') })}
                                  className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none"
                                  placeholder="เช่น 45"
                                  type="text"
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
                              วันที่เริ่มรับประกัน <span className="text-red-500">*</span>
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
                                readOnly
                                className="mt-1 w-full rounded-2xl border border-sky-100 bg-slate-50 px-4 py-2 text-sm text-gray-500 focus:outline-none cursor-default"
                                type="date"
                              />
                            </label>
                          </div>

                          {/* ✅ เงื่อนไขการรับประกัน - แบบ Checkbox + เลือกทั้งหมด + ปุ่มเพิ่ม */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm text-gray-600">เงื่อนไขการรับประกัน <span className="text-red-500">*</span></div>
                              {(() => {
                                const conditionsData = getConditionsForStoreType(storeProfile.storeType)
                                const customAdded = (it.selectedConditions || []).filter(c => !conditionsData.conditions.includes(c))
                                const allConds = [...conditionsData.conditions, ...customAdded]
                                const allSelected = allConds.length > 0 && allConds.every(c => (it.selectedConditions || []).includes(c))
                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      patchItem(idx, { selectedConditions: allSelected ? [] : [...allConds] })
                                    }}
                                    className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 transition"
                                  >
                                    {allSelected ? '☐ ยกเลิกทั้งหมด' : '☑ เลือกทั้งหมด'}
                                  </button>
                                )
                              })()}
                            </div>
                            <div className="rounded-2xl border border-sky-100 bg-white p-3 max-h-60 overflow-y-auto">
                              {(() => {
                                const conditionsData = getConditionsForStoreType(storeProfile.storeType)
                                const customAdded = (it.selectedConditions || []).filter(c => !conditionsData.conditions.includes(c))
                                const allConds = [...conditionsData.conditions, ...customAdded]
                                return (
                                  <>
                                    <div className="text-xs text-gray-500 mb-2">ประเภท: {conditionsData.label}</div>
                                    {allConds.map((cond, i) => (
                                      <label key={i} className="flex items-start gap-2 py-1.5 border-b border-sky-100 last:border-0 cursor-pointer hover:bg-sky-100/50 rounded px-1">
                                        <input
                                          type="checkbox"
                                          checked={(it.selectedConditions || []).includes(cond)}
                                          onChange={e => {
                                            const selected = it.selectedConditions || []
                                            if (e.target.checked) {
                                              patchItem(idx, { selectedConditions: [...selected, cond] })
                                            } else {
                                              patchItem(idx, { selectedConditions: selected.filter(c => c !== cond) })
                                            }
                                          }}
                                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 shrink-0"
                                        />
                                        <span className="text-sm text-gray-700 flex-1">{cond}</span>
                                        {i >= conditionsData.conditions.length && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const selected = (it.selectedConditions || []).filter(c => c !== cond)
                                              patchItem(idx, { selectedConditions: selected })
                                            }}
                                            className="text-rose-400 hover:text-rose-600 text-lg leading-none shrink-0 ml-1"
                                            title="ลบเงื่อนไขนี้"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </label>
                                    ))}
                                  </>
                                )
                              })()}
                              {/* ปุ่ม "+" เพิ่มเงื่อนไขใหม่ */}
                              {createAddConditionOpen[idx] ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={createAddConditionText[idx] || ''}
                                    onChange={e => setCreateAddConditionText(prev => ({ ...prev, [idx]: e.target.value.replace(/[@#$%^&*?|><]/g, '') }))}
                                    className="flex-1 rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
                                    placeholder="พิมพ์เงื่อนไขใหม่..."
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && (createAddConditionText[idx] || '').trim()) {
                                        e.preventDefault()
                                        const newCond = createAddConditionText[idx].trim()
                                        const selected = it.selectedConditions || []
                                        if (!selected.includes(newCond)) {
                                          patchItem(idx, { selectedConditions: [...selected, newCond] })
                                        }
                                        setCreateAddConditionText(prev => ({ ...prev, [idx]: '' }))
                                        setCreateAddConditionOpen(prev => ({ ...prev, [idx]: false }))
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const text = (createAddConditionText[idx] || '').trim()
                                      if (text) {
                                        const selected = it.selectedConditions || []
                                        if (!selected.includes(text)) {
                                          patchItem(idx, { selectedConditions: [...selected, text] })
                                        }
                                      }
                                      setCreateAddConditionText(prev => ({ ...prev, [idx]: '' }))
                                      setCreateAddConditionOpen(prev => ({ ...prev, [idx]: false }))
                                    }}
                                    className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
                                  >
                                    เพิ่ม
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCreateAddConditionText(prev => ({ ...prev, [idx]: '' }))
                                      setCreateAddConditionOpen(prev => ({ ...prev, [idx]: false }))
                                    }}
                                    className="text-gray-400 hover:text-gray-600 text-lg"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setCreateAddConditionOpen(prev => ({ ...prev, [idx]: true }))}
                                  className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 hover:border-sky-400 transition"
                                >
                                  <span className="text-base leading-none">＋</span> เพิ่มเงื่อนไขใหม่
                                </button>
                              )}
                            </div>
                          </div>

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

        {/* ✅ Modal แสดงเงื่อนไขการรับประกัน */}
        {conditionsModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between bg-sky-600 px-5 py-4">
                <div className="text-base font-semibold text-white">📋 เงื่อนไขการรับประกัน</div>
                <button
                  type="button"
                  onClick={() => setConditionsModal({ open: false, conditions: [], custom: '' })}
                  className="text-2xl text-white/80 hover:text-white"
                >
                  ×
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-5">
                {conditionsModal.conditions.length > 0 ? (
                  <ul className="space-y-2">
                    {conditionsModal.conditions.map((cond, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-sky-600">•</span>
                        <span>{cond}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">ไม่มีเงื่อนไขที่เลือก</p>
                )}

                {conditionsModal.custom && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="text-xs font-medium text-gray-500 mb-2">เงื่อนไขเพิ่มเติม:</div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{conditionsModal.custom}</p>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setConditionsModal({ open: false, conditions: [], custom: '' })}
                  className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-500 transition"
                >
                  ปิด
                </button>
              </div>
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