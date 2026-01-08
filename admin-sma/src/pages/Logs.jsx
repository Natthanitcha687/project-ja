// admin-sma/src/pages/Logs.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

function fmtDT(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return "—";
  return d.toLocaleString("th-TH");
}

const PAGE_SIZE = 10;

function PageButton({ active, disabled, children, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={[
        "min-w-[38px] h-9 px-3 rounded-xl border text-sm font-semibold transition",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50",
        active
          ? "bg-sky-700 text-white border-sky-700 hover:bg-sky-800"
          : "bg-white text-slate-700 border-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function buildPageItems(current, total) {
  // แสดงเลขหน้าแบบไม่รก: 1 ... (current-1 current current+1) ... total
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items = new Set([1, total, current, current - 1, current + 1]);
  const arr = [...items]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);

  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const n = arr[i];
    const prev = arr[i - 1];
    if (i > 0 && n - prev > 1) out.push("…");
    out.push(n);
  }
  return out;
}

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const r = await api.get("/admin/audit/logs"); // endpoint ตรง backend แล้ว
      setLogs(r.data.logs || []);
      setPage(1); // โหลดใหม่ให้กลับไปหน้า 1
    } catch (e) {
      setLogs([]);
      setErr(e?.response?.data?.message || "โหลด logs ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const total = logs.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageLogs = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return logs.slice(start, start + PAGE_SIZE);
  }, [logs, safePage]);

  const pageItems = useMemo(
    () => buildPageItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const showingFrom = total ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = total ? Math.min(safePage * PAGE_SIZE, total) : 0;

  return (
    <div className="text-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-slate-900">Activity Logs</div>
          <div className="mt-1 text-sm text-slate-500">
            บันทึกการกระทำสำคัญในระบบ (ใครทำอะไร เมื่อไหร่ จาก IP ไหน)
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="rounded-xl bg-sky-700 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-sky-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          รีเฟรช
        </button>
      </div>

      {err && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}

      {/* Summary + Pagination */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          {loading ? (
            "กำลังโหลด…"
          ) : total ? (
            <>
              แสดง {showingFrom}-{showingTo} จาก {total} รายการ
              <span className="text-slate-400"> (หน้า {safePage}/{totalPages})</span>
            </>
          ) : (
            "ยังไม่มี log"
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <PageButton
            disabled={loading || safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ←
          </PageButton>

          {pageItems.map((it, idx) =>
            it === "…" ? (
              <span key={`e-${idx}`} className="px-2 text-slate-500">
                …
              </span>
            ) : (
              <PageButton
                key={it}
                active={it === safePage}
                disabled={loading}
                onClick={() => setPage(it)}
              >
                {it}
              </PageButton>
            )
          )}

          <PageButton
            disabled={loading || safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            →
          </PageButton>
        </div>
      </div>

      {/* ===== Mobile (Card list) ===== */}
      <div className="mt-4 md:hidden space-y-3">
        {pageLogs.map((l) => (
          <div key={l.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Time</div>
                <div className="text-sm font-semibold text-slate-900">{fmtDT(l.createdAt)}</div>
              </div>

              <span className="shrink-0 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {l.action}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-slate-500">Target</div>
                <div className="text-sm text-slate-800 break-words">
                  {l.targetType ? (
                    <span className="font-medium text-slate-900">
                      {l.targetType}:{l.targetId}
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">IP</div>
                <div className="text-sm text-slate-800 break-words">{l.ip || "—"}</div>
              </div>
            </div>
          </div>
        ))}

        {!pageLogs.length && !loading && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-slate-500">
            ยังไม่มี log
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-slate-500">
            กำลังโหลด...
          </div>
        )}
      </div>

      {/* ===== Tablet/Desktop (Table) ===== */}
      <div className="mt-4 hidden md:block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left w-[220px]">Time</th>
              <th className="p-3 text-left w-[260px]">Action</th>
              <th className="p-3 text-left">Target</th>
              <th className="p-3 text-left w-[180px]">IP</th>
            </tr>
          </thead>

          <tbody className="text-slate-800">
            {pageLogs.map((l) => (
              <tr key={l.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                <td className="p-3 whitespace-nowrap">{fmtDT(l.createdAt)}</td>

                <td className="p-3">
                  <span
                    className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 truncate align-middle"
                    title={l.action}
                  >
                    {l.action}
                  </span>
                </td>

                <td className="p-3 text-slate-700">
                  <div className="truncate" title={l.targetType ? `${l.targetType}:${l.targetId}` : "—"}>
                    {l.targetType ? (
                      <span className="font-medium text-slate-900">
                        {l.targetType}:{l.targetId}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                </td>

                <td className="p-3 text-slate-800">
                  <div className="truncate" title={l.ip || "—"}>
                    {l.ip || "—"}
                  </div>
                </td>
              </tr>
            ))}

            {!pageLogs.length && !loading && (
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

      {/* Note about backend cap */}
      {!loading && total >= 200 && (
        <div className="mt-3 text-xs text-slate-500">
          หมายเหตุ: ตอนนี้ระบบดึงมาเฉพาะรายการล่าสุด 200 รายการจาก backend ถ้าต้องการดูเก่ากว่านี้ต้องเพิ่ม pagination ที่ backend (skip/take)
        </div>
      )}
    </div>
  );
}
