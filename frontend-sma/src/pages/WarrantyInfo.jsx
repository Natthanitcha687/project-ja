import { Link } from 'react-router-dom'

export default function WarrantyInfo() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-white text-slate-900">
      <section className="bg-gradient-to-r from-blue-50 via-white to-emerald-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">การรับประกันที่ชาญฉลาดสำหรับธุรกิจและลูกค้า</h1>
              <p className="mt-3 text-slate-700 text-sm md:text-base max-w-xl">
                เราช่วยบันทึกและจัดการใบรับประกันอย่างปลอดภัย — แยกประเภทอายุการรับประกัน แจ้งเตือนก่อนครบกำหนด และช่วยให้การเคลมเป็นเรื่องง่ายสำหรับทั้งร้านค้าและลูกค้า
              </p>

              <ul className="mt-6 grid gap-3 text-sm md:text-base">
                <li className="flex items-start gap-3">
                  <div className="rounded-full bg-emerald-600 text-white w-8 h-8 grid place-items-center font-semibold">✓</div>
                  <div>
                    <div className="font-semibold text-slate-800">เก็บข้อมูลใบรับประกันอย่างเป็นระบบ</div>
                    <div className="text-slate-600 mt-1">บันทึกข้อมูลสินค้า เลขซีเรียล กับวันที่ซื้อและวันหมดอายุที่เป็นมาตรฐาน</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="rounded-full bg-sky-600 text-white w-8 h-8 grid place-items-center font-semibold">⚡</div>
                  <div>
                    <div className="font-semibold text-slate-800">แจ้งเตือนอัตโนมัติก่อนหมดอายุ</div>
                    <div className="text-slate-600 mt-1">ระบบแจ้งเตือนทั้งร้านค้าและลูกค้า ลดความเสี่ยงของการพลาดการเคลมหรือการต่อประกัน</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="rounded-full bg-amber-500 text-white w-8 h-8 grid place-items-center font-semibold">🔎</div>
                  <div>
                    <div className="font-semibold text-slate-800">คัดกรองใบรับประกันตามอายุ</div>
                    <div className="text-slate-600 mt-1">ตัวกรองช่วยให้คุณดูใบรับประกันที่ใกล้หมดอายุหรือหมดอายุแล้วได้อย่างรวดเร็ว</div>
                  </div>
                </li>
              </ul>

              <div className="mt-8 flex gap-4">
                <Link to="/signup" className="rounded-xl bg-blue-600 px-4 py-2 text-white text-sm font-semibold hover:bg-blue-700">สมัครสมาชิก</Link>
                <Link to="/signin" className="rounded-xl border border-blue-600 px-4 py-2 text-blue-600 text-sm hover:bg-blue-50">เข้าสู่ระบบ</Link>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-slate-500">รวมใบรับประกันทั้งหมด</div>
                    <div className="text-3xl mt-1 font-extrabold text-slate-900">1,205</div>
                  </div>
                  <div className="text-xs text-slate-400">อัปเดตล่าสุดวันนี้</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-100 p-3 text-center bg-emerald-50">
                    <div className="text-sm text-slate-700">ใช้งานได้</div>
                    <div className="text-xl font-bold text-emerald-800 mt-2">950</div>
                  </div>
                  <div className="rounded-lg border border-slate-100 p-3 text-center bg-amber-50">
                    <div className="text-sm text-slate-700">ใกล้หมดอายุ</div>
                    <div className="text-xl font-bold text-amber-800 mt-2">170</div>
                  </div>
                  <div className="rounded-lg border border-slate-100 p-3 text-center bg-rose-50">
                    <div className="text-sm text-slate-700">หมดอายุ</div>
                    <div className="text-xl font-bold text-rose-800 mt-2">85</div>
                  </div>
                </div>

                <div className="mt-4 text-sm text-slate-500">เครื่องมือนี้ช่วยให้คุณค้นหาตาม serial, ช่วงวันที่, หรือกรองตามสถานะได้อย่างแม่นยำและรวดเร็ว</div>
              </div>

              <div className="mt-6 text-sm text-slate-500"> 
                <div className="rounded-lg p-4 border border-slate-100 bg-gradient-to-r from-white to-blue-50">
                  <div className="font-semibold text-slate-800">วิธีใช้งาน (สั้น ๆ)</div>
                  <ol className="mt-2 list-decimal pl-5 text-slate-600">
                    <li>ร้านค้าหรือผู้ใช้บันทึกใบรับประกันพร้อม serial และวันที่ซื้อ</li>
                    <li>ระบบประมวลผลและคัดกรองอายุใบรับประกันอัตโนมัติ</li>
                    <li>เมื่อใกล้หมดอายุ ระบบจะแจ้งเตือนและช่วยกระตุ้นการต่อประกันหรือเตรียมการเคลม</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h3 className="text-xl font-bold text-slate-900">เหตุผลที่ผู้ประกอบการเลือกเรา</h3>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-2xl font-semibold text-sky-700">ความปลอดภัย</div>
              <div className="mt-2 text-sm text-slate-600">ข้อมูลถูกเก็บในระบบอย่างปลอดภัยและสามารถเรียกดูย้อนหลังได้</div>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-2xl font-semibold text-emerald-700">การแจ้งเตือนอัจฉริยะ</div>
              <div className="mt-2 text-sm text-slate-600">แจ้งเตือนก่อนหมดอายุ และช่วยลดการสูญเสียสิทธิการเคลม</div>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-2xl font-semibold text-amber-700">เรียลไทม์</div>
              <div className="mt-2 text-sm text-slate-600">อัปเดตสถานะและประวัติการเคลมแบบเรียลไทม์</div>
            </div>
          </div>

          <div className="mt-8 text-sm text-slate-500">เราสร้างเครื่องมือเพื่อให้การจัดการการรับประกันเป็นเรื่องง่าย — ทั้งสำหรับธุรกิจและลูกค้า</div>
        </div>
      </section>
    </div>
  )
}
