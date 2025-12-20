import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) setError('ไม่พบโทเคนรีเซ็ต โปรดเปิดลิงก์จากอีเมลอีกครั้ง')
  }, [token])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!token) return
    if (!password || password.length < 6) return setError('รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร')
    if (password !== confirm) return setError('รหัสผ่านและการยืนยันไม่ตรงกัน')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/reset', { token, password })
      setMessage(data?.message || 'ตั้งรหัสผ่านใหม่สำเร็จ')
      setTimeout(() => navigate('/signin'), 1200)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'ไม่สามารถตั้งรหัสผ่านใหม่ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-10 bg-[#fffaf8]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border p-6 shadow">
          <h2 className="text-lg font-semibold mb-2">ตั้งรหัสผ่านใหม่</h2>
          <p className="text-sm text-slate-600 mb-4">ตั้งรหัสผ่านใหม่โดยใช้ลิงก์ที่ได้รับทางอีเมล</p>

          {message ? (
            <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">{message}</div>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-md bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="text-sm text-gray-700">รหัสผ่านใหม่</span>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="อย่างน้อย 6 ตัวอักษร" />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">ยืนยันรหัสผ่าน</span>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="ยืนยันรหัสผ่าน" />
            </label>

            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="flex-1 rounded-xl bg-green-600 text-white py-2 font-medium">{loading ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}</button>
              <Link to="/signin" className="inline-flex items-center justify-center rounded-xl border px-4">ยกเลิก</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
