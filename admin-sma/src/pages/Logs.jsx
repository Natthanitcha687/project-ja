import { useEffect, useState } from "react";
import { api } from "../lib/api";

function fmtDT(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return "—";
  return d.toLocaleString("th-TH");
}

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/admin/audit/logs") // ✅ FIX: endpoint ให้ตรงกับ backend
      .then((r) => setLogs(r.data.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="text-slate-900">
      <div className="text-xl font-semibold text-slate-900">Activity Logs</div>
      <div className="mt-1 text-sm text-slate-500">
        บันทึกการกระทำสำคัญในระบบ (ใครทำอะไร เมื่อไหร่ จาก IP ไหน)
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left w-[200px]">Time</th>
              <th className="p-3 text-left w-[260px]">Action</th>
              <th className="p-3 text-left">Target</th>
              <th className="p-3 text-left w-[180px]">IP</th>
            </tr>
          </thead>

          <tbody className="text-slate-800">
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                <td className="p-3">{fmtDT(l.createdAt)}</td>
                <td className="p-3">
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {l.action}
                  </span>
                </td>
                <td className="p-3 text-slate-700">
                  {l.targetType ? (
                    <span className="font-medium text-slate-900">
                      {l.targetType}:{l.targetId}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-slate-800">{l.ip || "—"}</td>
              </tr>
            ))}

            {!logs.length && !loading && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={4}>
                  ยังไม่มี log
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
