// src/pages/VerifyEmail.jsx
import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import Card from '../components/Card'
import Button from '../components/Button'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react' // ใช้ไอคอนจาก lucide-react

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('loading') // 'loading' | 'ok' | 'fail'
  const [message, setMessage] = useState('กำลังยืนยันอีเมล...')
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const token = params.get('token')
    if (!token) {
      setStatus('fail')
      setMessage('ไม่พบโทเคน กรุณายืนยันจากลิงก์ในอีเมลอีกครั้ง')
      return
    }

    api
      .get('/auth/verify', { params: { token } })
      .then(() => {
        setStatus('ok')
        setMessage('ยืนยันอีเมลเรียบร้อยแล้ว ✅')
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.message || 'ยืนยันไม่สำเร็จ หรือลิงก์หมดอายุ'
        if (msg.includes('ถูกใช้แล้ว') || msg.toLowerCase().includes('used')) {
          setStatus('ok')
          setMessage('บัญชีของคุณได้รับการยืนยันแล้ว ✅')
          return
        }
        setStatus('fail')
        setMessage(msg)
      })
  }, [params])

  const renderIcon = () => {
    if (status === 'loading')
      return <Loader2 className="w-12 h-12 text-sky-400 animate-spin" />
    if (status === 'ok')
      return <CheckCircle className="w-12 h-12 text-emerald-500" />
    if (status === 'fail')
      return <XCircle className="w-12 h-12 text-rose-500" />
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-sky-50 via-sky-100/60 to-white py-10">
      <Card className="w-full max-w-md text-center bg-white/80 backdrop-blur-md border border-sky-100 shadow-lg rounded-3xl p-8">
        <div className="flex flex-col items-center">
          {/* ไอคอนสถานะ */}
          <div className="mb-4">{renderIcon()}</div>

          {/* หัวข้อ */}
          <h1 className="text-2xl font-bold text-sky-700 mb-2">
            ยืนยันอีเมล (Verify Email)
          </h1>
          <p
            className={`text-base ${
              status === 'fail'
                ? 'text-rose-600'
                : status === 'ok'
                ? 'text-emerald-600'
                : 'text-sky-600'
            }`}
          >
            {message}
          </p>

          {/* ปุ่ม */}
          <div className="mt-8 flex gap-3 justify-center">
            <Link to="/signin">
              <Button className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl shadow-sm">
                ไปหน้าเข้าสู่ระบบ
              </Button>
            </Link>
            <Link to="/">
              <Button className="bg-amber-400 hover:bg-amber-500 text-white px-4 py-2 rounded-xl shadow-sm">
                กลับหน้าหลัก
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
