import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, API_URL, getToken } from "../lib/api";
import { useAuth } from "../store/auth";
import AppLogo from "../components/AppLogo"; // ✅ ใช้โลโก้จริง
import CustomerProfileModal from "./CustomerProfileModal";
import { HiOutlineBell, HiOutlineClipboardList } from "react-icons/hi";

export default function CustomerNavbar() {
  const { user, logout, loadMe } = useAuth();
  const navigate = useNavigate();

  // dropdown โปรไฟล์ & แจ้งเตือน
  const [openMenu, setOpenMenu] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const menuRef = useRef(null);
  const notifRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [openNotifDetail, setOpenNotifDetail] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [notifRecoveredCache, setNotifRecoveredCache] = useState({});

  // ✅ แสดงเฉพาะ 5 ประเภท (รวม "อัปเดตใบ" รองรับ 2 type)
  const ALLOWED_TYPES = new Set([
    "nearing_expiration",
    "expired",
    "warranty_created",
    "complaint_created",
    // "อัปเดตใบรับประกัน" (หัวใบ / รายการ)
    "warranty_header_updated",
    "warranty_updated",
    // ลบใบรับประกัน (ต้องให้ลูกค้าเห็นกระดิ่งด้วย)
    "warranty_deleted",
    // กู้คืนใบรับประกัน (ต้องให้ลูกค้าเห็นด้วย)
    "warranty_restored",
  ]);

  function getNotifType(n) {
    return n?.type || (n?.data && n.data.type) || "";
  }

  function isAllowedNotif(n) {
    return ALLOWED_TYPES.has(getNotifType(n));
  }

  // 🟦 นับเฉพาะที่ยังไม่อ่าน (เฉพาะ 5 ประเภท)
  const unreadCount = (notifications || []).filter((n) => !n.read).length;

  // ✅ ดึงแจ้งเตือนจาก API
  async function fetchNotifications() {
    try {
      setNotifLoading(true);
      const res = await api.get("/notifications");
      const data = res?.data?.data || res?.data || [];
      const arr = Array.isArray(data) ? data : [];
      arr.sort(
        (a, b) =>
          new Date(b.createdAt || b.time || b.created_at || 0) -
          new Date(a.createdAt || a.time || a.created_at || 0)
      );

      // ✅ ซ่อนประเภทอื่นใน UI
      const visible = arr.filter(isAllowedNotif);

      setNotifications(visible);
      return data;
    } catch (e) {
      // ถ้า API ล้ม ไม่ทำให้ navbar พัง (คง state เดิมไว้/หรือจะล้างก็ได้)
      return [];
    } finally {
      setNotifLoading(false);
    }
  }

  // ✅ ทำเครื่องหมายว่าอ่านแล้ว (ยิง backend + refresh)
  async function markAllAsRead() {
    // คงพฤติกรรมเดิม: mark local ก่อน
    setNotifications((prev) => (prev || []).map((n) => ({ ...n, read: true })));

    try {
      setNotifLoading(true);
      await api.post("/notifications/mark-all-read");
      await fetchNotifications();
    } catch (e) {
      // ignore
    } finally {
      setNotifLoading(false);
    }
  }

  // ✅ mark อ่านเฉพาะรายการ
  async function markOneAsRead(id) {
    try {
      // optimistically mark local
      setNotifications((prev) =>
        (prev || []).map((n) =>
          String(n.id) === String(id) ? { ...n, read: true } : n
        )
      );
      await api.patch(`/notifications/${id}/read`);
      await fetchNotifications();
    } catch (e) { }
  }

  // ✅ Load notifications once + สมัคร SSE
  useEffect(() => {
    let mounted = true;
    let es = null;

    async function load() {
      try {
        setNotifLoading(true);
        const res = await api.get("/notifications");
        const data = res?.data?.data || res?.data || [];
        const arr = Array.isArray(data) ? data : [];
        arr.sort(
          (a, b) =>
            new Date(b.createdAt || b.time || b.created_at || 0) -
            new Date(a.createdAt || a.time || a.created_at || 0)
        );

        // ✅ ซ่อนประเภทอื่นใน UI
        const visible = arr.filter(isAllowedNotif);

        if (mounted) setNotifications(visible);
      } catch (e) {
        // ถ้า fail ก็ไม่บังคับล้าง (กัน UX แปลก ๆ)
        // if (mounted) setNotifications([]);
      } finally {
        if (mounted) setNotifLoading(false);
      }
    }

    // โหลดเฉพาะเมื่อมี token
    const token = getToken?.();
    if (token) {
      load();

      // SSE for real-time
      try {
        const base = (API_URL || "").replace(/\/+$/, "");
        es = new EventSource(`${base}/notifications/stream?token=${token}`);
        es.addEventListener("notification", (ev) => {
          try {
            const payload = JSON.parse(ev.data);

            // ✅ ซ่อนประเภทอื่นใน UI (รับเฉพาะ 5 ประเภท)
            if (!isAllowedNotif(payload)) return;

            // prepend notification ใหม่
            setNotifications((p) => [payload, ...(p || [])]);
          } catch (e) { }
        });
        es.onerror = () => { };
      } catch (e) {
        // ignore
      }
    }

    return () => {
      mounted = false;
      try {
        if (es) es.close();
      } catch { }
    };
  }, []);

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

  // ถ้าเปิดดูแจ้งเตือน "ลบใบรับประกัน" ให้ลองเช็กสถานะใบจริงจาก API
  // เพื่อรู้ว่าใบนี้ถูกกู้คืนแล้วหรือยัง (รองรับเคสเก่าที่ data.recovered ยังไม่มี)
  useEffect(() => {
    if (!openNotifDetail || !selectedNotification) return;

    const type = getNotifType(selectedNotification);
    if (type !== "warranty_deleted") return;

    if (selectedNotification?.data?.recovered) return;

    const id = selectedNotification.id;
    if (!id) return;

    if (notifRecoveredCache[id]) {
      setSelectedNotification((prev) =>
        prev && prev.id === id
          ? { ...prev, data: { ...(prev.data || {}), recovered: true } }
          : prev
      );
      return;
    }

    const code = selectedNotification?.data?.warrantySnapshot?.code;
    if (!code) return;

    let cancelled = false;
    (async () => {
      try {
        const resp = await api.get("/customer/warranties", {
          params: { q: code, status: "all" },
        });
        const rows = resp?.data?.data || [];
        const has = Array.isArray(rows)
          ? rows.some((w) => String(w.code) === String(code))
          : false;
        if (!cancelled && has) {
          setNotifRecoveredCache((prev) => ({ ...prev, [id]: true }));
          setSelectedNotification((prev) =>
            prev && prev.id === id
              ? { ...prev, data: { ...(prev.data || {}), recovered: true } }
              : prev
          );
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openNotifDetail, selectedNotification, notifRecoveredCache]);

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
    } catch { }
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

  function initialFromString(s) {
    return (s?.trim()?.[0] || "U").toUpperCase();
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
  const customerProfile = user?.customerProfile || {};
  const displayName =
    // ร้านค้า (กันไว้หากใช้ Navbar ตัวนี้ร่วมกับ role อื่น)
    user?.storeProfile?.storeName || user?.store?.name || user?.storeName ||
    // ลูกค้า: ใช้ชื่อ-นามสกุลจาก customerProfile ก่อน
    (customerProfile.firstName
      ? `${customerProfile.firstName} ${customerProfile.lastName || ""}`.trim()
      : user?.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : "บัญชีของฉัน");
  const displaySub = user?.storeProfile?.email || displayEmail;
  const isAuthenticated = !!user;
  const avatarUrl = customerProfile.avatarUrl || "";

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

          {/* --- ขวา: แจ้งเตือน + โปรไฟล์ --- */}
          <div className="flex items-center gap-3">
            {/* 🔔 ปุ่มแจ้งเตือน */}
            <div className="relative" ref={notifRef}>
              <button
                id="customer-step-bell"
                title="การแจ้งเตือน"
                onClick={async () => {
                  // คงของเดิม: toggle dropdown
                  setOpenNotif((v) => !v);

                  // “เพิ่ม” ตามโค้ด2: ถ้าเปิด dropdown ให้ mark all read + ยิง API
                  const next = !openNotif;
                  if (next) {
                    await markAllAsRead();
                  }
                }}
                className="grid h-9 w-9 place-items-center rounded-full bg-white shadow ring-1 ring-sky-100 text-sky-600 hover:bg-sky-50 transition"
              >
                <HiOutlineBell className="h-5 w-5" />
                {/* ✅ คงของเดิม: badge unread */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown แจ้งเตือน */}
              {openNotif && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 w-72 max-w-[calc(100vw-1rem)] rounded-2xl border border-sky-100 bg-white shadow-xl overflow-hidden z-[1200]">
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
                    {notifLoading ? (
                      <div className="p-4 text-sm text-slate-500 text-center">
                        กำลังโหลด...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500 text-center">
                        ไม่มีการแจ้งเตือน
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const id = n.id;
                        // รองรับทั้ง format เก่า (message/type) และ format ใหม่ (title/body/createdAt)
                        const title =
                          n.title ||
                          n.message ||
                          (n.data && n.data.type) ||
                          "การแจ้งเตือน";
                        const body = n.body || "";
                        const type = getNotifType(n);
                        const read = !!n.read;

                        return (
                          <div
                            key={id}
                            onClick={() => {
                              if (id != null) {
                                if (!read) markOneAsRead(id);
                                setSelectedNotification(n);
                                setOpenNotifDetail(true);
                              }
                            }}
                            className={`px-3 py-2 border-b last:border-0 transition ${type === "nearing_expiration"
                              ? "bg-amber-50 text-amber-800"
                              : type === "expired"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-white text-slate-700"
                              } ${read ? "opacity-70" : "font-semibold"} ${id != null ? "cursor-pointer" : ""}
                              `}
                          >
                            <div className="whitespace-normal break-words">
                              <div className="customer-notif-title font-semibold">{title}</div>
                              {body ? (
                                <div className="customer-notif-body mt-0.5">
                                  <div dangerouslySetInnerHTML={{ __html: body }} />
                                </div>
                              ) : null}
                            </div>
                            {n.createdAt ? (
                              <div className="text-[10px] text-slate-400 mt-1">
                                {new Date(n.createdAt).toLocaleString()}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 📝 ปุ่มร้องเรียน (ลูกค้า) */}
            {isAuthenticated && (
              <Link
                id="customer-step-complaint"
                to="/customer/complaints"
                title="ร้องเรียน/ติดต่อแอดมิน"
                className="inline-flex items-center gap-2 rounded-full bg-white shadow ring-1 ring-sky-100 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 transition"
                onClick={() => {
                  setOpenMenu(false);
                  setOpenNotif(false);
                }}
              >
                <HiOutlineClipboardList className="h-4 w-4" />
                <span className="hidden md:inline">แจ้งปัญหา</span>
              </Link>
            )}

            {/* 🧍 กล่องโปรไฟล์ / ปุ่มล็อกอิน */}
            {isAuthenticated ? (
              <div
                ref={menuRef}
                onClick={() => setOpenMenu((v) => !v)}
                className="flex cursor-pointer items-center gap-3 rounded-full bg-sky-100 px-3 py-1.5 shadow ring-1 ring-slate-100 hover:bg-sky-200 transition"
              >
                {/* Avatar ลูกค้า: แสดงรูปจริงถ้ามี, ถ้าไม่มีก็ใช้ไอคอนเดิม */}
                <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-500 text-white text-xl shadow overflow-hidden">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="รูปโปรไฟล์ลูกค้า"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span role="img" aria-label="customer-avatar">
                      👤
                    </span>
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-slate-800">{displayName}</div>
                  <div className="text-xs text-slate-500">{displaySub}</div>
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
                ข้อมูลส่วนตัว
              </Link>

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

      {/* Modal แสดงรายละเอียดแจ้งเตือนเต็มข้อความ */}
      {openNotifDetail && selectedNotification && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">รายละเอียดการแจ้งเตือน</div>
              <button
                type="button"
                onClick={() => {
                  setOpenNotifDetail(false);
                }}
                className="text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="px-4 py-3 text-sm text-slate-700 max-h-[60vh] overflow-y-auto">
              <div className="customer-notif-title font-semibold text-slate-900">
                {selectedNotification.title ||
                  selectedNotification.message ||
                  (selectedNotification.data && selectedNotification.data.type) ||
                  "การแจ้งเตือน"}
              </div>
              {selectedNotification.body && (
                <div className="mt-2 text-sm text-slate-700">
                  <div
                    dangerouslySetInnerHTML={{ __html: selectedNotification.body }}
                  />
                </div>
              )}
              {getNotifType(selectedNotification) === "warranty_deleted" &&
                selectedNotification?.data?.warrantySnapshot && (
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-700 space-y-1">
                    <div className="font-semibold text-slate-900">รายละเอียดใบรับประกัน (ก่อนถูกลบ)</div>
                    <div>รหัสใบรับประกัน: <span className="font-medium">{selectedNotification.data.warrantySnapshot.code || "-"}</span></div>
                    {selectedNotification.data.warrantySnapshot.productName && (
                      <div>สินค้า: <span className="font-medium">{selectedNotification.data.warrantySnapshot.productName}</span></div>
                    )}
                    {selectedNotification.data.warrantySnapshot.model && (
                      <div>รุ่น / รุ่นย่อย: <span className="font-medium">{selectedNotification.data.warrantySnapshot.model}</span></div>
                    )}
                    {selectedNotification.data.warrantySnapshot.serial && (
                      <div>Serial No.: <span className="font-medium">{selectedNotification.data.warrantySnapshot.serial}</span></div>
                    )}
                    {selectedNotification.data.warrantySnapshot.purchaseDate && (
                      <div>
                        วันที่ซื้อสินค้า: <span className="font-medium">
                          {new Date(selectedNotification.data.warrantySnapshot.purchaseDate).toLocaleDateString("th-TH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                    {selectedNotification.data.warrantySnapshot.expiryDate && (
                      <div>
                        วันสิ้นสุดการรับประกัน: <span className="font-medium">
                          {new Date(selectedNotification.data.warrantySnapshot.expiryDate).toLocaleDateString("th-TH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                    {selectedNotification.data.warrantySnapshot.coverageNote && (
                      <div>เงื่อนไขการรับประกัน: <span className="font-medium">{selectedNotification.data.warrantySnapshot.coverageNote}</span></div>
                    )}
                    {selectedNotification.data.warrantySnapshot.note && (
                      <div>หมายเหตุเพิ่มเติม: <span className="font-medium">{selectedNotification.data.warrantySnapshot.note}</span></div>
                    )}
                    {selectedNotification.data.warrantySnapshot.storeName && (
                      <div>ร้านค้า: <span className="font-medium">{selectedNotification.data.warrantySnapshot.storeName}</span></div>
                    )}
                  </div>
                )}
              {selectedNotification.createdAt && (
                <div className="mt-3 text-xs text-slate-500">
                  ได้รับเมื่อ {new Date(selectedNotification.createdAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setOpenNotifDetail(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                ปิด
              </button>

              <div className="flex items-center gap-2">
                {getNotifType(selectedNotification) === "warranty_deleted" &&
                  selectedNotification?.data?.warrantySnapshot &&
                  !selectedNotification?.data?.recovered && (
                    <button
                      type="button"
                      onClick={() => {
                        const snap = selectedNotification?.data?.warrantySnapshot || {};
                        const code = snap.code || "-";
                        const product = snap.productName || "";
                        const storeName = snap.storeName || "";

                        const presetSubject = `ขอกู้คืนใบรับประกันรหัส ${code}`;

                        const lines = [
                          "ขอความกรุณาช่วยตรวจสอบและกู้คืนใบรับประกันนี้ให้ด้วย",
                          "",
                          "รายละเอียดใบรับประกันเดิม (จากระบบ):",
                          `- รหัสใบรับประกัน: ${code}`,
                          product ? `- สินค้า: ${product}` : "",
                          storeName ? `- ร้านค้า: ${storeName}` : "",
                        ].filter(Boolean);

                        const presetMessage = lines.join("\n");

                        navigate("/customer/complaints", {
                          state: {
                            fromWarrantyDeleted: true,
                            isRecoveryRequest: true,
                            presetCategory: "ปัญหาใบรับประกัน",
                            presetSubject,
                            presetMessage,
                          },
                        });

                        setOpenNotifDetail(false);
                        setOpenNotif(false);
                      }}
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700"
                    >
                      ยื่นคำร้องกู้คืนใบรับประกันนี้
                    </button>
                  )}

                {getNotifType(selectedNotification) === "warranty_deleted" &&
                  selectedNotification?.data?.recovered && (
                    <span className="text-[11px] font-medium text-emerald-600">
                      ใบรับประกันนี้ถูกกู้คืนแล้ว
                    </span>
                  )}

                {selectedNotification?.data?.warrantyId && (
                  <button
                    type="button"
                    onClick={() => {
                      const wid = selectedNotification?.data?.warrantyId;
                      if (wid) {
                        navigate("/customer/warranties", {
                          state: { focusWarrantyId: wid },
                        });
                        setOpenNotifDetail(false);
                        setOpenNotif(false);
                      }
                    }}
                    className="rounded-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-sky-700"
                  >
                    ไปที่ใบรับประกัน
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Render CustomerProfileModal when openModal is true */}
      {openModal && (
        <CustomerProfileModal open={openModal} onClose={() => setOpenModal(false)} initialTab={tab} />
      )}
    </>
  );
}
