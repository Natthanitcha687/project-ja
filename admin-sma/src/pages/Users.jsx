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
    await api.patch(`/admin/users/${id}/status`, {
      status: "SUSPENDED",
      reason: "Suspended by admin",
    });
    load();
  }
  async function activate(id) {
    await api.patch(`/admin/users/${id}/status`, { status: "ACTIVE" });
    load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <div className="text-slate-900">
      <div className="text-xl font-semibold text-slate-900">จัดการผู้ใช้งาน</div>

      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <select
          className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="STORE">STORE</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        <input
          className="flex-1 min-w-[220px] rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          placeholder="ค้นหาอีเมล..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <button
          onClick={load}
          className="rounded-xl bg-sky-700 text-white px-4 py-2 font-semibold shadow-sm hover:bg-sky-800"
        >
          ค้นหา
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>

          <tbody className="text-slate-800">
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                <td className="p-3">{u.id}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">
                  <span
                    className={[
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                      u.status === "SUSPENDED"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200",
                    ].join(" ")}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {u.status !== "SUSPENDED" ? (
                      <button
                        onClick={() => suspend(u.id)}
                        className="rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 font-semibold hover:bg-rose-100"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        onClick={() => activate(u.id)}
                        className="rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 font-semibold hover:bg-emerald-100"
                      >
                        Unsuspend
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={5}>
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
