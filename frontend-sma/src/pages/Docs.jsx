import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Docs() {
  const [activeRole, setActiveRole] = useState('store') // 'store' | 'customer'

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900 py-12">
      <div className="mx-auto max-w-4xl px-6">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold">วิธีการใช้งาน</h1>
          <p className="text-slate-600 mt-2">รวมขั้นตอนพื้นฐานและแนวปฏิบัติที่ช่วยให้การใช้งานระบบเป็นไปอย่างราบรื่น</p>
          <div className="mt-6">
            <div className="inline-flex rounded-full bg-slate-100 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveRole('store')}
                className={`px-4 py-1.5 text-sm rounded-full font-medium transition ${
                  activeRole === 'store'
                    ? 'bg-white shadow-sm text-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                สำหรับร้านค้า
              </button>
              <button
                type="button"
                onClick={() => setActiveRole('customer')}
                className={`px-4 py-1.5 text-sm rounded-full font-medium transition ${
                  activeRole === 'customer'
                    ? 'bg-white shadow-sm text-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                สำหรับลูกค้า
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              เลือกฝั่งที่คุณใช้งาน เพื่อดูขั้นตอนและคำแนะนำที่ออกแบบมาสำหรับบทบาทนั้นโดยเฉพาะ
            </p>
          </div>
        </header>

        <section className="space-y-10">
          {/* ฝั่งร้านค้า */}
          <div className={activeRole === 'store' ? '' : 'hidden'}>
            <h2 className="text-2xl font-bold">วิธีการใช้งานสำหรับร้านค้า</h2>
            <div className="h-1 w-20 rounded-full bg-blue-500/80 mt-2 mb-4" />
            <p className="text-slate-600 mb-5 text-sm">
              เหมาะกับร้านค้าที่ต้องการจัดการใบรับประกันสินค้าของลูกค้าในรูปแบบดิจิทัล ลดงานเอกสาร และติดตามสถานะการเคลมได้ง่าย
            </p>
            <div className="space-y-4">
              <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold shadow-inner">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">ลงทะเบียนและตั้งค่าร้านค้า</h3>
                    <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                      สมัครบัญชีผู้ใช้แบบร้านค้า จากนั้นเข้าไปที่หน้าตั้งค่าร้านเพื่อกรอกชื่อร้าน โลโก้ ข้อมูลติดต่อ และผู้ดูแลหลักของร้านให้ครบถ้วน
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold shadow-inner">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">บันทึกใบรับประกันสินค้า</h3>
                    <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                      ไปที่หน้าจัดการใบรับประกัน แล้วสร้างใบรับประกันใหม่ โดยใช้อีเมลของลูกค้าที่ได้สมัครใช้งานระบบแล้ว จากนั้นกรอกรายละเอียดสินค้า
                      (รุ่น Serial วันที่ซื้อ ระยะเวลารับประกัน) และแนบรูปใบเสร็จหรือหลักฐานการซื้อให้ครบถ้วนตามฟอร์มที่กำหนด ใบรับประกันฉบับเดียวกันจะถูกเก็บไว้ทั้งฝั่งร้านค้าและฝั่งลูกค้า
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold shadow-inner">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">ส่งใบรับประกันให้ลูกค้า</h3>
                    <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                      เมื่อบันทึกใบรับประกันแล้ว ระบบจะสร้างใบรับประกันดิจิทัลให้ลูกค้าอัตโนมัติ และส่งการแจ้งเตือนไปยังอีเมลที่ลูกค้าใช้สมัคร
                      ลูกค้าสามารถเปิดดูจากลิงก์ในอีเมล และเมื่อเข้าสู่ระบบด้วยอีเมลเดียวกัน จะสามารถดูจากหน้า "ใบรับประกันของฉัน" และในศูนย์การแจ้งเตือนของระบบได้ทันที
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold shadow-inner">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">ติดตามวันหมดอายุและการเคลม</h3>
                    <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                      ใช้ฟิลเตอร์ค้นหาตามสถานะ (ใช้งานได้ ใกล้หมดอายุ หมดอายุ) ตรวจสอบประวัติการเคลม การแก้ไขข้อมูล และสร้างไฟล์ PDF ใบรับประกันให้ลูกค้าได้จากแดชบอร์ดร้านค้า
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center text-lg shadow-inner">
                    ★
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">ทิปสำหรับร้านค้า</h3>
                    <ul className="list-disc list-inside text-slate-600 mt-2 text-sm space-y-1">
                      <li>ตั้งค่าการแจ้งเตือนวันหมดอายุ เพื่อไม่พลาดการติดต่อดูแลลูกค้า</li>
                      <li>กรอกที่อยู่และเบอร์ติดต่อของลูกค้าให้ครบ เพื่อความสะดวกเวลาติดตามเคลม</li>
                      <li>แนบรูปสินค้าและใบเสร็จทุกครั้ง ลดปัญหาการยืนยันสิทธิ์รับประกัน และช่วยให้การซ่อมเป็นไปได้รวดเร็วขึ้น</li>
                      <li>ใบรับประกันในระบบนี้ออกแบบมาเพื่อรองรับการซ่อมสินค้าเป็นหลัก ควรอธิบายเงื่อนไขให้ลูกค้าเข้าใจก่อนใช้งาน</li>
                    </ul>
                  </div>
                </div>
              </article>
            </div>
          </div>

          {/* ฝั่งลูกค้า */}
          <div className={activeRole === 'customer' ? '' : 'hidden'}>
            <h2 className="text-2xl font-bold">วิธีการใช้งานสำหรับลูกค้า</h2>
            <div className="h-1 w-20 rounded-full bg-blue-500/80 mt-2 mb-4" />
            <p className="text-slate-600 mb-5 text-sm">
              เหมาะกับลูกค้าที่ต้องการเก็บใบรับประกันสินค้าไว้ในที่เดียว เปิดดูง่าย และไม่ต้องเก็บกระดาษอีกต่อไป
            </p>
            <div className="space-y-4">
              <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold shadow-inner">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">สมัครบัญชีลูกค้าก่อนรับใบรับประกัน</h3>
                    <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                      ก่อนที่ร้านค้าจะออกใบรับประกันให้ ลูกค้าจำเป็นต้องสมัครบัญชีด้วยอีเมลของตนเองก่อน เพื่อให้ระบบสามารถผูกใบรับประกันเข้ากับบัญชีของคุณได้อย่างถูกต้อง
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold shadow-inner">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">รับใบรับประกันจากร้านค้า</h3>
                    <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                      เมื่อร้านค้าบันทึกใบรับประกันโดยใช้อีเมลเดียวกับที่คุณสมัคร ระบบจะสร้างใบรับประกันดิจิทัลและผูกเข้ากับบัญชีของคุณโดยอัตโนมัติ
                      ใบเดียวกันนี้จะถูกเก็บไว้ทั้งฝั่งร้านค้าและฝั่งลูกค้า สามารถดูประวัติทั้งหมดได้ในหน้า "ใบรับประกันของฉัน"
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold shadow-inner">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">ตรวจสอบสถานะและเงื่อนไขการรับประกัน</h3>
                    <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                      เปิดดูใบรับประกันเพื่อเช็กวันเริ่มต้น–วันหมดอายุ เงื่อนไขการรับประกัน หมายเหตุเพิ่มเติม และรูปถ่ายสินค้าได้ตลอดเวลา ทั้งจากมือถือและคอมพิวเตอร์
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold shadow-inner">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">ใช้แจ้งปัญหาและเคลมสินค้า</h3>
                    <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                      เมื่อมีปัญหากับสินค้า สามารถใช้เมนู "แจ้งปัญหา" บนใบรับประกัน เพื่อส่งรายละเอียดพร้อมรูปภาพและอ้างอิงใบรับประกันถึงร้านค้าได้ทันที ช่วยให้การเคลมเป็นระบบและตรวจสอบย้อนหลังได้ง่าย
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-xl bg-white p-6 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center text-lg shadow-inner">
                    ★
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">ทิปสำหรับลูกค้า</h3>
                    <ul className="list-disc list-inside text-slate-600 mt-2 text-sm space-y-1">
                      <li>เปิดการแจ้งเตือนอีเมลหรือในระบบ เพื่อไม่พลาดการแจ้งเตือนวันใกล้หมดประกัน</li>
                      <li>อัปเดตข้อมูลติดต่อของคุณให้เป็นปัจจุบัน เพื่อให้ร้านค้าติดต่อกลับได้สะดวก</li>
                      <li>เก็บใบเสร็จสำรองในรูปภาพหรือไฟล์ เผื่อใช้ประกอบการเคลมเพิ่มเติม</li>
                      <li>ใบรับประกันในระบบนี้ใช้สำหรับสิทธิ์การซ่อมสินค้าเป็นหลัก หากมีเงื่อนไขพิเศษอื่น ๆ ให้สอบถามร้านค้าเพิ่มเติม</li>
                    </ul>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
