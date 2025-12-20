import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Security() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api.get("/admin/security/events").then((r) => setEvents(r.data.events || [])).catch(() => setEvents([]));
  }, []);

  return (
    <div>
      <div className="text-xl font-semibold">ตรวจสอบความปลอดภัย</div>
      <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="p-3 text-left">เวลา</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-white/10">
                <td className="p-3">{new Date(e.createdAt).toLocaleString()}</td>
                <td className="p-3">{e.type}</td>
                <td className="p-3">{e.email || "-"}</td>
                <td className="p-3">{e.ip || "-"}</td>
              </tr>
            ))}
            {!events.length && (
              <tr><td className="p-3 text-white/60" colSpan={4}>ยังไม่มีเหตุการณ์</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
