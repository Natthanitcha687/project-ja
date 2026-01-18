// admin-sma/src/pages/Security.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

function fmtDT(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return "—";
  return d.toLocaleString("th-TH");
}

const PAGE_SIZE = 10;

function PageButton({ active, disabled, children, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={[
        "min-w-[38px] h-9 px-3 rounded-xl border text-sm font-semibold transition",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200",
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

export default function Security() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const r = await api.get("/admin/security/events");
      setEvents(r.data.events || []);
      setPage(1);
    } catch (e) {
      setEvents([]);
      setErr(e?.response?.data?.message || "โหลดเหตุการณ์ความปลอดภัยไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const total = events.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageEvents = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return events.slice(start, start + PAGE_SIZE);
  }, [events, safePage]);

  const pageItems = useMemo(() => buildPageItems(safePage, totalPages), [safePage, totalPages]);

  const showingFrom = total ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = total ? Math.min(safePage * PAGE_SIZE, total) : 0;

  return (
    <div className="text-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-slate-900">ตรวจสอบความปลอดภัย</div>
          {/* ✅ เพิ่ม contrast */}
          <div className="mt-1 text-sm text-slate-700">
            แสดงเหตุการณ์ด้านความปลอดภัย เช่น login fail, การเข้าถึงผิดปกติ
          </div>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-xl bg-sky-700 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-sky-800 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-200"
          aria-label="รีเฟรชรายการเหตุการณ์ความปลอดภัย"
        >
          รีเฟรช
        </button>
      </div>

      {err && (
        <div
          className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {err}
        </div>
      )}

      {/* Summary (pagination อยู่ใต้ตาราง) */}
      <div className="mt-4">
        {/* ✅ เพิ่ม contrast (แก้ text-slate-500/400) */}
        <div className="text-sm text-slate-700">
          {loading ? (
            <span role="status" aria-live="polite">
              กำลังโหลด…
            </span>
          ) : total ? (
            <>
              แสดง {showingFrom}-{showingTo} จาก {total} รายการ
              <span className="text-slate-700"> (หน้า {safePage}/{totalPages})</span>
            </>
          ) : (
            "ยังไม่มีเหตุการณ์"
          )}
        </div>
      </div>

      {/* ===== Mobile (Card list) ===== */}
      <div className="mt-4 md:hidden space-y-3">
        {pageEvents.map((e) => (
          <div key={e.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* ✅ เพิ่ม contrast */}
                <div className="text-xs text-slate-700">Time</div>
                <div className="text-sm font-semibold text-slate-900">{fmtDT(e.createdAt)}</div>
              </div>

              {/* ✅ Type: ตัวหนาอย่างเดียว (ไม่เป็น pill) */}
              <div className="shrink-0 max-w-[55%] text-xs font-bold text-slate-900 truncate" title={e.type}>
                {e.type}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <div>
                {/* ✅ เพิ่ม contrast */}
                <div className="text-xs text-slate-700">Email</div>
                <div className="text-sm text-slate-900 break-words">{e.email || "—"}</div>
              </div>

              <div>
                {/* ✅ เพิ่ม contrast */}
                <div className="text-xs text-slate-700">IP</div>
                <div className="text-sm text-slate-900 break-words">{e.ip || "—"}</div>
              </div>
            </div>
          </div>
        ))}

        {!pageEvents.length && !loading && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-slate-700">
            ยังไม่มีเหตุการณ์
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-slate-700" role="status" aria-live="polite">
            กำลังโหลด...
          </div>
        )}
      </div>

      {/* ===== Tablet/Desktop (Table) ===== */}
      <div className="mt-4 hidden md:block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm table-fixed">
          {/* ✅ เพิ่ม contrast */}
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="p-3 text-left w-[220px]" scope="col">
                Time
              </th>
              <th className="p-3 text-left w-[240px]" scope="col">
                Type
              </th>
              <th className="p-3 text-left" scope="col">
                Email
              </th>
              <th className="p-3 text-left w-[180px]" scope="col">
                IP
              </th>
            </tr>
          </thead>

          <tbody className="text-slate-900">
            {pageEvents.map((e) => (
              <tr key={e.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                <td className="p-3 whitespace-nowrap">{fmtDT(e.createdAt)}</td>

                {/* ✅ Type: ตัวหนาอย่างเดียว */}
                <td className="p-3">
                  <div className="truncate font-bold text-slate-900" title={e.type}>
                    {e.type}
                  </div>
                </td>

                <td className="p-3">
                  <div className="truncate text-slate-900" title={e.email || "—"}>
                    {e.email || "—"}
                  </div>
                </td>

                <td className="p-3">
                  <div className="truncate text-slate-900" title={e.ip || "—"}>
                    {e.ip || "—"}
                  </div>
                </td>
              </tr>
            ))}

            {!pageEvents.length && !loading && (
              <tr>
                <td className="p-3 text-slate-700" colSpan={4}>
                  ยังไม่มีเหตุการณ์
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td className="p-3 text-slate-700" colSpan={4} role="status" aria-live="polite">
                  กำลังโหลด...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination (ใต้ตาราง ชิดขวา) */}
      {totalPages > 1 && (
        <nav className="mt-3 flex justify-end" aria-label="Pagination">
          <div className="flex flex-wrap items-center gap-2">
            <PageButton
              disabled={loading || safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              ariaLabel="ไปหน้าก่อนหน้า"
            >
              ←
            </PageButton>

            {pageItems.map((it, idx) =>
              it === "…" ? (
                <span key={`e-${idx}`} className="px-2 text-slate-700" aria-hidden="true">
                  …
                </span>
              ) : (
                <PageButton
                  key={it}
                  active={it === safePage}
                  disabled={loading}
                  onClick={() => setPage(it)}
                  ariaLabel={`ไปหน้า ${it}`}
                >
                  {it}
                </PageButton>
              )
            )}

            <PageButton
              disabled={loading || safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              ariaLabel="ไปหน้าถัดไป"
            >
              →
            </PageButton>
          </div>
        </nav>
      )}

      {!loading && total >= 200 && (
        <div className="mt-3 text-xs text-slate-700">
          หมายเหตุ: ถ้า backend จำกัดจำนวนรายการ (เช่น 200 ล่าสุด) การกดเลขหน้าจะดูได้ภายในช่วงนี้เท่านั้น
          ถ้าต้องการดูเก่ากว่านี้ต้องเพิ่ม pagination ที่ backend (skip/take)
        </div>
      )}
    </div>
  );
}
