import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../store/auth";
import { api } from "../lib/api";

function clsTab({ isActive }) {
  return [
    "rounded-lg px-4 py-1.5 text-sm font-semibold transition",
    isActive ? "bg-sky-700 text-white shadow-sm" : "bg-white text-slate-700 hover:bg-slate-50",
  ].join(" ");
}

function StatCard({ title, value, sub, tone = "normal", icon }) {
  const toneCls =
    tone === "danger" ? "border-rose-200" : tone === "info" ? "border-sky-200" : "border-slate-200";

  return (
    <div className={`rounded-2xl border ${toneCls} bg-white shadow-sm`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500">{title}</div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              {value ?? "—"}
            </div>
            {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
          </div>

          <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-sky-600" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l8 4v6c0 5-3.5 9-8 9s-8-4-8-9V7l8-4z" />
      <path d="M9 12l2 2 4-5" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-sky-700" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-fuchsia-700" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-rose-700" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);

  async function loadStats() {
    try {
      const { data } = await api.get("/admin/stats");
      setStats(data);
    } catch {
      // เงียบไว้
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  function onLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[#eaf5ff] text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 ring-1 ring-sky-100">
              <ShieldIcon />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-slate-900">Admin Control Panel</div>
              <div className="text-xs text-slate-500">ระบบจัดการผู้ดูแลระบบ</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ↩ ออกจากระบบ
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Overview */}
        <div className="mb-5">
          <div className="text-2xl font-extrabold tracking-tight">ภาพรวมระบบ</div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="ร้านค้าทั้งหมด"
              value={stats?.stores ?? "—"}
              sub="+12% เดือนนี้"
              icon={<HomeIcon />}
            />
            <StatCard
              title="ผู้ใช้งานทั้งหมด"
              value={stats?.customers ?? "—"}
              sub="ลูกค้าที่ใช้งานอยู่"
              icon={<UsersIcon />}
            />

            {/* ✅ ย้ายให้ “เคสเปิด” มาใกล้งานหลัก และเปลี่ยนชื่อ */}
            <StatCard
              title="ข้อมูลการแจ้งปัญหา (เปิด)"
              value={stats?.complaintsOpen ?? "—"}
              sub="ต้องตรวจสอบ"
              tone="danger"
              icon={<WarnIcon />}
            />

            <StatCard
              title="การรับประกัน"
              value={stats?.warranties ?? "—"}
              sub="รายการทั้งหมด"
              icon={<DocIcon />}
            />
          </div>
        </div>

        {/* Tabs (เรียงลำดับใหม่ + เปลี่ยนชื่อ) */}
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <NavLink to="/stores" className={clsTab}>จัดการร้านค้า</NavLink>
          <NavLink to="/users" className={clsTab}>จัดการผู้ใช้</NavLink>

          {/* ✅ เปลี่ยนชื่อ + เลื่อนมาอยู่ก่อน security/logs */}
          <NavLink to="/complaints" className={clsTab}>ข้อมูลการแจ้งปัญหา</NavLink>

          <NavLink to="/security" className={clsTab}>ตรวจสอบความปลอดภัย</NavLink>
          <NavLink to="/logs" className={clsTab}>Activity Logs</NavLink>
        </div>

        {/* Page */}
        <Outlet />
      </main>
    </div>
  );
}
