import { Link } from 'react-router-dom'

export default function Docs() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900 py-12">
      <div className="mx-auto max-w-4xl px-6">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold">วิธีการใช้งาน</h1>
          <p className="text-slate-600 mt-2">รวมขั้นตอนพื้นฐานและแนวปฏิบัติที่ช่วยให้การใช้งานระบบเป็นไปอย่างราบรื่น</p>
        </header>

        <section className="space-y-6">
          <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
            <h2 className="font-semibold text-xl">1. ลงทะเบียนและสร้างร้าน</h2>
            <p className="text-slate-600 mt-2">สมัครบัญชีผู้ใช้ แล้วไปที่หน้าจัดการร้านเพื่อเพิ่มข้อมูลร้านค้าและตั้งค่าพื้นฐาน</p>
          </article>

          <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
            <h2 className="font-semibold text-xl">2. บันทึกใบรับประกัน</h2>
            <p className="text-slate-600 mt-2">เพิ่มข้อมูลสินค้า เช่น serial number, วันที่ซื้อ, ระยะเวลารับประกัน และแนบรูปใบเสร็จเพื่อความครบถ้วน</p>
          </article>

          <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
            <h2 className="font-semibold text-xl">3. ค้นหาและจัดการการเคลม</h2>
            <p className="text-slate-600 mt-2">ใช้ฟิลเตอร์ค้นหาตามสถานะหรือช่วงเวลา เพื่อติดตามการเคลมและประวัติของลูกค้าได้ง่าย</p>
          </article>

          <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
            <h2 className="font-semibold text-xl">ทิปและคำแนะนำ</h2>
            <ul className="list-disc list-inside text-slate-600 mt-2">
              <li>ตั้งค่าการแจ้งเตือนก่อนวันหมดอายุ</li>
              <li>แนบภาพสินค้าและใบเสร็จเพื่อช่วยการยืนยันการเคลม</li>
              <li>สำรองข้อมูลสำคัญเป็นประจำ</li>
            </ul>
          </article>
        </section>

        <div className="mt-8 flex gap-3">
          <Link to="/signup" className="rounded-full bg-blue-600 px-4 py-2 text-white font-semibold">สมัครใช้งาน</Link>
          <Link to="/warranty" className="rounded-full border border-slate-200 px-4 py-2">ดูการรับประกัน</Link>
        </div>
      </div>
    </div>
  )
}
