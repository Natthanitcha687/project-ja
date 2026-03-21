import React from "react";

export default function Notifications() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900 py-12">
      <div className="mx-auto max-w-2xl px-6">
        <header className="mb-10 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 rounded-full p-4 shadow-inner">
              <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-blue-500">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold mb-2">ระบบแจ้งเตือนอัจฉริยะ</h1>
          <p className="text-slate-600 text-lg max-w-xl mx-auto">
            ไม่พลาดทุกข้อมูลสำคัญ! ระบบของเรามีการแจ้งเตือนทั้งในเว็บไซต์และอีเมล<br />
            ช่วยให้คุณติดตามวันหมดอายุใบรับประกัน สถานะการเคลม และข่าวสารจากร้านค้าได้อย่างสะดวก
          </p>
        </header>

        <section className="space-y-8">
          <div className="rounded-2xl bg-white p-6 border border-blue-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="bg-blue-50 rounded-full p-3 mb-2 flex items-center justify-center">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-blue-500">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="font-bold text-xl mb-1 text-blue-700">แจ้งเตือนในเว็บไซต์</h2>
              <p className="text-slate-700 text-sm">
                ทุกครั้งที่มีเหตุการณ์สำคัญ เช่น ใบรับประกันใกล้หมดอายุ การเคลมสินค้า หรือข่าวสารจากร้านค้า<br />
                คุณจะได้รับการแจ้งเตือนทันทีผ่านศูนย์แจ้งเตือนในระบบ<br />
                <span className="text-blue-600 font-medium">ดูง่าย สะดวก ไม่พลาดทุกอัปเดต</span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 border border-blue-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="bg-blue-50 rounded-full p-3 mb-2 flex items-center justify-center">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-blue-500">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12v1m0 4h.01M21 12c0-4.97-4.03-9-9-9s-9 4.03-9 9c0 4.97 4.03 9 9 9s9-4.03 9-9zm-9 3v-2a2 2 0 10-4 0v2a2 2 0 104 0z" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="font-bold text-xl mb-1 text-blue-700">แจ้งเตือนทางอีเมล</h2>
              <p className="text-slate-700 text-sm">
                รับอีเมลแจ้งเตือนอัตโนมัติเมื่อถึงวันสำคัญ เช่น วันหมดอายุใบรับประกัน หรือมีการเปลี่ยนแปลงสถานะการเคลม
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-emerald-50 p-6 border border-blue-100 shadow flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="bg-emerald-100 rounded-full p-3 mb-2 flex items-center justify-center">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-emerald-500">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="font-bold text-xl mb-1 text-emerald-700">ปรับแต่งได้ตามใจ</h2>
              <p className="text-slate-700 text-sm">
                ตั้งค่าระยะเวลาการแจ้งเตือนล่วงหน้าได้เอง<br />
                เพื่อให้เหมาะกับไลฟ์สไตล์และความต้องการของคุณมากที่สุด
              </p>
            </div>
          </div>
        </section>

        <div className="mt-12 text-center text-slate-500 text-xs">
          ระบบแจ้งเตือนนี้ออกแบบมาเพื่อให้คุณไม่พลาดทุกโอกาสสำคัญในการดูแลสินค้าและบริการของคุณ
        </div>
      </div>
    </div>
  );
}
