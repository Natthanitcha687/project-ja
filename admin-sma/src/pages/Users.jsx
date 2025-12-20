import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Users() {
  const [role, setRole] = useState("CUSTOMER");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);

  async function load() {
    const { data } = await api.get("/admin/users", { params: { role, q } });
    setRows(data.users || []);
  }

  async function suspend(id) {
    await api.patch(`/admin/users/${id}/status`, { status: "SUSPENDED", reason: "Suspended by admin" });
    load();
  }
  async function activate(id) {
    await api.patch(`/admin/users/${id}/status`, { status: "ACTIVE" });
    load();
  }

  useEffect(() => { load(); }, [role]);

  return (
    <div>
      <div className="text-xl font-semibold">จัดการผู้ใช้งาน</div>

      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <select
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="STORE">STORE</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        <input
          className="flex-1 min-w-[220px] rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          placeholder="ค้นหาอีเมล..."
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
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="p-3">{u.id}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">{u.status}</td>
                <td className="p-3 flex gap-2">
                  {u.status !== "SUSPENDED" ? (
                    <button onClick={() => suspend(u.id)} className="rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-1">
                      ระงับ
                    </button>
                  ) : (
                    <button onClick={() => activate(u.id)} className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1">
                      ปลดระงับ
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="p-3 text-white/60" colSpan={5}>ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
