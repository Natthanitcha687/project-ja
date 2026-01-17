import React, { useEffect, useState, useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import DashboardHeader from '../components/DashboardHeader'
import { api, API_URL, getToken } from '../lib/api'

export default function DashboardLayout() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    const token = getToken()
    if (!token) return []
    setNotifLoading(true)
    try {
      const res = await api.get('/notifications')
      const data = res?.data?.data || res?.data || []
      const arr = Array.isArray(data) ? data : []
      arr.sort((a,b)=> new Date(b.createdAt || b.time || b.created_at || 0) - new Date(a.createdAt || a.time || a.created_at || 0))
      setNotifications(arr)
      return arr
    } catch (e) {
      setNotifications([])
      return []
    } finally {
      setNotifLoading(false)
    }
  }, [])

  // SSE
  useEffect(() => {
    const token = getToken()
    if (!token) return
    const base = String(API_URL || '').replace(/\/+$/, '')
    const es = new EventSource(`${base}/notifications/stream?token=${token}`)
    es.addEventListener('notification', (ev) => {
      try { const payload = JSON.parse(ev.data); setNotifications((p)=>[payload, ...(p||[])]); } catch (e) {}
    })
    es.onerror = () => {}
    return () => es.close()
  }, [])

  useEffect(() => { fetchNotifications().catch(()=>{}) }, [fetchNotifications])

  async function markAllAsRead() {
    setNotifications((prev) => (prev || []).map((n) => ({ ...n, read: true })))
    try { setNotifLoading(true); await api.post('/notifications/mark-all-read') } catch (e) {} finally { setNotifLoading(false) }
  }

  const onEditProfile = () => navigate(`/dashboard/warranty?openProfile=1&_o=${Date.now()}`)

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-sky-100/60 pb-12">
      <DashboardHeader
        title="Warranty"
        subtitle="จัดการการรับประกันของคุณได้ในที่เดียว"
        notifications={notifications}
        onFetchNotifications={fetchNotifications}
        notificationsLoading={notifLoading}
        onMarkAllRead={markAllAsRead}
        onEditProfile={onEditProfile}
      />
      <main><Outlet /></main>
    </div>
  )
}
