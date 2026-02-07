// admin-sma/src/pages/Complaints.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";

const STATUS_META = {
  OPEN: { label: "ยังไม่ได้ตรวจสอบ", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  IN_PROGRESS: { label: "กำลังดำเนินการ", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  RESOLVED: { label: "แก้ไขแล้ว", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "ปฏิเสธ", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

const PAGE_SIZE = 10;

function fmtDT(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return "—";
  return d.toLocaleString("th-TH");
}

function clip(s, n = 90) {
  const t = (s || "").toString();
  if (t.length <= n) return t;
  return t.slice(0, n) + "…";
}

/**
 * ✅ เปลี่ยนจาก pill -> จุดสี + ข้อความ (ไม่กระทบ logic เดิม)
 */
function StatusPill({ status, className = "" }) {
  const meta = STATUS_META[status] || { label: status || "—" };

  const dotCls =
    status === "OPEN"
      ? "bg-amber-500"
      : status === "IN_PROGRESS"
        ? "bg-sky-500"
        : status === "RESOLVED"
          ? "bg-emerald-500"
          : status === "REJECTED"
            ? "bg-rose-500"
            : "bg-slate-400";

  // ✅ Use default text color if none provided, but allow override
  const defaultText = className.includes("text-") ? "" : "text-slate-800";

  return (
    <span className={["inline-flex items-center gap-2 text-xs font-semibold", defaultText, className].join(" ")}>
      <span className={["h-2.5 w-2.5 rounded-full", dotCls].join(" ")} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

function senderName(user) {
  if (!user) return "—";

  if (user.role === "CUSTOMER") {
    const cp = user.customerProfile || {};
    const full = `${cp.firstName || ""} ${cp.lastName || ""}`.trim();
    if (full) return full;
  }

  if (user.role === "STORE") {
    const sp = user.storeProfile || {};
    if (sp.storeName) return sp.storeName;
  }

  return user.email || "—";
}

function senderSub(user) {
  if (!user) return "";
  const email = user.email || "";
  const phone =
    user.role === "CUSTOMER"
      ? user.customerProfile?.phone || ""
      : user.role === "STORE"
        ? user.storeProfile?.phone || ""
        : "";
  const parts = [email, phone].filter(Boolean);
  return parts.join(" • ");
}

// ทำให้ path ใน DB (เช่น /uploads/complaints/xx.png) กลายเป็น URL ใช้งานได้
function absolutize(p) {
  if (!p) return "";
  const s = String(p);
  if (/^https?:\/\//i.test(s)) return s;

  const base = api?.defaults?.baseURL || "";
  if (!base) return s;

  const b = String(base).replace(/\/+$/, "");
  const tail = s.startsWith("/") ? s : `/${s}`;

  // ✅ ถ้าเป็น /uploads ให้เติม base URL เสมอ
  if (tail.startsWith('/uploads')) {
    return `${b}${tail}`;
  }

  return `${b}${tail}`;
}

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
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200",
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

export default function Complaints() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [selected, setSelected] = useState(null); // modal
  const [page, setPage] = useState(1);

  // a11y: focus management
  const lastActiveElRef = useRef(null);
  const closeBtnRef = useRef(null);

  const STATUS_SELECT_ID = "complaints-status";
  const SEARCH_INPUT_ID = "complaints-search";
  const HELP_ID = "complaints-controls-help";
  const MODAL_TITLE_ID = "complaint-modal-title";
  const MODAL_BODY_ID = "complaint-modal-body";

  function openModal(c) {
    lastActiveElRef.current = document.activeElement;
    setSelected(c);
  }

  function closeModal() {
    setSelected(null);
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/admin/complaints", { params: { status } });
      setRows(data.complaints || []);
      setPage(1);
    } catch (e) {
      setRows([]);
      setErr(e?.response?.data?.message || "โหลดรายการแจ้งปัญหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function setSt(id, st) {
    setErr("");
    try {
      await api.patch(`/admin/complaints/${id}/status`, { status: st });
      await load();

      // sync modal ถ้าเปิดอยู่
      setSelected((prev) =>
        prev && prev.id === id ? { ...prev, status: st, updatedAt: new Date().toISOString() } : prev
      );
    } catch (e) {
      setErr(e?.response?.data?.message || "อัปเดตสถานะไม่สำเร็จ");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // เปลี่ยนคำค้นหา -> กลับไปหน้า 1
  useEffect(() => {
    setPage(1);
  }, [q]);

  // ปิด modal ด้วย ESC
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") closeModal();
    }
    if (selected) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // a11y: when modal opens, focus close button; when closes, restore focus
  useEffect(() => {
    if (selected) {
      setTimeout(() => closeBtnRef.current?.focus?.(), 0);
      return;
    }
    const el = lastActiveElRef.current;
    if (el && typeof el.focus === "function") {
      setTimeout(() => el.focus(), 0);
    }
  }, [selected]);

  const filtered = useMemo(() => {
    const query = (q || "").trim().toLowerCase();
    if (!query) return rows;

    return (rows || []).filter((c) => {
      const user = c.user || {};
      const userHay = `${senderName(user)} ${senderSub(user)}`.toLowerCase();
      const hay = `${c.subject || ""} ${c.category || ""} ${c.message || ""} ${userHay}`.toLowerCase();
      return hay.includes(query);
    });
  }, [rows, q]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const pageItems = useMemo(() => buildPageItems(safePage, totalPages), [safePage, totalPages]);

  const showingFrom = total ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = total ? Math.min(safePage * PAGE_SIZE, total) : 0;

  return (
    <div className="text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-slate-900">แจ้งปัญหา</div>
          <div className="text-sm text-slate-600">ดูรายละเอียด, ผู้ส่ง, และจัดการสถานะการแจ้งปัญหา</div>
        </div>

        <div className="text-sm text-slate-600">
          ทั้งหมด: <span className="text-slate-900 font-semibold">{rows.length}</span> รายการ
        </div>
      </div>

      {/* a11y help (sr-only) */}
      <p id={HELP_ID} className="sr-only">
        เลือกสถานะเพื่อกรองรายการ, พิมพ์คำค้นหาเพื่อค้นหาในรายการ, และกดปุ่มรีเฟรชเพื่อโหลดข้อมูลใหม่
      </p>

      {/* Controls: 3 sizes */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[220px_1fr_110px] items-center">
        <div>
          <label htmlFor={STATUS_SELECT_ID} className="sr-only">
            กรองตามสถานะ
          </label>
          <select
            id={STATUS_SELECT_ID}
            name="status"
            aria-describedby={HELP_ID}
            className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            <option value="OPEN">Unchecked (ยังไม่ได้ตรวจสอบ)</option>
            <option value="IN_PROGRESS">IN_PROGRESS (กำลังดำเนินการ)</option>
            <option value="RESOLVED">RESOLVED (แก้ไขแล้ว)</option>
            <option value="REJECTED">REJECTED (ปฏิเสธ)</option>
          </select>
        </div>

        <div>
          <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
            ค้นหารายการแจ้งปัญหา
          </label>
          <input
            id={SEARCH_INPUT_ID}
            name="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-describedby={HELP_ID}
            className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            placeholder="ค้นหา ผู้ส่ง / หมวดหมู่ /หัวข้อ"
          />
        </div>

        <button
          type="button"
          onClick={load}
          aria-describedby={HELP_ID}
          className="w-full rounded-xl bg-white border border-slate-200 text-slate-700 px-6 py-2.5 font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-200"
          disabled={loading}
        >
          รีเฟรช
        </button>
      </div>

      {loading && (
        <div className="mt-2 text-sm text-slate-600" role="status" aria-live="polite">
          กำลังโหลด...
        </div>
      )}

      {err && (
        <div
          className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {err}
        </div>
      )}

      {/* Summary (pagination อยู่ใต้ตารางมุมขวาเหมือนเดิม) */}
      <div className="mt-4">
        <div className="text-sm text-slate-700">
          {loading ? (
            "กำลังโหลด…"
          ) : total ? (
            <>
              แสดง {showingFrom}-{showingTo} จาก {total} รายการ (ผลลัพธ์จากการค้นหา/ตัวกรอง)
              <span className="text-slate-600"> • หน้า {safePage}/{totalPages}</span>
            </>
          ) : (
            "ยังไม่มีการแจ้งปัญหา"
          )}
        </div>
      </div>

      {/* ===== Mobile + Tablet (Cards) ===== */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
        {pageRows.map((c) => {
          const attCount = Array.isArray(c.images) ? c.images.length : 0;
          return (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-600">{fmtDT(c.createdAt)}</div>
                  <div className="mt-1 font-semibold text-slate-900 break-words">{c.subject}</div>
                </div>
                {/* ✅ status เป็นจุดสี (force dark text for card) */}
                <StatusPill status={c.status} className="shrink-0 text-slate-800" />
              </div>

              <div className="mt-3">
                <div className="text-xs text-slate-600">ผู้ส่ง</div>
                <div className="font-medium text-slate-900 break-words">{senderName(c.user)}</div>
                <div className="text-xs text-slate-600 break-words">{senderSub(c.user)}</div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {c.category || "—"}
                </span>
                {attCount > 0 && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    <span aria-hidden="true">📎</span> <span className="ml-1">{attCount}</span>
                  </span>
                )}
              </div>

              <div className="mt-3 text-sm text-slate-800 whitespace-pre-wrap break-words">{clip(c.message, 140)}</div>

              {/* ✅ ลดปุ่ม: เหลือแค่ “รายละเอียด” */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => openModal(c)}
                  className="w-full rounded-xl bg-sky-50 text-sky-700 border border-sky-200 px-3 py-2 text-sm font-semibold hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  aria-label={`เปิดรายละเอียดคำร้อง: ${c.subject || "ไม่ระบุหัวข้อ"}`}
                >
                  รายละเอียด
                </button>
              </div>
            </div>
          );
        })}

        {!loading && !pageRows.length && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-slate-600 sm:col-span-2">
            ยังไม่มีการแจ้งปัญหา (ต้องมีฝั่ง user สร้าง complaint ก่อน)
          </div>
        )}
      </div>

      {/* ===== Desktop (Table) ===== */}
      <div className="mt-4 hidden lg:block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th scope="col" className="p-3 text-left w-[180px]">
                เวลา
              </th>
              <th scope="col" className="p-3 text-left w-[240px]">
                ผู้ส่ง
              </th>
              <th scope="col" className="p-3 text-left w-[160px]">
                หมวดหมู่
              </th>
              <th scope="col" className="p-3 text-left">
                หัวข้อ
              </th>
              <th scope="col" className="p-3 text-left">
                รายละเอียด (ย่อ)
              </th>
              <th scope="col" className="p-3 text-left w-[160px]">
                สถานะ
              </th>
              <th scope="col" className="p-3 text-left w-[180px]">
                การดำเนินการ
              </th>
            </tr>
          </thead>

          <tbody className="text-slate-900">
            {pageRows.map((c) => {
              const attCount = Array.isArray(c.images) ? c.images.length : 0;

              function onRowKeyDown(e) {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openModal(c);
                }
              }

              return (
                <tr
                  key={c.id}
                  className="border-t border-slate-200 hover:bg-slate-50/70 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-200"
                  onClick={() => openModal(c)}
                  onKeyDown={onRowKeyDown}
                  tabIndex={0}
                  role="button"
                  aria-label={`เปิดรายละเอียดคำร้อง: ${c.subject || "ไม่ระบุหัวข้อ"}`}
                  title="คลิกเพื่อดูรายละเอียด (กด Enter/Space ได้)"
                >
                  <td className="p-3 whitespace-nowrap">{fmtDT(c.createdAt)}</td>

                  <td className="p-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{senderName(c.user)}</div>
                      <div className="text-xs text-slate-600 truncate">{senderSub(c.user)}</div>
                    </div>
                  </td>

                  <td className="p-3 text-slate-800">
                    <div className="truncate" title={c.category || "—"}>
                      {c.category || "—"}
                    </div>
                  </td>

                  <td className="p-3">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate" title={c.subject}>
                        {c.subject}
                      </div>
                    </div>
                  </td>

                  <td className="p-3 text-slate-700">
                    <div className="truncate" title={c.message || ""}>
                      {clip(c.message, 90)}
                      {attCount > 0 && (
                        <span className="ml-2 text-xs text-slate-600">
                          <span aria-hidden="true">📎</span> {attCount}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ✅ status เป็นจุดสี (force dark text for table) */}
                  <td className="p-3">
                    <StatusPill status={c.status} className="text-slate-800" />
                  </td>

                  {/* ✅ ลดปุ่ม: เหลือแค่ “รายละเอียด” */}
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openModal(c)}
                      className="rounded-lg bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 font-semibold hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      aria-label={`เปิดรายละเอียดคำร้อง: ${c.subject || "ไม่ระบุหัวข้อ"}`}
                    >
                      รายละเอียด
                    </button>
                  </td>
                </tr>
              );
            })}

            {!loading && !pageRows.length && (
              <tr>
                <td className="p-3 text-slate-600" colSpan={7}>
                  ยังไม่มีการแจ้งปัญหา (ต้องมีฝั่ง user สร้าง complaint ก่อน)
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td className="p-3 text-slate-600" colSpan={7}>
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
                <span key={`e-${idx}`} className="px-2 text-slate-600" aria-hidden="true">
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

      {/* Modal รายละเอียด (โทนเข้ม) */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={closeModal} aria-hidden="true" />

          <div
            className="relative mx-auto mt-10 w-[min(980px,92vw)] rounded-2xl border border-white/10 bg-zinc-950 text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={MODAL_TITLE_ID}
            aria-describedby={MODAL_BODY_ID}
          >
            <div className="bg-white/5 px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div id={MODAL_TITLE_ID} className="text-lg font-semibold truncate text-white">
                  {selected.subject}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
                  <div>
                    ผู้ส่ง:{" "}
                    <span className="text-white font-semibold">{senderName(selected.user)}</span>{" "}
                    <span className="text-white/75">{senderSub(selected.user)}</span>
                  </div>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
                  <div>
                    หมวด: <span className="text-white/95">{selected.category || "—"}</span>
                  </div>
                  <div>สร้างเมื่อ: {fmtDT(selected.createdAt)}</div>
                  <div>อัปเดต: {fmtDT(selected.updatedAt)}</div>
                  <div className="text-white/60">ID: {selected.id}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusPill status={selected.status} className="text-white/90" />
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  ปิด
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div id={MODAL_BODY_ID}>
                <div className="text-sm font-semibold text-white/90">รายละเอียด</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/90 whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>

              {/* รูปแนบอ้างอิงปัญหา */}
              {Array.isArray(selected.images) && selected.images.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-white/90">รูปแนบอ้างอิง ({selected.images.length})</div>

                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {selected.images.map((p, idx) => {
                      const src = absolutize(p);
                      return (
                        <a
                          key={`${p}-${idx}`}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                          className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30"
                          title="คลิกเพื่อเปิดรูปเต็ม"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="aspect-square w-full overflow-hidden">
                            <img
                              src={src}
                              alt={`complaint-${selected.id}-img-${idx + 1}`}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                              loading="lazy"
                            />
                          </div>
                          <div className="px-3 py-2 text-[11px] text-white/75 truncate">{String(p)}</div>
                        </a>
                      );
                    })}
                  </div>

                  <div className="mt-2 text-xs text-white/70">* คลิกรูปเพื่อเปิดดูแบบเต็ม (เปิดแท็บใหม่)</div>
                </div>
              )}

              {/* ✅ การเปลี่ยนสถานะ “ยังทำได้ตามเดิม” (ย้ายไปอยู่ใน modal เท่านั้น) */}
              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSt(selected.id, "IN_PROGRESS")}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  เริ่มดำเนินการ
                </button>
                <button
                  type="button"
                  onClick={() => setSt(selected.id, "RESOLVED")}
                  className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm hover:bg-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
                >
                  แก้ไขเสร็จสิ้น
                </button>
                <button
                  type="button"
                  onClick={() => setSt(selected.id, "REJECTED")}
                  className="rounded-xl bg-red-500/20 px-4 py-2 text-sm hover:bg-red-500/25 focus:outline-none focus:ring-2 focus:ring-red-300/30"
                >
                  ปฏิเสธคำร้อง
                </button>
              </div>

              <div className="text-xs text-white/70">* คลิกพื้นหลังหรือกด ESC เพื่อปิดหน้าต่างนี้</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
