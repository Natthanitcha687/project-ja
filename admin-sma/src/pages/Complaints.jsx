import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Complaints() {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);

  async function load() {
    const { data } = await api.get("/admin/complaints", { params: { status } });
    setRows(data.complaints || []);
  }

  async function setSt(id, st) {
    await api.patch(`/admin/complaints/${id}/status`, { status: st });
    load();
  }

  useEffect(() => { load(); }, [status]);

  return (
    <div>
      <div className="text-xl font-semibold">คำขอ/ร้องเรียน</div>

      <div className="mt-4 flex gap-2 items-center">
        <select
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">ทั้งหมด</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
        <button onClick={load} className="rounded-xl bg-white text-zinc-950 px-4 py-2 font-medium">รีเฟรช</button>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="p-3 text-left">เวลา</th>
              <th className="p-3 text-left">Subject</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-white/10">
                <td className="p-3">{new Date(c.createdAt).toLocaleString()}</td>
                <td className="p-3">{c.subject}</td>
                <td className="p-3">{c.status}</td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => setSt(c.id, "IN_PROGRESS")} className="rounded-lg bg-white/10 px-3 py-1">รับเรื่อง</button>
                  <button onClick={() => setSt(c.id, "RESOLVED")} className="rounded-lg bg-emerald-500/20 px-3 py-1">ปิดเคส</button>
                  <button onClick={() => setSt(c.id, "REJECTED")} className="rounded-lg bg-red-500/20 px-3 py-1">ปฏิเสธ</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="p-3 text-white/60" colSpan={4}>ยังไม่มีคำขอ/ร้องเรียน (ต้องมีฝั่ง user สร้าง complaint ก่อน)</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
