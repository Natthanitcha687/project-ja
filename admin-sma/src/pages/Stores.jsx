import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Stores() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);

  async function load() {
    const { data } = await api.get("/admin/stores", { params: { q } });
    setRows(data.stores || []);
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="text-xl font-semibold">จัดการร้านค้า</div>

      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          placeholder="ค้นหาร้าน/อีเมล..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button onClick={load} className="rounded-xl bg-white text-zinc-950 px-4 py-2 font-medium">
          ค้นหา
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Store</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="p-3">{u.id}</td>
                <td className="p-3">{u.storeProfile?.storeName || "-"}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.status}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="p-3 text-white/60" colSpan={4}>ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-white/60">
        (ปุ่มระงับ/รายละเอียดร้าน จะเพิ่มต่อจาก endpoint PATCH /admin/users/:id/status ได้เลย)
      </div>
    </div>
  );
}
