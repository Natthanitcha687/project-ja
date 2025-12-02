import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <header className="grid gap-6 md:grid-cols-2 items-center">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-3 rounded-full bg-sky-100/60 px-3 py-1 text-xs font-semibold text-sky-700">แพลตฟอร์มการรับประกัน</div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">เพราะการจัดการการรับประกันควรเป็นเรื่องง่ายและไว้ใจได้</h1>
            <p className="text-slate-600 max-w-xl">เราออกแบบระบบที่ช่วยให้ร้านค้าและลูกค้าจัดเก็บใบรับประกันอย่างเป็นระบบ ดูแลอายุการรับประกัน และช่วยให้การเคลมเป็นเรื่องที่รวดเร็วและยุติธรรม</p>

            <div className="flex flex-wrap gap-3 mt-4">
              <Link to="/signup" className="rounded-full bg-blue-600 px-4 py-2 text-white text-sm font-semibold hover:bg-blue-700">เริ่มต้นใช้งาน</Link>
              <Link to="/warranty" className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">ดูการรับประกัน</Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 p-6 bg-white shadow-lg">
            <div className="text-sm text-slate-500">ฟีเจอร์สำคัญ</div>
            <div className="mt-4 grid gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-50 grid place-items-center text-emerald-700 font-bold">✓</div>
                <div>
                  <div className="font-semibold text-slate-800">จัดเก็บและค้นหาใบรับประกัน</div>
                  <div className="text-sm text-slate-500">บันทึก serial, วันที่ซื้อ และประวัติการเคลมได้ง่าย</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-sky-50 grid place-items-center text-sky-700 font-bold">🔔</div>
                <div>
                  <div className="font-semibold text-slate-800">แจ้งเตือนก่อนหมดอายุ</div>
                  <div className="text-sm text-slate-500">เตือนร้านค้าและลูกค้าให้เตรียมเคลมหรือขยายการรับประกันทันเวลา</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-50 grid place-items-center text-amber-700 font-bold">🔍</div>
                <div>
                  <div className="font-semibold text-slate-800">กรองตามสถานะและช่วงเวลา</div>
                  <div className="text-sm text-slate-500">ดูใบรับประกันที่ใกล้หมดหรือหมดอายุได้อย่างรวดเร็ว</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-10 grid gap-8 md:grid-cols-3">
          <div className="rounded-2xl bg-white border border-slate-100 p-6 shadow-sm">
            <div className="text-xs text-slate-400">ความน่าเชื่อถือ</div>
            <div className="text-2xl font-extrabold mt-2 text-slate-900">การเข้ารหัสและสำรองข้อมูล</div>
            <p className="text-sm mt-2 text-slate-600">ข้อมูลถูกเก็บอย่างปลอดภัย มีระบบสำรองและเข้าถึงได้เฉพาะผู้มีสิทธิ</p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 p-6 shadow-sm">
            <div className="text-xs text-slate-400">การเตือนอัจฉริยะ</div>
            <div className="text-2xl font-extrabold mt-2 text-slate-900">แจ้งเตือนที่ตั้งค่าได้</div>
            <p className="text-sm mt-2 text-slate-600">ตั้งค่าระยะเวลาแจ้งเตือนล่วงหน้า เพื่อให้ร้านค้าและลูกค้าพร้อมเสมอ</p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 p-6 shadow-sm">
            <div className="text-xs text-slate-400">บริการครบวงจร</div>
            <div className="text-2xl font-extrabold mt-2 text-slate-900">ระบบสำหรับธุรกิจทุกขนาด</div>
            <p className="text-sm mt-2 text-slate-600">ออกแบบมาเพื่อร้านค้าขนาดเล็กถึงองค์กรขนาดกลาง — ขยายได้ตามความต้องการ</p>
          </div>
        </section>

        <section className="mt-12 rounded-3xl bg-gradient-to-r from-slate-900 to-sky-700 text-white p-8 shadow-xl">
          <div className="grid md:grid-cols-3 gap-6 items-center">
            <div>
              <div className="text-sm uppercase opacity-80">ร่วมเป็นส่วนหนึ่ง</div>
              <div className="text-2xl font-extrabold mt-1">ให้เราเป็นผู้ช่วยจัดการการรับประกันของคุณ</div>
            </div>
            <div className="col-span-2 text-sm text-slate-100/90">
              เราพัฒนาฟีเจอร์ที่ช่วยให้การจัดการรับประกันไม่ใช่เรื่องยุ่งยากอีกต่อไป — ตั้งแต่การบันทึก, ตรวจสอบสถานะ, ไปจนถึงการช่วยติดตามการต่อประกันและการเคลม
            </div>
          </div>
        </section>

        <footer className="mt-12 text-center text-sm text-slate-500">© {new Date().getFullYear()} Warranty — ดูแลการรับประกันให้คุณอย่างมืออาชีพ</footer>
      </div>
    </div>
  )
}
