// src/pages/StoreDashboard.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import DashboardHeader from '../components/DashboardHeader'
import StoreTabs from '../components/StoreTabs'
import SimpleDonut from '../components/SimpleDonut'
import LineChart from '../components/LineChart'

export default function StoreDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const storeIdResolved = useMemo(() => {
    if (!user) return null
    return Number(user.sub ?? user.id ?? null)
  }, [user])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
  const [warranties, setWarranties] = useState([])
  const [notifications, setNotifications] = useState([])

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

  const fetchNotifications = useCallback(async () => {
    if (!storeIdResolved) return []
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
    }
  }, [storeIdResolved])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const totals = useMemo(() => {
    const totalHeaders = warranties.length
    let totalItems = 0
    let active = 0, nearing = 0, expired = 0
    for (const h of warranties || []) {
      const items = h.items || []
      totalItems += items.length
      for (const it of items) {
        const code = it.statusCode || (it.statusTag === 'ใกล้หมดอายุ' ? 'nearing_expiration' : it.statusTag === 'หมดอายุ' ? 'expired' : 'active')
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
      <DashboardHeader
        title="ร้านของฉัน"
        subtitle="แดชบอร์ดร้าน"
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

        
        </section>
      </main>
    </div>
  )
}
