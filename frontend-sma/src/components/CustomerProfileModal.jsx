import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

/**
 * CustomerProfileModal
 * - แท็บ: ข้อมูลส่วนตัว | เปลี่ยนรหัสผ่าน
 * - Prefill: GET /customer/profile
 * - Update profile: PATCH /customer/profile  (fields: firstName, lastName, phone, isConsent)
 * - Change password: PATCH /customer/change-password (fields: old_password, new_password)
 *
 * ใช้:
 * <CustomerProfileModal open={open} onClose={()=>setOpen(false)} />
 */
export default function CustomerProfileModal({ open, onClose, initialTab = 'info' }) {
  // ไม่ได้พึ่ง id เพราะ backend ใช้ JWT
  useAuth(); // keep auth alive if needed

  const [tab, setTab] = useState("info"); // 'info' | 'password'
  const [loading, setLoading] = useState(false);
  const [serverMsg, setServerMsg] = useState("");

  // ---- ฟอร์ม ข้อมูลส่วนตัว ----
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState(""); // read-only (backend ไม่รองรับแก้)
  const [phone,     setPhone]     = useState("");
  const [isConsent, setIsConsent] = useState(false);

  // ---- ฟอร์ม เปลี่ยนรหัสผ่าน ----
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew,  setConfirmNew]  = useState("");

  const canSaveInfo = useMemo(() => {
    // มีค่าใดค่าหนึ่งเปลี่ยนก็ให้กดได้
    return (
      (firstName?.trim() !== "") ||
      (lastName?.trim()  !== "") ||
      (phone?.trim()     !== "") ||
      typeof isConsent === "boolean"
    );
  }, [firstName, lastName, phone, isConsent]);

  const canChangePw = useMemo(() => {
    return oldPassword && newPassword?.length >= 8 && newPassword === confirmNew;
  }, [oldPassword, newPassword, confirmNew]);

  // โหลดโปรไฟล์ทุกครั้งที่เปิดโมดัล
  useEffect(() => {
    if (!open) return;
    setTab(initialTab || "info");
    setServerMsg("");
    (async () => {
      try {
        const { data } = await api.get("/customer/profile");
        setEmail(data?.email || "");
        setFirstName(data?.firstName || "");
        setLastName(data?.lastName || "");
        setPhone(data?.phone || "");
        setIsConsent(!!data?.isConsent);
      } catch (err) {
        console.error("GET /customer/profile error", err);
        alert(err?.response?.data?.message || "ดึงข้อมูลโปรไฟล์ไม่สำเร็จ");
      }
    })();
  }, [open]);

  if (!open) return null;

  const endpoints = {
    profile: "/customer/profile",
    changePassword: "/customer/change-password",
  };

  const resetAndClose = () => {
    setOldPassword(""); setNewPassword(""); setConfirmNew("");
    onClose?.();
  };

  const onSaveInfo = async () => {
    if (!canSaveInfo) return;
    setLoading(true);
    setServerMsg("");
    try {
      await api.patch(endpoints.profile, {
        firstName: firstName?.trim(),
        lastName : lastName?.trim(),
        phone    : phone?.trim(),
        isConsent: !!isConsent,
        // ❌ email ไม่รองรับการแก้ใน backend — อย่าส่ง
      });
      setServerMsg("บันทึกข้อมูลส่วนตัวเรียบร้อย");
      resetAndClose();
    } catch (err) {
      console.error("PATCH /customer/profile error", err);
      const msg = err?.response?.data?.message || "บันทึกข้อมูลไม่สำเร็จ";
      setServerMsg(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const onChangePassword = async () => {
    if (!canChangePw) return;
    setLoading(true);
    setServerMsg("");
    try {
      // ✅ backend ต้องการ snake_case เท่านั้น
      await api.patch(endpoints.changePassword, {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setServerMsg("เปลี่ยนรหัสผ่านเรียบร้อย");
      resetAndClose();
    } catch (err) {
      console.error("PATCH /customer/change-password error", err);
      const msg = err?.response?.data?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ";
      setServerMsg(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="text-lg font-semibold">แก้ไขข้อมูลโปรไฟล์</div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100" aria-label="close">
            <svg viewBox="0 0 24 24" className="h-5 w-5"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-2">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("info")}
              className={`rounded-xl px-4 py-2 text-sm ${tab === "info" ? "bg-gray-200 font-semibold" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              ข้อมูลส่วนตัว
            </button>
            <button
              onClick={() => setTab("password")}
              className={`rounded-xl px-4 py-2 text-sm ${tab === "password" ? "bg-green-100 font-semibold" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              เปลี่ยนรหัสผ่าน
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {tab === "info" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-600">ชื่อ</label>
                  <input className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                         value={firstName} onChange={(e)=>setFirstName(e.target.value)} placeholder="ชื่อ" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">นามสกุล</label>
                  <input className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                         value={lastName} onChange={(e)=>setLastName(e.target.value)} placeholder="นามสกุล" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-600">อีเมล (อ่านอย่างเดียว)</label>
                <input className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 text-gray-500"
                       value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email@example.com" disabled />
                <p className="mt-1 text-xs text-gray-500">ต้องการเปลี่ยนอีเมล? ให้ทำผ่านเมนูจัดการบัญชี (backend นี้ไม่รองรับแก้ใน endpoint นี้)</p>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-600">เบอร์โทรศัพท์</label>
                <input className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                       value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="08xxxxxxxx" />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={!!isConsent}
                  onChange={(e)=>setIsConsent(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                ยินยอมรับข่าวสาร/การติดต่อ (แก้ไขได้)
              </label>
            </div>
          )}

          {tab === "password" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-600">รหัสผ่านเดิม</label>
                <input type="password" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                       value={oldPassword} onChange={(e)=>setOldPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label>
                <input type="password" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                       value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">ยืนยันรหัสผ่านใหม่</label>
                <input type="password" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                       value={confirmNew} onChange={(e)=>setConfirmNew(e.target.value)} placeholder="••••••••" />
                {newPassword && confirmNew && newPassword !== confirmNew && (
                  <p className="pt-1 text-sm text-rose-600">รหัสผ่านใหม่และยืนยันไม่ตรงกัน</p>
                )}
              </div>
            </div>
          )}

          {serverMsg && (
            <div className="mt-4 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">{serverMsg}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 rounded-b-2xl bg-gray-50 px-6 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 hover:bg-gray-200">ยกเลิก</button>
          {tab === "info" ? (
            <button
              disabled={!canSaveInfo || loading}
              onClick={onSaveInfo}
              className={`rounded-xl px-4 py-2 text-white ${(!canSaveInfo || loading) ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          ) : (
            <button
              disabled={!canChangePw || loading}
              onClick={onChangePassword}
              className={`rounded-xl px-4 py-2 text-white ${(!canChangePw || loading) ? "bg-emerald-300" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              {loading ? "กำลังยืนยัน..." : "ยืนยัน"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}