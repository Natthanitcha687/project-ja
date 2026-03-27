import React from "react";

export default function Notifications() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900 py-12">
      <div className="mx-auto max-w-2xl px-6">
        <header className="mb-10 text-center">
          <div className="flex justify-center mb-4">
            {/* เปลี่ยนรูปภาพที่เสีย เป็น Emoji กระดิ่ง */}
            <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center shadow-inner">
              <span className="text-4xl">🔔</span>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold mb-2">ระบบแจ้งเตือนอัจฉริยะ ✨</h1>
          <p className="text-slate-600 text-lg max-w-xl mx-auto">
            ไม่พลาดทุกข้อมูลสำคัญ! ระบบของเรามีการแจ้งเตือนทั้งในเว็บไซต์และอีเมล 🌐<br />
            ช่วยให้คุณติดตามวันหมดอายุใบรับประกัน สถานะการเคลม และข่าวสารจากร้านค้าได้อย่างสะดวก
          </p>
        </header>

        <section className="space-y-8">
          {/* Card 1: แจ้งเตือนในเว็บไซต์ */}
          <div className="rounded-2xl bg-white p-6 border border-blue-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center mb-2">
                <span className="text-3xl">💻</span>
              </div>
            </div>
            <div>
              <h2 className="font-bold text-xl mb-1 text-blue-700">แจ้งเตือนในเว็บไซต์</h2>
              <p className="text-slate-700 text-sm">
                ทุกครั้งที่มีเหตุการณ์สำคัญ เช่น ใบรับประกันใกล้หมดอายุ การเคลมสินค้า หรือข่าวสารจากร้านค้า 📢<br />
                คุณจะได้รับการแจ้งเตือนทันทีผ่านศูนย์แจ้งเตือนในระบบ<br />
                <span className="text-blue-600 font-medium">✨ ดูง่าย สะดวก ไม่พลาดทุกอัปเดต</span>
              </p>
            </div>
          </div>

          {/* Card 2: แจ้งเตือนทางอีเมล */}
          <div className="rounded-2xl bg-white p-6 border border-blue-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center mb-2">
                <span className="text-3xl">📧</span>
              </div>
            </div>
            <div>
              <h2 className="font-bold text-xl mb-1 text-blue-700">แจ้งเตือนทางอีเมล</h2>
              <p className="text-slate-700 text-sm">
                รับอีเมลแจ้งเตือนอัตโนมัติเมื่อถึงวันสำคัญ 📅 เช่น วันหมดอายุใบรับประกัน หรือมีการเปลี่ยนแปลงสถานะการเคลม 📦
              </p>
            </div>
          </div>

          {/* Card 3: ปรับแต่งได้ตามใจ (เปลี่ยน SVG เป็น Emoji นาฬิกา/ตั้งค่า) */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-emerald-50 p-6 border border-blue-100 shadow flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="bg-emerald-100 rounded-full w-16 h-16 flex items-center justify-center mb-2">
                <span className="text-3xl">⚙️</span>
              </div>
            </div>
            <div>
              <h2 className="font-bold text-xl mb-1 text-emerald-700">ปรับแต่งได้ตามใจ</h2>
              <p className="text-slate-700 text-sm">
                ตั้งค่าระยะเวลาการแจ้งเตือนล่วงหน้าได้เอง ⏱️<br />
                เพื่อให้เหมาะกับไลฟ์สไตล์และความต้องการของคุณมากที่สุด 🎯
              </p>
            </div>
          </div>
        </section>

        <div className="mt-12 text-center text-slate-500 text-xs">
          💡 ระบบแจ้งเตือนนี้ออกแบบมาเพื่อให้คุณไม่พลาดทุกโอกาสสำคัญในการดูแลสินค้าและบริการของคุณ
        </div>
      </div>
    </div>
  );
}