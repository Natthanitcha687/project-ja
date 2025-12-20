// frontend-sma/src/components/CustomerNavbar.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, API_URL, getToken } from "../lib/api";
import { useAuth } from "../store/auth";
import AppLogo from "../components/AppLogo"; // ✅ ใช้โลโก้จริง
import CustomerProfileModal from "./CustomerProfileModal";

export default function CustomerNavbar() {
  const { user, logout, loadMe } = useAuth();
  const navigate = useNavigate();

  // dropdown โปรไฟล์ & แจ้งเตือน
  const [openMenu, setOpenMenu] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  // 🔔 การแจ้งเตือน (ดึงจาก API + สมัคร SSE)
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // 🟦 นับเฉพาะที่ยังไม่อ่าน
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ✅ ทำเครื่องหมายว่าอ่านแล้ว
  async function markAllAsRead() {
    try {
      setNotifLoading(true);
      await api.post('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      // ignore
    } finally {
      setNotifLoading(false);
    }
  }

  async function markOneAsRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (e) {}
  }

  // Fetch notifications once
  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setNotifLoading(true)
        const res = await api.get('/notifications')
        const data = res?.data?.data || res?.data || []
        if (mounted) setNotifications(Array.isArray(data) ? data : [])
      } catch (e) {
        if (mounted) setNotifications([])
      } finally {
        if (mounted) setNotifLoading(false)
      }
    }
    load()

    // SSE for real-time
    const token = getToken()
    if (token) {
      const es = new EventSource(`${API_URL.replace(/\/+$/, '')}/notifications/stream?token=${token}`)
      es.addEventListener('notification', (ev) => {
        try { const payload = JSON.parse(ev.data); setNotifications((p)=>[payload, ...(p||[])]); } catch (e) {}
      })
      es.onerror = () => {}
      return () => {
        mounted = false
        try { es.close() } catch {}
      }
    }
    return () => { mounted = false }
  }, [])

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setOpenNotif(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // modal โปรไฟล์
  const [openModal, setOpenModal] = useState(false);
  const [tab, setTab] = useState("info");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // ฟอร์มโปรไฟล์
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: user?.email || "",
  });

  // ฟอร์มรหัสผ่าน
  const [pwd, setPwd] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  async function loadProfile() {
    try {
      const r = await api.get("/auth/me");
      const me = r.data?.user || r.data || {};
      const cp = me.customerProfile || {};
      setProfile({
        firstName: cp.firstName || "",
        lastName: cp.lastName || "",
        phone: cp.phone || "",
        email: me.email || "",
      });
    } catch {}
  }

  useEffect(() => {
    if (!openModal) return;
    setMsg("");
    setTab("info");
    loadProfile();
  }, [openModal]);

  function initialFromEmail(email) {
    return (email?.[0] || "U").toUpperCase();
  }

  async function onSaveProfile() {
    setSaving(true);
    setMsg("");
    try {
      await api.patch("/customer/profile", {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
      });
      setMsg("บันทึกข้อมูลส่วนตัวสำเร็จ");
      await loadMe();
      setOpenModal(false);
    } catch (e) {
      setMsg(e?.response?.data?.message || "บันทึกโปรไฟล์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function onChangePassword() {
    if (!pwd.old_password || !pwd.new_password) {
      setMsg("กรอกข้อมูลให้ครบ");
      return;
    }
    if (pwd.new_password.length < 8) {
      setMsg("รหัสผ่านใหม่ต้องอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (pwd.new_password !== pwd.confirm_password) {
      setMsg("รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      await api.patch("/customer/change-password", {
        old_password: pwd.old_password,
        new_password: pwd.new_password,
      });
      setMsg("เปลี่ยนรหัสผ่านสำเร็จ");
      setOpenModal(false);
      setPwd({ old_password: "", new_password: "", confirm_password: "" });
    } catch (e) {
      setMsg(e?.response?.data?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function onLogout() {
    logout();
    navigate("/signin");
  }

  const displayEmail = user?.email || profile.email;
  const isAuthenticated = !!user;

  // (removed dashboard link from top bar - profile dropdown will keep only profile/password/logout)

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-sky-200 bg-sky-50/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {/* --- โลโก้ฝั่งซ้าย --- */}
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-sky-100">
              <AppLogo className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-semibold text-sky-900">Warranty</div>
              <div className="text-xs text-slate-500">
                จัดการการรับประกันของคุณได้ในที่เดียว
              </div>
            </div>
          </Link>

          {/* center navigation removed for customer topbar (keeps header minimal) */}

          {/* --- ขวา: แจ้งเตือน + โปรไฟล์ --- */}
          <div className="flex items-center gap-3">
            {/* 🔔 ปุ่มแจ้งเตือน */}
            <div className="relative" ref={notifRef}>
              <button
                title="การแจ้งเตือน"
                onClick={() => {
                  setOpenNotif((v) => !v);
                  if (!openNotif) markAllAsRead();
                }}
                className="grid h-9 w-9 place-items-center rounded-full bg-white shadow ring-1 ring-sky-100 text-sky-600 hover:bg-sky-50 transition"
              >
                <span className="text-lg">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown แจ้งเตือน */}
              {openNotif && (
                <div className="absolute right-0 top-12 w-72 rounded-2xl border border-sky-100 bg-white shadow-xl overflow-hidden z-[1200]">
                  <div className="flex items-center justify-between border-b border-sky-50 bg-sky-50/60 px-4 py-2 text-sm font-semibold text-sky-800">
                    <span>การแจ้งเตือน</span>
                    <button
                      onClick={markAllAsRead}
                      className="text-sky-600 hover:underline text-xs font-normal"
                    >
                      ทำเครื่องหมายว่าอ่านแล้ว
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500 text-center">
                        ไม่มีการแจ้งเตือน
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => { if (!n.read) markOneAsRead(n.id); }}
                          className={`px-4 py-3 text-sm border-b last:border-0 transition cursor-pointer ${
                            n.type === "warning"
                              ? "bg-amber-50 text-amber-800"
                              : n.type === "expired"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-white text-slate-700"
                          } ${n.read ? "opacity-70" : "font-semibold"}`}
                        >
                          <div className="truncate">
                            <div className="text-sm font-semibold">{n.title || (n.data && n.data.type) || 'การแจ้งเตือน'}</div>
                            {n.body && <div className="text-xs text-slate-500 mt-1">{n.body}</div>}
                          </div>
                          {n.createdAt && (
                            <div className="text-[10px] text-slate-400 mt-1">
                              {new Date(n.createdAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 🧍 กล่องโปรไฟล์ / ปุ่มล็อกอิน */}
            {isAuthenticated ? (
              <div
                ref={menuRef}
                onClick={() => setOpenMenu((v) => !v)}
                className="flex cursor-pointer items-center gap-3 rounded-full bg-sky-100 px-3 py-1.5 shadow ring-1 ring-slate-100 hover:bg-sky-200 transition"
              >
                <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-500 text-white text-lg font-semibold shadow">
                  {initialFromEmail(displayEmail)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-slate-800">
                    {user?.firstName
                      ? `${user.firstName} ${user.lastName || ""}`
                      : "บัญชีของฉัน"}
                  </div>
                  <div className="text-xs text-slate-500">{displayEmail}</div>
                </div>
                <svg
                  className="h-4 w-4 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/signin"
                  className="inline-flex items-center justify-center rounded-xl border border-blue-600 text-blue-700 px-4 py-2 text-sm font-medium hover:bg-blue-50 transition"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition shadow-sm"
                >
                  สมัครสมาชิก
                </Link>
              </div>
            )}
          </div>

          {/* --- เมนู dropdown โปรไฟล์ (เมื่อล็อกอิน) --- */}
          {isAuthenticated && openMenu && (
            <div className="absolute right-4 top-20 w-44 rounded-xl border border-sky-100 bg-white shadow-xl z-[1200] py-2">
              <Link
                to="#"
                onClick={(e) => {
                  e.preventDefault();
                  setOpenModal(true);
                  setOpenMenu(false);
                }}
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                โปรไฟล์ของฉัน
              </Link>

              {/* removed top navigation shortcuts from profile dropdown to keep it minimal */}

              <div className="border-t border-slate-100 mt-1" />
              <button
                onClick={onLogout}
                className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
              >
                ออกจากระบบ
              </button>
            </div>
          )}
        </nav>
      </header>
      {/* Render CustomerProfileModal when openModal is true */}
      {openModal && (
        <CustomerProfileModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          initialTab={tab}
        />
      )}
    </>
  );
}
