import { useEffect, useState } from "react";
import { api } from "../lib/api";

function fmtDT(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return "—";
  return d.toLocaleString("th-TH");
}

export default function Security() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/admin/security/events")
      .then((r) => setEvents(r.data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="text-slate-900">
      <div className="text-xl font-semibold text-slate-900">ตรวจสอบความปลอดภัย</div>
      <div className="mt-1 text-sm text-slate-500">
        แสดงเหตุการณ์ด้านความปลอดภัย เช่น login fail, การเข้าถึงผิดปกติ ฯลฯ
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left w-[200px]">Time</th>
              <th className="p-3 text-left w-[240px]">Type</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left w-[180px]">IP</th>
            </tr>
          </thead>

          <tbody className="text-slate-800">
            {events.map((e) => (
              <tr key={e.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                <td className="p-3">{fmtDT(e.createdAt)}</td>
                <td className="p-3">
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {e.type}
                  </span>
                </td>
                <td className="p-3 text-slate-800">{e.email || "—"}</td>
                <td className="p-3 text-slate-800">{e.ip || "—"}</td>
              </tr>
            ))}

            {!events.length && !loading && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={4}>
                  ยังไม่มีเหตุการณ์
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={4}>
                  กำลังโหลด...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
