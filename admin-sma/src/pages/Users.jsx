// admin-sma/src/pages/Users.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { stripEmojis, stripEmojisAndSpecials } from "../lib/text";

const ROLE_LOCK = "CUSTOMER";
const PAGE_SIZE = 10;

function clsx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function fmtDT(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return "—";
  return d.toLocaleString("th-TH");
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

/** ✅ เปลี่ยนการแสดง Status เป็น “จุด + ข้อความไทย” (ไม่กระทบ logic) */
function statusMeta(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return { label: "ใช้งานอยู่", dot: "bg-emerald-500" };
  if (s === "SUSPENDED") return { label: "ถูกระงับ", dot: "bg-rose-500" };
  if (!s) return { label: "—", dot: "bg-slate-400" };
  return { label: s, dot: "bg-slate-400" };
}

function StatusDot({ status, className = "" }) {
  const meta = statusMeta(status);
  return (
    <span className={clsx("inline-flex items-center gap-2", className)} title={meta.label}>
      <span className={clsx("h-2.5 w-2.5 rounded-full", meta.dot)} aria-hidden="true" />
      <span className="text-xs font-semibold text-slate-800">{meta.label}</span>
    </span>
  );
}

export default function Users() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ✅ Status filter (เพิ่มใหม่) : "" | ACTIVE | SUSPENDED
  const [status, setStatus] = useState("");

  // ✅ Pagination
  const [page, setPage] = useState(1);

  // Suspend modal
  const [openSuspend, setOpenSuspend] = useState(false);
  const [sTarget, setSTarget] = useState(null);
  const [sDaysPreset, setSDaysPreset] = useState(7);
  const [sDaysCustom, setSDaysCustom] = useState("");
  const [sUseCustom, setSUseCustom] = useState(false);
  // เหตุผลระงับ: radio + อื่นๆ
  const [sReason, setSReason] = useState("");
  const [sReasonOther, setSReasonOther] = useState("");
  const suspendReasons = [
    { value: "ละเมิดข้อตกลงการใช้งาน", label: "ละเมิดข้อตกลงการใช้งาน" },
    { value: "ใช้ข้อมูลเท็จในการสมัคร", label: "ใช้ข้อมูลเท็จในการสมัคร" },
    { value: "มีพฤติกรรมไม่เหมาะสม/รบกวนผู้อื่น", label: "มีพฤติกรรมไม่เหมาะสม/รบกวนผู้อื่น" },
    { value: "คำขอจากเจ้าของบัญชี", label: "คำขอจากเจ้าของบัญชี" },
    { value: "other", label: "อื่นๆ (โปรดระบุ)" },
  ];

  // ✅ Unsuspend confirm modal
  const [openUnsuspend, setOpenUnsuspend] = useState(false);
  const [uTarget, setUTarget] = useState(null);

  // Delete modal
  const [openDelete, setOpenDelete] = useState(false);
  const [dTarget, setDTarget] = useState(null);

  // Restore modal
  const [openRestore, setOpenRestore] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [rSubmitting, setRSubmitting] = useState(false);
  // เหตุผลลบ: radio + อื่นๆ
  const [dReason, setDReason] = useState("");
  const [dReasonOther, setDReasonOther] = useState("");
  const deleteReasons = [
    { value: "ละเมิดข้อตกลงการใช้งาน", label: "ละเมิดข้อตกลงการใช้งาน" },
    { value: "ใช้ข้อมูลเท็จในการสมัคร", label: "ใช้ข้อมูลเท็จในการสมัคร" },
    { value: "มีพฤติกรรมไม่เหมาะสม/รบกวนผู้อื่น", label: "มีพฤติกรรมไม่เหมาะสม/รบกวนผู้อื่น" },
    { value: "คำขอจากเจ้าของบัญชี", label: "คำขอจากเจ้าของบัญชี" },
    { value: "other", label: "อื่นๆ (โปรดระบุ)" },
  ];

  // ✅ บังคับเหตุผลก่อนกดได้ (เฉพาะส่วนที่เกี่ยวกับเหตุผล)
  const sReasonTrim = sReason === "other" ? sReasonOther.trim() : (sReason || "").trim();
  const dReasonTrim = dReason === "other" ? dReasonOther.trim() : (dReason || "").trim();

  const role = ROLE_LOCK;

  // a11y ids (แก้ Select ไม่มี label + เพิ่มความชัดเจน)
  const STATUS_SELECT_ID = "users-status";
  const SEARCH_INPUT_ID = "users-search";
  const HELP_ID = "users-controls-help";

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users", { params: { role, q } });
      // กันหลุด: แม้ backend รับ role อื่น ให้กรองซ้ำใน UI
      const onlyCustomers = (data.users || []).filter((u) => u.role === "CUSTOMER");
      setRows(onlyCustomers);
      setPage(1); // ✅ โหลดใหม่กลับหน้า 1
    } catch (e) {
      setErr(e?.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ");
      setRows([]);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }

  function openSuspendModal(u) {
    setSTarget(u);
    setOpenSuspend(true);
    setSDaysPreset(7);
    setSUseCustom(false);
    setSDaysCustom("");
    setSReason("");
  }

  function openUnsuspendModal(u) {
    setUTarget(u);
    setOpenUnsuspend(true);
  }

  function openDeleteModal(u) {
    setDTarget(u);
    setOpenDelete(true);
    setDReason("");
  }

  function openRestoreModal(u) {
    setRestoreTarget(u);
    setOpenRestore(true);
  }

  async function doUnsuspendConfirm() {
    if (!uTarget) return;
    setErr("");
    setLoading(true);
    try {
      await api.patch(`/admin/users/${uTarget.id}/status`, { status: "ACTIVE" });
      setOpenUnsuspend(false);
      setUTarget(null);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || "ปลดระงับไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function doSuspend() {
    if (!sTarget) return;
    setErr("");

    // ✅ บังคับต้องมีเหตุผลก่อนระงับ
    if (!sReasonTrim) {
      setErr("กรุณาระบุเหตุผล");
      return;
    }

    const daysNum = sUseCustom ? Number(String(sDaysCustom || "").trim()) : Number(sDaysPreset);

    const payload = {
      status: "SUSPENDED",
      reason: sReason === "other" ? sReasonOther.trim() : sReason,
      days: Number.isFinite(daysNum) && daysNum > 0 ? daysNum : null,
    };

    setLoading(true);
    try {
      await api.patch(`/admin/users/${sTarget.id}/status`, payload);
      setOpenSuspend(false);
      setSTarget(null);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || "ระงับไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function doDelete() {
    if (!dTarget) return;
    setErr("");

    // ✅ บังคับต้องมีเหตุผลก่อนลบ
    if (!dReasonTrim) {
      setErr("กรุณาระบุเหตุผลในการลบ");
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/admin/customers/${dTarget.id}`, {
        data: { reason: dReason === "other" ? dReasonOther.trim() : dReason },
      });
      setOpenDelete(false);
      setDTarget(null);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || "ลบลูกค้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function submitRestore() {
    if (!restoreTarget) return;
    setErr("");
    setRSubmitting(true);
    try {
      await api.post(`/admin/users/${restoreTarget.id}/restore`);
      setOpenRestore(false);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || "กู้คืนไม่สำเร็จ");
    } finally {
      setRSubmitting(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ ใช้ viewRows เพื่อให้ dropdown กรองได้เหมือนหน้าร้านค้า
  const viewRows = useMemo(() => {
    if (!status) return rows;
    return (rows || []).filter((u) => String(u.status) === status);
  }, [rows, status]);

  // ✅ เปลี่ยนฟิลเตอร์ -> กลับหน้า 1
  useEffect(() => {
    setPage(1);
  }, [status]);

  // ✅ Pagination derived
  const total = viewRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return viewRows.slice(start, start + PAGE_SIZE);
  }, [viewRows, safePage]);

  const pageItems = useMemo(() => buildPageItems(safePage, totalPages), [safePage, totalPages]);

  const showingFrom = total ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = total ? Math.min(safePage * PAGE_SIZE, total) : 0;

  return (
    <div className="text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xl font-semibold text-slate-900">จัดการลูกค้า</div>

          {/* ✅ เพิ่ม contrast + แก้ span.font-semibold ที่โดน Lighthouse ชี้ */}
          <div className="mt-1 text-sm text-slate-600">
            หน้านี้แสดงเฉพาะผู้ใช้ประเภท{" "}
            <span className="font-semibold text-slate-900">CUSTOMER</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {loading && (
            <div className="text-slate-600" role="status" aria-live="polite">
              กำลังโหลด…
            </div>
          )}
        </div>
      </div>

      {/* a11y help (sr-only) */}
      <p id={HELP_ID} className="sr-only">
        เลือกสถานะเพื่อกรองรายการ, พิมพ์คำค้นหาเพื่อค้นหาอีเมล, และกดปุ่มรีเฟรชเพื่อโหลดข้อมูลใหม่
      </p>

      {/* ✅ Filter row: dropdown + search (เหมือนหน้าร้านค้า) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div>
          {/* ✅ label for select (แก้ Lighthouse) */}
          <label htmlFor={STATUS_SELECT_ID} className="sr-only">
            กรองตามสถานะลูกค้า
          </label>
          <select
            id={STATUS_SELECT_ID}
            name="status"
            aria-describedby={HELP_ID}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">ลูกค้าทั้งหมด</option>
            <option value="ACTIVE">ใช้งานอยู่</option>
            <option value="SUSPENDED">ถูกระงับ</option>
          </select>
        </div>

        <div className="flex flex-1 items-center gap-2">
          {/* ✅ label for input (ดีต่อ a11y) */}
          <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
            ค้นหาอีเมลลูกค้า
          </label>
          <input
            id={SEARCH_INPUT_ID}
            name="q"
            type="search"
            className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            placeholder="ค้นหาอีเมลลูกค้า..."
            value={q}
            onChange={(e) => setQ(stripEmojisAndSpecials(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
            aria-describedby={HELP_ID}
          />

          {/* ✅ ปุ่มรีเฟรช */}
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-200"
            disabled={loading}
            title="รีเฟรชรายการ"
            aria-describedby={HELP_ID}
          >
            รีเฟรช
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {err}
        </div>
      )}

      {/* ✅ Summary */}
      <div className="mt-4">
        <div className="text-sm text-slate-700">
          {loading ? (
            "กำลังโหลด…"
          ) : total ? (
            <>
              แสดง {showingFrom}-{showingTo} จาก {total} รายการ
              {/* ✅ แก้ contrast จาก slate-400 -> slate-600 */}
              <span className="text-slate-600"> • หน้า {safePage}/{totalPages}</span>
            </>
          ) : (
            "ไม่มีข้อมูลลูกค้า"
          )}
        </div>
      </div>

      {/* ===== Mobile (Card list) ===== */}
      <div className="mt-4 md:hidden space-y-3">
        {pageRows.map((u) => (
          <div key={u.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-600">รหัส</div>
                <div className="font-semibold text-slate-900">{u.id}</div>
              </div>

              <StatusDot status={u.status} className="shrink-0" />
            </div>

            <div className="mt-3">
              <div className="text-xs text-slate-600">อีเมล</div>
              <div className="font-medium text-slate-900 break-words">{u.email}</div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {u.status !== "SUSPENDED" ? (
                <button
                  type="button"
                  onClick={() => openSuspendModal(u)}
                  className="rounded-xl bg-amber-100 text-amber-900 border border-amber-300 px-3 py-2 text-sm font-semibold hover:bg-amber-200 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  disabled={loading}
                >
                  ระงับ
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openUnsuspendModal(u)}
                  className="rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-2 text-sm font-semibold hover:bg-emerald-200 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  disabled={loading}
                >
                  ปลดระงับ
                </button>
              )}

              {!u.isDeleted && (
                <button
                  type="button"
                  onClick={() => openDeleteModal(u)}
                  className="rounded-xl bg-rose-100 text-rose-900 border border-rose-300 px-3 py-2 text-sm font-semibold hover:bg-rose-200 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  disabled={loading}
                >
                  ลบ
                </button>
              )}
              {u.isDeleted && (
                <button
                  type="button"
                  onClick={() => openRestoreModal(u)}
                  className="rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-2 text-sm font-semibold hover:bg-emerald-200 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  disabled={loading}
                >
                  กู้คืน
                </button>
              )}
            </div>

            {u.suspendedUntil && (
              <div className="mt-3 text-xs text-slate-600">
                หมดระงับ: <span className="font-semibold text-slate-900">{fmtDT(u.suspendedUntil)}</span>
              </div>
            )}
          </div>
        ))}

        {!total && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-slate-600">
            ไม่มีข้อมูลลูกค้า
          </div>
        )}
      </div>

      {/* ===== Tablet/Desktop (Table) ===== */}
      <div className="mt-4 hidden md:block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th scope="col" className="p-3 text-left w-[80px]">
                รหัส
              </th>
              <th scope="col" className="p-3 text-left">
                อีเมล
              </th>
              <th scope="col" className="p-3 text-left w-[180px]">
                สถานะ
              </th>
              <th scope="col" className="p-3 text-left w-[200px]">
                ระงับถึงวันที่
              </th>
              <th scope="col" className="p-3 text-left w-[200px]">
                วันที่จะลบถาวร
              </th>
              <th scope="col" className="p-3 text-left w-[240px]">
                จัดการ
              </th>
            </tr>
          </thead>

          <tbody className="text-slate-900">
            {pageRows.map((u) => (
              <tr key={u.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                <td className="p-3">{u.id}</td>

                <td className="p-3">
                  <div className="max-w-[520px] lg:max-w-[760px] truncate" title={u.email}>
                    {u.email}
                  </div>
                </td>

                <td className="p-3">
                  <StatusDot status={u.status} />
                </td>

                <td className="p-3 text-slate-700">{u.suspendedUntil ? fmtDT(u.suspendedUntil) : "—"}</td>

                <td className="p-3">
                  {u.isDeleted && u.scheduledDeletionDate ? (
                    <div className="text-rose-600 font-semibold" title="บัญชีนี้จะถูกลบถาวรโดยระบบอัตโนมัติ">
                      {fmtDT(u.scheduledDeletionDate)}
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {u.status !== "SUSPENDED" ? (
                      <button
                        type="button"
                        onClick={() => openSuspendModal(u)}
                        className="rounded-lg bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 font-semibold hover:bg-amber-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-200"
                        disabled={loading}
                      >
                        ระงับ
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openUnsuspendModal(u)}
                        className="rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 font-semibold hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-200"
                        disabled={loading}
                      >
                        ปลดระงับ
                      </button>
                    )}

                    {!u.isDeleted && (
                      <button
                        type="button"
                        onClick={() => openDeleteModal(u)}
                        className="rounded-lg bg-rose-100 text-rose-900 border border-rose-300 px-3 py-1 font-semibold hover:bg-rose-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-200"
                        disabled={loading}
                      >
                        ลบ
                      </button>
                    )}
                    {u.isDeleted && (
                      <button
                        type="button"
                        onClick={() => openRestoreModal(u)}
                        className="rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 font-semibold hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-200"
                        disabled={loading}
                      >
                        กู้คืน
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {!total && (
              <tr>
                <td className="p-3 text-slate-700" colSpan={5}>
                  ไม่มีข้อมูลลูกค้า
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

      {/* =========================
       * Unsuspend Confirm Modal
       * ========================= */}
      {openUnsuspend && uTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ปลดระงับบัญชีลูกค้า"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setOpenUnsuspend(false);
              setUTarget(null);
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b border-slate-100">
              <div className="text-lg font-semibold text-slate-900">ปลดระงับบัญชีลูกค้า</div>
              <div className="mt-1 text-sm text-slate-600">กรุณาตรวจสอบรายละเอียดก่อนยืนยันการทำรายการ</div>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm text-slate-700">ลูกค้า</div>
                <div className="mt-1 font-semibold text-slate-900 break-words">{uTarget.email}</div>
                <div className="mt-1 text-xs text-slate-700">
                  ID: <span className="font-semibold text-slate-900">{uTarget.id}</span>
                </div>

                {(uTarget.suspendedUntil || uTarget.suspendedReason) && (
                  <div className="mt-3 text-sm text-slate-700 space-y-1">
                    <div>
                      หมดระงับเดิม:{" "}
                      <span className="font-semibold text-slate-900">
                        {uTarget.suspendedUntil ? fmtDT(uTarget.suspendedUntil) : "—"}
                      </span>
                    </div>
                    <div>
                      เหตุผลเดิม:{" "}
                      <span className="font-semibold text-slate-900">
                        {uTarget.suspendedReason ? String(uTarget.suspendedReason) : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {uTarget?.isDeleted && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => openRestoreModal(uTarget)}
                    className="w-full rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-2 text-sm font-semibold hover:bg-emerald-200 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    disabled={loading}
                  >
                    กู้คืน
                  </button>
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 text-sm">
                กด <b>“ยืนยัน”</b> เพื่อปลดระงับบัญชีลูกค้านี้ และกลับมาใช้งานได้ตามปกติ
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 text-sm">
                ระบบจะส่งอีเมลแจ้งเตือนไปยัง <b>{uTarget.email}</b> ว่าบัญชีถูกปลดระงับแล้ว
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-200"
                onClick={() => {
                  setOpenUnsuspend(false);
                  setUTarget(null);
                }}
                disabled={loading}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-200"
                onClick={doUnsuspendConfirm}
                disabled={loading}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================
       * Suspend Modal
       * ========================= */}
      {openSuspend && sTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ระงับบัญชีลูกค้า"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenSuspend(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b border-slate-100">
              <div className="text-lg font-semibold text-slate-900">ระงับบัญชีลูกค้า</div>
              <div className="mt-1 text-sm text-slate-600">กรุณาระบุรายละเอียดและเหตุผลในการทำรายการ</div>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm">
                <div className="text-slate-700">อีเมล</div>
                <div className="font-semibold text-slate-900 break-words">{sTarget.email}</div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">ระยะเวลาระงับ (วัน)</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 3, 7, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setSUseCustom(false);
                        setSDaysPreset(d);
                      }}
                      className={clsx(
                        "rounded-xl px-4 py-2 text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-sky-200",
                        !sUseCustom && sDaysPreset === d
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {d} วัน
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setSUseCustom(true)}
                    className={clsx(
                      "rounded-xl px-4 py-2 text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-sky-200",
                      sUseCustom
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    กำหนดเอง
                  </button>
                </div>

                {sUseCustom && (
                  <div className="mt-2">
                    <input
                      value={sDaysCustom}
                      onChange={(e) => setSDaysCustom(e.target.value)}
                      placeholder="กรอกจำนวนวัน เช่น 14"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">เหตุผล</div>
                <div className="mt-2 space-y-2">
                  {suspendReasons.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm font-normal">
                      <input
                        type="radio"
                        name="suspend-reason"
                        value={r.value}
                        checked={sReason === r.value}
                        onChange={() => setSReason(r.value)}
                        className="accent-amber-600"
                      />
                      {r.label}
                    </label>
                  ))}
                  {sReason === "other" && (
                    <input
                      type="text"
                      value={sReasonOther}
                      onChange={e => setSReasonOther(stripEmojisAndSpecials(e.target.value))}
                      placeholder="โปรดระบุเหตุผล"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-200"
                    />
                  )}
                </div>
                {!sReasonTrim && <div className="mt-2 text-xs font-semibold text-rose-600">กรุณาระบุเหตุผล</div>}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
                ระบบจะส่งอีเมลแจ้งเตือนไปยัง <b>{sTarget.email}</b> พร้อมระบุเหตุผลและระยะเวลาระงับ
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200"
                onClick={() => setOpenSuspend(false)}
                disabled={loading}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="rounded-xl bg-amber-500 px-5 py-2 font-semibold text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-200"
                onClick={doSuspend}
                disabled={loading || !sReasonTrim}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================
       * Delete Modal
       * ========================= */}
      {openDelete && dTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ลบบัญชีลูกค้า"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenDelete(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b border-slate-100">
              <div className="text-lg font-semibold text-rose-600">ลบบัญชีลูกค้า</div>
              <div className="mt-1 text-sm text-slate-600">การลบไม่สามารถกู้คืนได้ กรุณาระบุเหตุผลในการลบ</div>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm">
                <div className="text-slate-700">อีเมล</div>
                <div className="font-semibold text-slate-900 break-words">{dTarget.email}</div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">เหตุผลในการลบ</div>
                <div className="mt-2 space-y-2">
                  {deleteReasons.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm font-normal">
                      <input
                        type="radio"
                        name="delete-reason"
                        value={r.value}
                        checked={dReason === r.value}
                        onChange={() => setDReason(r.value)}
                        className="accent-rose-600"
                      />
                      {r.label}
                    </label>
                  ))}
                  {dReason === "other" && (
                    <input
                      type="text"
                      value={dReasonOther}
                      onChange={e => setDReasonOther(stripEmojisAndSpecials(e.target.value))}
                      placeholder="โปรดระบุเหตุผล"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-rose-200"
                    />
                  )}
                </div>
                {!dReasonTrim && (
                  <div className="mt-2 text-xs font-semibold text-rose-600">กรุณาระบุเหตุผลในการลบ</div>
                )}
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 text-sm">
                <div className="font-semibold mb-1">คำเตือน</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>ข้อมูลลูกค้าจะถูกลบออกจากระบบ</li>
                  <li>
                    ระบบจะส่งอีเมลแจ้งเตือนไปยัง <b>{dTarget.email}</b>
                  </li>
                  <li>ไม่สามารถกู้คืนข้อมูลได้หลังลบ</li>
                </ul>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200"
                onClick={() => setOpenDelete(false)}
                disabled={loading}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="rounded-xl bg-rose-600 px-5 py-2 font-semibold text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-200"
                onClick={doDelete}
                disabled={loading || !dReasonTrim}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================
       * Restore Modal
       * ========================= */}
      {openRestore && restoreTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="กู้คืนบัญชีลูกค้า"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenRestore(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b border-slate-100">
              <div className="text-lg font-semibold text-emerald-600">กู้คืนบัญชีลูกค้า</div>
              <div className="mt-1 text-sm text-slate-600">วิธีกู้คืนบัญชีเพื่อให้ลูกค้ากลับมาใช้งานได้ตามปกติ</div>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm">
                <div className="text-slate-700">อีเมล</div>
                <div className="font-semibold text-slate-900 break-words">{restoreTarget.email}</div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm">
                กด “ยืนยัน” เพื่อกู้คืนบัญชีลูกค้านี้ และกลับมาใช้งานได้ตามปกติ
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200"
                onClick={() => setOpenRestore(false)}
                disabled={rSubmitting}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className={`rounded-xl px-5 py-2 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-sky-200 ${
                  rSubmitting ? "opacity-60 cursor-not-allowed bg-emerald-600" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
                onClick={submitRestore}
                disabled={rSubmitting}
              >
                {rSubmitting ? "กำลังทำรายการ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
