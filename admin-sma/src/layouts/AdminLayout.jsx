import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../store/auth";

const Item = ({ to, children }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `block rounded-xl px-3 py-2 text-sm ${
        isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
      }`
    }
  >
    {children}
  </NavLink>
);

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="flex">
        <aside className="w-64 border-r border-white/10 p-4">
          <div className="mb-6">
            <div className="text-lg font-semibold">Admin Panel</div>
            <div className="text-xs text-white/60">{user?.email}</div>
          </div>

          <nav className="space-y-1">
            <Item to="/">Control Panel</Item>
            <Item to="/stores">จัดการร้านค้า</Item>
            <Item to="/users">จัดการผู้ใช้งาน</Item>
            <Item to="/security">ตรวจสอบความปลอดภัย</Item>
            <Item to="/logs">Activity Logs</Item>
            <Item to="/complaints">คำขอ/ร้องเรียน</Item>
          </nav>

          <button
            onClick={logout}
            className="mt-6 w-full rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            ออกจากระบบ
          </button>
        </aside>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
