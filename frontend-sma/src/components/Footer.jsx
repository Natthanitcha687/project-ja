// src/components/Footer.jsx
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-[#0B1220] text-white pt-12 pb-6 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-10 mb-10">
          {/* ---- Brand ---- */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-6 h-6 text-blue-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 2c.3 0 .6.06.88.18l6.62 2.65c.3.12.5.41.5.74V12c0 4.97-3.35 8.51-7.99 10-4.64-1.49-8-5.03-8-10V5.57c0-.33.2-.62.5-.74l6.62-2.65C11.4 2.06 11.7 2 12 2z"
                />
                <path
                  stroke="none"
                  fill="#3B82F6"
                  d="M10.3 12.7l-.99-.99a1 1 0 10-1.41 1.41l1.7 1.7a1 1 0 001.41 0l4.1-4.1a1 1 0 10-1.41-1.41l-3.4 3.39z"
                />
              </svg>
              <span className="text-lg font-semibold">Warranty</span>
            </div>
            <p className="text-sm text-gray-300 leading-6 mb-4 max-w-sm">
              แพลตฟอร์มบริหารจัดการการรับประกันสินค้าสำหรับธุรกิจขนาดเล็กถึงขนาดใหญ่
              เพื่อให้การจัดการใบรับประกันเป็นเรื่องง่าย
            </p>

            <div className="flex gap-6 text-sm text-gray-400">
              <div>
                <span className="font-semibold text-white">500+</span> ร้านค้า
              </div>
              <div>
                <span className="font-semibold text-white">4K+</span> ลูกค้า
              </div>
              <div>
                <span className="font-semibold text-white">99%</span> พึงพอใจ
              </div>
            </div>
          </div>

          {/* ---- Services ---- */}
          <div>
            <h3 className="font-semibold text-white mb-4">บริการ</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>จัดการใบรับประกัน</li>
              <li>จัดการลูกค้า</li>
              <li>รายงานและสถิติ</li>
              <li>การแจ้งเตือน</li>
            </ul>
          </div>

          {/* ---- Help ---- */}
          <div>
            <h3 className="font-semibold text-white mb-4">ช่วยเหลือ</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>วิธีใช้งาน</li>
              <li>เกี่ยวกับเรา</li>
              <li>คำถามที่พบบ่อย</li>
              <li>สนับสนุน</li>
            </ul>
          </div>
        </div>

        {/* ---- Bottom Bar ---- */}
        <div className="border-t border-gray-700 pt-5 flex flex-col md:flex-row justify-between text-xs text-gray-400">
          <p>
            © 2024 Warranty Management Platform. สงวนลิขสิทธิ์.
          </p>
          <p>พัฒนาโดยทีม Warranty Platform</p>
        </div>
      </div>

      {/* subtle wave background */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#111a2e] to-transparent"></div>
    </footer>
  );
}
