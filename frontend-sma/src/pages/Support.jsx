import { useState } from 'react'
import { stripEmojis } from '../lib/text'

export default function Support() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const subject = encodeURIComponent(`Support request from ${name || email}`)
    const body = encodeURIComponent(`${message}\n\nName: ${name}\nEmail: ${email}`)
    // opens user's mail client with prefilled content
    window.location.href = `mailto:support@warranty.example?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900 py-12">
      <div className="mx-auto max-w-3xl px-6">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold">สนับสนุน</h1>
          <p className="text-slate-600 mt-2">หากต้องการความช่วยเหลือ โปรดกรอกแบบฟอร์มด้านล่างหรือติดต่อเราทางอีเมล</p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-lg p-6 shadow-sm">
          <div className="grid gap-4">
            <label className="flex flex-col">
              <span className="text-sm text-slate-600">ชื่อ</span>
              <input value={name} onChange={e => setName(stripEmojis(e.target.value))} className="mt-1 border rounded px-3 py-2" placeholder="ชื่อของคุณ" />
            </label>

            <label className="flex flex-col">
              <span className="text-sm text-slate-600">อีเมล</span>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="mt-1 border rounded px-3 py-2" placeholder="you@example.com" />
            </label>

            <label className="flex flex-col">
              <span className="text-sm text-slate-600">ข้อความ</span>
              <textarea value={message} onChange={e => setMessage(stripEmojis(e.target.value))} rows={6} className="mt-1 border rounded px-3 py-2" placeholder="บอกรายละเอียดปัญหาหรือคำถามของคุณ"></textarea>
            </label>

            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">หรือส่งอีเมลตรงไปที่ <a href="mailto:support@warranty.example" className="text-blue-600">support@warranty.example</a></div>
              <button type="submit" className="rounded-full bg-blue-600 px-4 py-2 text-white font-semibold">ส่งคำขอ</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
