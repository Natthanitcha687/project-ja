import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Home.css";
import ShieldLogo from "../components/AppLogo";
import { API_URL } from "../lib/api";

<Link to="/" className="flex items-center gap-2">
  <ShieldLogo className="w-8 h-8" />
  <span className="font-bold text-lg">Warranty</span>
</Link>
export default function Home() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const res = await fetch(`${API_URL}/public/stats`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        // ignore, ใช้ค่า default ถ้าโหลดไม่ได้
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const storesText =
    typeof stats?.stores === "number"
      ? stats.stores.toLocaleString("th-TH")
      : "-";
  const customersText =
    typeof stats?.customers === "number"
      ? stats.customers.toLocaleString("th-TH")
      : "-";
  const warrantiesText =
    typeof stats?.warranties === "number"
      ? stats.warranties.toLocaleString("th-TH")
      : "-";
  const satisfactionPct =
    typeof stats?.satisfaction?.average === "number" && stats.satisfaction.average > 0
      ? Math.round((stats.satisfaction.average / 5) * 100)
      : null;
  const satisfactionText = satisfactionPct !== null ? `${satisfactionPct}%` : "-";

  return (
    <div className="bg-white text-gray-800 overflow-hidden">
      {/* ===== HERO SECTION ===== */}
      <section className="relative bg-gradient-to-b from-[#e7f2ff] to-[#f5faff] pb-16 overflow-hidden">
        {/* ==== Floating Bubbles ==== */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => {
            const size = 20 + Math.random() * 40;
            const dur = 6 + Math.random() * 6; // 6s - 12s (faster)
            const delay = Math.random() * 6; // random start delay
            const drift = (Math.random() - 0.5) * 40; // horizontal drift px
            const bottomOffset = 80 + Math.random() * 120; // place bubble start above bottom (align with wave)
            return (
              <div
                key={i}
                className={`bubble`}
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${delay}s`,
                  width: `${size}px`,
                  height: `${size}px`,
                  // css vars for per-bubble control
                  ['--dur']: `${dur}s`,
                  ['--drift']: `${drift}px`,
                  ['--bubble-bottom']: `${bottomOffset}px`,
                }}
              ></div>
            );
          })}
        </div>

        {/* ==== HERO CONTENT ==== */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 text-center">
          <div className="flex justify-center mb-6">
            <img
              src="/home-assets/logo.png"
              alt="Warranty Platform Logo"
              className="w-28 sm:w-36 drop-shadow-md animate-float"
            />
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-snug">
            แพลตฟอร์มบริหารจัดการ
            <br />
            การรับประกันที่ครบวงจร
          </h1>
          <p className="mt-4 text-gray-700 font-medium text-base sm:text-lg">
            ปลอดภัย ใช้งานง่าย และเหมาะกับธุรกิจทุกขนาด
          </p>

          {/* ===== STATS ===== */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 justify-items-center">
            {[
              { value: storesText, label: "ร้านค้าที่ใช้แพลตฟอร์ม" },
              { value: customersText, label: "ลูกค้าที่ใช้แพลตฟอร์ม" },
              { value: warrantiesText, label: "ใบรับประกัน" },
              { value: satisfactionText, label: "ความพึงพอใจ" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center group">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-100 rounded-full blur-lg opacity-40 group-hover:opacity-70 transition"></div>
                  <div className="w-16 h-16 rounded-full border-2 border-blue-500 flex items-center justify-center text-blue-600 font-semibold text-lg bg-white shadow-md shadow-blue-100 transition transform group-hover:scale-105">
                    {item.value}
                  </div>
                </div>
                <p className="text-gray-600 text-sm mt-2">{item.label}</p>
              </div>
            ))}
          </div>

          {/* ===== CARDS ===== */}
          <div className="mt-16 grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {[
              {
                icon: "https://cdn-icons-png.flaticon.com/512/1077/1077114.png",
                title: "ลูกค้า",
                desc: "ตรวจสอบสถานะและเอกสารรับประกันได้ทุกที่ทุกเวลา พร้อมบันทึกข้อมูลสินค้าอย่างเป็นระบบ",
                btn: "เริ่มต้นสำหรับลูกค้า",
                to: "/signup?role=customer",
              },
              {
                icon: "https://cdn-icons-png.flaticon.com/512/1170/1170678.png",
                title: "ร้านค้า",
                desc: "จัดการใบรับประกันของลูกค้าได้ง่าย บริหารข้อมูลหลังการขายแบบมืออาชีพ",
                btn: "เริ่มต้นสำหรับร้านค้า",
                to: "/signup?role=store",
              },
            ].map((card, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-2xl transition duration-500 text-center hover:-translate-y-2"
              >
                <div className="flex justify-center mb-4">
                  <div className="relative animate-float">
                    <div className="absolute inset-0 bg-blue-100 rounded-full blur-lg opacity-60 w-20 h-20" />
                    <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-white shadow-md border border-white/40">
                      <img
                        src={card.icon}
                        alt={card.title}
                        className="w-10 h-10 object-contain z-10"
                      />
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900">{card.title}</h3>
                <p className="mt-3 text-gray-600 text-sm leading-relaxed">
                  {card.desc}
                </p>
                <Link
                  to={card.to}
                  className="inline-block mt-5 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  {card.btn}
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* ===== WAVE ===== */}
        <div className="relative w-full overflow-hidden leading-none -mb-[2px] mt-12">
          <svg
            viewBox="0 0 1440 320"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-auto wave-smooth"
          >
            <defs>
              <linearGradient id="softBlueWave" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9ccfff" />
                <stop offset="60%" stopColor="#bde2ff" />
                <stop offset="100%" stopColor="#eaf6ff" />
              </linearGradient>
            </defs>
            <path
              fill="url(#softBlueWave)"
              d="M0,192L48,176C96,160,192,128,288,122.7C384,117,480,139,576,154.7C672,171,768,181,864,181.3C960,181,1056,171,1152,176C1248,181,1344,203,1392,213.3L1440,224V320H0Z"
            ></path>
          </svg>
        </div>
      </section>

      {/* ===== WHY CHOOSE ===== */}
      <section className="relative bg-[#f2f8ff] py-16 text-center -mt-10 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-14">
            ทำไมต้องเลือก Warranty
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: "จัดการใบรับประกัน",
                icon: "/home-assets/icon-warranty.png",
                desc: "บันทึกและเก็บเอกสารรับประกันในระบบดิจิทัล ปลอดภัยและค้นหาได้สะดวก",
              },
              {
                title: "จัดการลูกค้า",
                icon: "/home-assets/icon-crm.png",
                desc: "ดูแลและบันทึกข้อมูลลูกค้าพร้อมประวัติการรับประกัน เพื่อบริการที่มีประสิทธิภาพ",
              },
              {
                title: "รายงานและสถิติ",
                icon: "/home-assets/icon-analytics.png",
                desc: "เข้าถึงข้อมูลการขายและการเคลม เพื่อปรับกลยุทธ์และเพิ่มประสิทธิภาพธุรกิจ",
              },
              {
                title: "แจ้งเตือนอัตโนมัติ",
                icon: "/home-assets/icon-reminder.png",
                desc: "ระบบแจ้งเตือนวันหมดอายุการรับประกันและสถานะเคลมให้ลูกค้าทราบแบบเรียลไทม์",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="bg-[#f9fbff] rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-2 transition text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-100 rounded-full blur-md opacity-70 w-20 h-20 mx-auto" />
                    <img
                      src={f.icon}
                      alt={f.title}
                      className="relative w-20 h-20 object-contain z-10"
                    />
                  </div>
                </div>
                <h3 className="font-bold text-gray-900 text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}