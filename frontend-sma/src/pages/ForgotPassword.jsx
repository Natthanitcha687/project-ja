import { useState } from 'react'
import { api } from '../lib/api'
import { Link } from 'react-router-dom'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const { data } = await api.post('/auth/forgot', { email })
      setMessage(data?.message || 'ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว')
      // show preview link in dev
      if (data?.resetUrl) setMessage((m) => m + '\n' + `Preview: ${data.resetUrl}`)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'ไม่สามารถส่งอีเมลได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-10 bg-[#f6fbff]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border p-6 shadow">
          <h2 className="text-lg font-semibold mb-2">ขอรีเซ็ตรหัสผ่าน</h2>
          <p className="text-sm text-slate-600 mb-4">ใส่อีเมลที่ลงทะเบียน ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่</p>

          {message ? (
            <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700 whitespace-pre-wrap">{message}</div>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-md bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="text-sm text-gray-700">อีเมล</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="อีเมลของคุณ" />
            </label>

            <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 text-white py-2 font-medium">
              {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ต'}
            </button>
          </form>

          <div className="mt-4 text-sm text-slate-600">กลับไปยัง <Link to="/signin" className="text-blue-600">เข้าสู่ระบบ</Link></div>
        </div>
      </div>
    </div>
  )
}
