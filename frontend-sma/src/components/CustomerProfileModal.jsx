import { useEffect, useMemo, useRef, useState } from "react";
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
  const { loadMe } = useAuth(); // allow refreshing current user after update

  const [tab, setTab] = useState("info"); // 'info' | 'password'
  const [loading, setLoading] = useState(false);
  const [serverMsg, setServerMsg] = useState("");

  // ---- ฟอร์ม ข้อมูลส่วนตัว ----
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(""); // read-only (backend ไม่รองรับแก้)
  const [phone, setPhone] = useState("");
  const [isConsent, setIsConsent] = useState(false);
  const profileImageInputRef = useRef(null)
  const [profileImage, setProfileImage] = useState({ file: null, preview: '' })

  // ✅ วันแจ้งเตือนใกล้หมดประกัน
  const [notifyDaysArray, setNotifyDaysArray] = useState([15]) // default 15 วัน
  const availableNotifyDays = [15, 7, 3, 1]

  // ---- ฟอร์ม เปลี่ยนรหัสผ่าน ----
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");

  const canSaveInfo = useMemo(() => {
    // ต้องกดยืนยัน (ติ๊ก checkbox) จึงจะบันทึกได้
    return (
      isConsent === true &&
      ((firstName?.trim() !== "") ||
        (lastName?.trim() !== "") ||
        (phone?.trim() !== ""))
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
        setProfileImage({ file: null, preview: data?.avatarUrl || "" });
        // ✅ โหลดวันแจ้งเตือน
        setNotifyDaysArray(data?.notifyDaysArray?.length > 0 ? data.notifyDaysArray : [15])
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
    setProfileImage({ file: null, preview: "" });
    onClose?.();
  };

  const onSaveInfo = async () => {
    if (!canSaveInfo) return;
    setLoading(true);
    setServerMsg("");
    try {
      const payload = {
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        phone: phone?.trim(),
        isConsent: !!isConsent,
        notifyDaysArray, // ✅ ส่งวันแจ้งเตือน
        // ส่ง avatarUrl ทุกครั้ง:
        // - มีรูป -> dataURL
        // - ไม่มีรูป -> null (ให้ backend เคลียร์รูป)
        avatarUrl: profileImage.preview || null,
      };

      await api.patch(endpoints.profile, payload);
      // refresh authenticated user so header/avatar gets updated
      try { await loadMe(); } catch (e) { /* ignore */ }
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

  const handleProfileAvatarSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setProfileImage({ file, preview: reader.result })
      }
    }
    reader.readAsDataURL(file)
  }

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
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-auto bg-black/30 px-4 py-8">
      <div className="w-full max-w-lg rounded-3xl border border-sky-200 bg-white shadow-2xl max-h-[90vh] overflow-hidden">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-sky-100 px-6 py-4 bg-white">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-sky-200 text-2xl overflow-hidden">
              {profileImage.preview ? (
                <img
                  src={profileImage.preview}
                  alt="รูปโปรไฟล์ลูกค้า"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span role="img" aria-label="avatar">
                  👤
                </span>
              )}
            </div>
            <div>
              <div className="text-base font-semibold text-gray-900">แก้ไขข้อมูลส่วนตัว</div>
              <div className="text-xs text-sky-600">ข้อมูลจะใช้แสดงในใบรับประกัน</div>
            </div>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600" aria-label="close">
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("info")}
              className={`flex-1 rounded-2xl px-4 py-2 text-sm font-medium ${tab === "info" ? 'bg-sky-100 text-sky-700' : 'bg-sky-50 text-gray-500'}`}
            >
              ข้อมูลส่วนตัว
            </button>
            <button
              onClick={() => setTab("password")}
              className={`flex-1 rounded-2xl px-4 py-2 text-sm font-medium ${tab === "password" ? 'bg-sky-100 text-sky-700' : 'bg-sky-50 text-gray-500'}`}
            >
              เปลี่ยนรหัสผ่าน
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 220px)' }}>
          {tab === "info" && (
            <div className="space-y-4">
              {/* Avatar + ปุ่มอัปโหลด */}
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-sky-200 text-2xl overflow-hidden border border-sky-300">
                    {profileImage.preview ? (
                      // แสดงรูปโปรไฟล์ที่อัปโหลดหรือที่เคยบันทึกไว้
                      // ใช้ object-cover เพื่อไม่ให้ภาพเบี้ยว
                      <img
                        src={profileImage.preview}
                        alt="รูปโปรไฟล์ลูกค้า"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span role="img" aria-label="avatar">
                        👤
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-sm text-slate-700">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => profileImageInputRef.current?.click()}
                      className="rounded-full bg-sky-600 px-4 py-1.5 text-sm font-medium text-white shadow hover:bg-sky-700"
                    >
                      เปลี่ยนรูปโปรไฟล์
                    </button>
                    {profileImage.preview && (
                      <button
                        type="button"
                        onClick={() => setProfileImage({ file: null, preview: "" })}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        ลบรูปภาพ
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    รองรับไฟล์รูปภาพเช่น JPG, PNG ขนาดไม่เกินประมาณ 10MB
                  </p>
                  {/* input file แบบซ่อน */}
                  <input
                    type="file"
                    accept="image/*"
                    ref={profileImageInputRef}
                    className="hidden"
                    onChange={handleProfileAvatarSelect}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-600">ชื่อ</label>
                  <input className="mt-1 w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none bg-sky-50/60"
                    value={firstName} onChange={(e) => setFirstName(e.target.value.replace(/[^a-zA-Z0-9ก-๙\s.\-]/g, ''))} placeholder="ชื่อ" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">นามสกุล</label>
                  <input className="mt-1 w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none bg-sky-50/60"
                    value={lastName} onChange={(e) => setLastName(e.target.value.replace(/[^a-zA-Z0-9ก-๙\s.\-]/g, ''))} placeholder="นามสกุล" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-600">อีเมล </label>
                <input className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-2 text-sm text-gray-500 bg-slate-200 cursor-not-allowed"
                  value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" disabled />

              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-600">เบอร์โทรศัพท์</label>
                <input className="mt-1 w-full rounded-2xl border border-sky-100 px-4 py-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none bg-sky-50/60"
                  value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} maxLength={10} placeholder="08xxxxxxxx" />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!!isConsent}
                  onChange={(e) => setIsConsent(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span>ยืนยันข้อมูลถูกต้อง <span className="text-rose-500">*</span></span>
              </label>
              {!isConsent && (
                <p className="text-xs text-rose-500 mt-1">กรุณาติ๊กยืนยันเพื่อดำเนินการต่อ</p>
              )}

              {/* ✅ เลือกวันแจ้งเตือนใกล้หมดประกัน */}
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">🔔 แจ้งเตือนก่อนหมดประกัน</label>
                <p className="text-xs text-slate-500 mb-3">เลือกวันที่ต้องการรับแจ้งเตือน (ไม่เลือก = แจ้ง 15 วันก่อน)</p>
                <div className="flex flex-wrap gap-2">
                  {availableNotifyDays.map(day => (
                    <label key={day} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${notifyDaysArray.includes(day)
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300'
                      }`}>
                      <input
                        type="checkbox"
                        checked={notifyDaysArray.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNotifyDaysArray([...notifyDaysArray, day].sort((a, b) => b - a))
                          } else {
                            setNotifyDaysArray(notifyDaysArray.filter(d => d !== day))
                          }
                        }}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{day} วัน</span>
                    </label>
                  ))}
                </div>
                {notifyDaysArray.length === 0 && (
                  <p className="text-xs text-slate-500 mt-2 italic">* ระบบจะแจ้งเตือน 15 วันก่อนหมดอัตโนมัติ</p>
                )}
              </div>
            </div>
          )}

          {tab === "password" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-600">รหัสผ่านเดิม</label>
                <input type="password" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                  value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label>
                <input type="password" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">ยืนยันรหัสผ่านใหม่</label>
                <input type="password" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                  value={confirmNew} onChange={(e) => setConfirmNew(e.target.value)} placeholder="••••••••" />
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
        <div className="sticky bottom-0 z-40 flex items-center justify-end gap-2 rounded-b-2xl bg-gray-50 px-6 py-4">
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