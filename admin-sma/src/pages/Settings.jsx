import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { toast } from "react-hot-toast";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState(30);
  const [unit, setUnit] = useState("days"); // "days" or "months"
  const [inputValue, setInputValue] = useState(30);

  async function loadSettings() {
    try {
      const { data } = await api.get("/admin/settings");
      const d = Number(data.settings?.user_retention_days || 30);
      setDays(d);
      
      // เลือกหน่วยเริ่มต้นให้เหมาะสม
      if (d % 30 === 0 && d !== 0) {
        setUnit("months");
        setInputValue(d / 30);
      } else {
        setUnit("days");
        setInputValue(d);
      }
    } catch (e) {
      toast.error("โหลดการตั้งค่าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function onSave() {
    setSaving(true);
    try {
      const totalDays = unit === "months" ? inputValue * 30 : inputValue;
      await api.patch(`/admin/settings/user_retention_days`, { value: totalDays });
      setDays(totalDays);
      toast.success("บันทึกการตั้งค่าแล้ว");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">การตั้งค่าระบบ</h2>
          <p className="text-sm text-slate-500">จัดการนโยบายการเก็บรักษาข้อมูลและการทำงานของระบบ</p>
        </div>

        <div className="p-6 space-y-8">
          {/* Account Retention Section */}
          <section className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 ring-1 ring-rose-100">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900">ระยะเวลาเก็บรักษาข้อมูลที่ลบ (Retention Period)</h3>
                <p className="mt-1 text-sm text-slate-500">
                  กำหนดระยะเวลาที่ระบบจะเก็บข้อมูลบัญชีที่ถูกลบ (Soft Delete) ไว้ก่อนที่จะทำลายทิ้งถาวรจากฐานข้อมูล
                </p>
              </div>
            </div>

            <div className="ml-14 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={inputValue}
                  onChange={(e) => setInputValue(Number(e.target.value))}
                  className="w-24 rounded-xl border border-slate-200 px-4 py-2 text-center font-bold text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="days">วัน</option>
                  <option value="months">เดือน (30 วัน)</option>
                </select>
              </div>

              <div className="flex-1 rounded-xl bg-orange-50 border border-orange-100 p-3">
                <p className="text-xs text-orange-800 leading-relaxed font-medium">
                  บัญชีจะถูกลบถาวรหลังจากถูกลบไปแล้วและครบกำหนด{" "}
                  <span className="font-bold text-orange-950 underline decoration-orange-300">
                    {unit === "months" ? inputValue * 30 : inputValue} วัน
                  </span>
                </p>
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* Action Footer */}
          <div className="flex items-center justify-end">
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-sky-800 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  กำลังบันทึก...
                </>
              ) : (
                "💾 บันทึกการตั้งค่า"
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
