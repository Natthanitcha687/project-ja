// admin-sma/src/pages/Users.jsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Users() {
  const [role, setRole] = useState("CUSTOMER");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users", { params: { role, q } });
      setRows(data.users || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function suspend(id) {
    setErr("");
    try {
      await api.patch(`/admin/users/${id}/status`, {
        status: "SUSPENDED",
        reason: "Suspended by admin",
      });
      load();
    } catch (e) {
      setErr(e?.response?.data?.message || "Suspend ไม่สำเร็จ");
    }
  }

  async function activate(id) {
    setErr("");
    try {
      await api.patch(`/admin/users/${id}/status`, { status: "ACTIVE" });
      load();
    } catch (e) {
      setErr(e?.response?.data?.message || "Unsuspend ไม่สำเร็จ");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <div className="text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xl font-semibold text-slate-900">จัดการผู้ใช้งาน</div>

        {loading && (
          <div className="text-sm text-slate-500">
            กำลังโหลดข้อมูล…
          </div>
        )}
      </div>

      {/* Controls: Mobile = stack, Tablet/Desktop = row */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[220px_1fr_110px] items-center">
        <select
          className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="STORE">STORE</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        <input
          className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          placeholder="ค้นหาอีเมล..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load();
          }}
        />

        <button
          onClick={load}
          className="w-full rounded-xl bg-sky-700 text-white px-4 py-2 font-semibold shadow-sm hover:bg-sky-800 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={loading}
        >
          ค้นหา
        </button>
      </div>

      {err && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}

      {/* ===== Mobile (Card list) ===== */}
      <div className="mt-4 md:hidden space-y-3">
        {rows.map((u) => (
          <div
            key={u.id}
            className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-slate-500">ID</div>
                <div className="font-semibold text-slate-900">{u.id}</div>
              </div>

              <span
                className={[
                  "shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                  u.status === "SUSPENDED"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200",
                ].join(" ")}
              >
                {u.status}
              </span>
            </div>

            <div className="mt-3">
              <div className="text-sm text-slate-500">Email</div>
              <div className="font-medium text-slate-900 break-words">
                {u.email}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-slate-500">Role</div>
                <div className="font-medium text-slate-900">{u.role}</div>
              </div>
              <div className="flex items-end justify-end">
                {u.status !== "SUSPENDED" ? (
                  <button
                    onClick={() => suspend(u.id)}
                    className="w-full rounded-xl bg-rose-50 text-rose-700 border border-rose-200 px-3 py-2 text-sm font-semibold hover:bg-rose-100"
                    disabled={loading}
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    onClick={() => activate(u.id)}
                    className="w-full rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 text-sm font-semibold hover:bg-emerald-100"
                    disabled={loading}
                  >
                    Unsuspend
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {!rows.length && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-slate-500">
            ไม่มีข้อมูล
          </div>
        )}
      </div>

      {/* ===== Tablet/Desktop (Table) ===== */}
      <div className="mt-4 hidden md:block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left w-[80px]">ID</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left w-[120px]">Role</th>
              <th className="p-3 text-left w-[140px]">Status</th>
              <th className="p-3 text-left w-[160px]">Action</th>
            </tr>
          </thead>

          <tbody className="text-slate-800">
            {rows.map((u) => (
              <tr
                key={u.id}
                className="border-t border-slate-200 hover:bg-slate-50/70"
              >
                <td className="p-3">{u.id}</td>

                {/* กัน email ยาวดันจอ: ใช้ break + truncate */}
                <td className="p-3">
                  <div className="max-w-[520px] lg:max-w-[680px] truncate" title={u.email}>
                    {u.email}
                  </div>
                </td>

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
                  {u.status !== "SUSPENDED" ? (
                    <button
                      onClick={() => suspend(u.id)}
                      className="rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 font-semibold hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={loading}
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => activate(u.id)}
                      className="rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 font-semibold hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={loading}
                    >
                      Unsuspend
                    </button>
                  )}
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
