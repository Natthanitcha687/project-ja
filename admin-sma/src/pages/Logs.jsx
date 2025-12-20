import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Logs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get("/admin/logs").then((r) => setLogs(r.data.logs || [])).catch(() => setLogs([]));
  }, []);

  return (
    <div>
      <div className="text-xl font-semibold">Activity Logs</div>
      <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="p-3 text-left">เวลา</th>
              <th className="p-3 text-left">Action</th>
              <th className="p-3 text-left">Target</th>
              <th className="p-3 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-white/10">
                <td className="p-3">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="p-3">{l.action}</td>
                <td className="p-3">{l.targetType ? `${l.targetType}:${l.targetId}` : "-"}</td>
                <td className="p-3">{l.ip || "-"}</td>
              </tr>
            ))}
            {!logs.length && (
              <tr><td className="p-3 text-white/60" colSpan={4}>ยังไม่มี log</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
