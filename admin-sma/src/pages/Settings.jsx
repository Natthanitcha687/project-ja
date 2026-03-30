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
    <div className="mx-auto max-w-2xl text-center py-12">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path d="M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">การตั้งค่าระบบ</h2>
            <p className="mt-2 text-slate-500 max-w-sm">
              ปัจจุบันระบบใช้การตั้งค่ารายบุคคลในขณะลบเป็นหลัก จึงไม่ต้องการการตั้งค่าส่วนกลางในส่วนนี้แล้ว
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
