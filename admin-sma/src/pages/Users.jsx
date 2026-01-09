import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

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
  const [sReason, setSReason] = useState("");

  // ✅ Unsuspend confirm modal
  const [openUnsuspend, setOpenUnsuspend] = useState(false);
  const [uTarget, setUTarget] = useState(null);

  // Delete modal
  const [openDelete, setOpenDelete] = useState(false);
  const [dTarget, setDTarget] = useState(null);
  const [dReason, setDReason] = useState("");

  const role = ROLE_LOCK;

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

    const daysNum = sUseCustom ? Number(String(sDaysCustom || "").trim()) : Number(sDaysPreset);

    const payload = {
      status: "SUSPENDED",
      reason: (sReason || "").trim() || null,
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
    setLoading(true);
    try {
      await api.delete(`/admin/customers/${dTarget.id}`, {
        data: { reason: (dReason || "").trim() || null },
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
          <div className="mt-1 text-sm text-slate-500">
            หน้านี้แสดงเฉพาะผู้ใช้ประเภท <span className="font-semibold">CUSTOMER</span>
          </div>
        </div>

        {/* ✅ เอากรอบเขียว/แดง Active/Suspended ออกตามที่ขอ */}
        <div className="flex items-center gap-2 text-sm">
          {loading && <div className="text-slate-500">กำลังโหลด…</div>}
        </div>
      </div>

      {/* ✅ Filter row: dropdown + search (เหมือนหน้าร้านค้า) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">ลูกค้าทั้งหมด</option>
          <option value="ACTIVE">ใช้งานอยู่</option>
          <option value="SUSPENDED">ถูกระงับ</option>
        </select>

        <div className="flex flex-1 items-center gap-2">
          <input
            className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
            placeholder="ค้นหาอีเมลลูกค้า..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
          />

          {/* ✅ เปลี่ยนปุ่ม "ค้นหา" สีน้ำเงิน -> ปุ่ม "รีเฟรช" แบบเดียวกับหน้าร้าน */}
          <button
            onClick={load}
            className="w-[110px] rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
            title="รีเฟรชรายการ"
          >
            รีเฟรช
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}

      {/* ✅ Summary + Pagination (แสดง 10 ต่อหน้า) */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          {loading ? (
            "กำลังโหลด…"
          ) : total ? (
            <>
              แสดง {showingFrom}-{showingTo} จาก {total} รายการ
              <span className="text-slate-400"> • หน้า {safePage}/{totalPages}</span>
            </>
          ) : (
            "ไม่มีข้อมูลลูกค้า"
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PageButton disabled={loading || safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ←
          </PageButton>

          {pageItems.map((it, idx) =>
            it === "…" ? (
              <span key={`e-${idx}`} className="px-2 text-slate-500">
                …
              </span>
            ) : (
              <PageButton key={it} active={it === safePage} disabled={loading} onClick={() => setPage(it)}>
                {it}
              </PageButton>
            )
          )}

          <PageButton disabled={loading || safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            →
          </PageButton>
        </div>
      </div>

      {/* ===== Mobile (Card list) ===== */}
      <div className="mt-4 md:hidden space-y-3">
        {pageRows.map((u) => (
          <div key={u.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">ID</div>
                <div className="font-semibold text-slate-900">{u.id}</div>
              </div>

              <span
                className={clsx(
                  "shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                  u.status === "SUSPENDED"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                )}
              >
                {u.status}
              </span>
            </div>

            <div className="mt-3">
              <div className="text-xs text-slate-500">Email</div>
              <div className="font-medium text-slate-900 break-words">{u.email}</div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {u.status !== "SUSPENDED" ? (
                <button
                  onClick={() => openSuspendModal(u)}
                  className="rounded-xl bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 text-sm font-semibold hover:bg-amber-100 disabled:opacity-60"
                  disabled={loading}
                >
                  ระงับ
                </button>
              ) : (
                <button
                  onClick={() => openUnsuspendModal(u)}
                  className="rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 text-sm font-semibold hover:bg-emerald-100 disabled:opacity-60"
                  disabled={loading}
                >
                  ปลดระงับ
                </button>
              )}

              <button
                onClick={() => openDeleteModal(u)}
                className="rounded-xl bg-rose-50 text-rose-700 border border-rose-200 px-3 py-2 text-sm font-semibold hover:bg-rose-100 disabled:opacity-60"
                disabled={loading}
              >
                ลบ
              </button>
            </div>

            {u.suspendedUntil && (
              <div className="mt-3 text-xs text-slate-500">
                หมดระงับ: <span className="font-semibold">{fmtDT(u.suspendedUntil)}</span>
              </div>
            )}
          </div>
        ))}

        {!total && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-slate-500">
            ไม่มีข้อมูลลูกค้า
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
              <th className="p-3 text-left w-[140px]">Status</th>
              <th className="p-3 text-left w-[220px]">Suspended Until</th>
              <th className="p-3 text-left w-[240px]">Action</th>
            </tr>
          </thead>

          <tbody className="text-slate-800">
            {pageRows.map((u) => (
              <tr key={u.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                <td className="p-3">{u.id}</td>

                <td className="p-3">
                  <div className="max-w-[520px] lg:max-w-[760px] truncate" title={u.email}>
                    {u.email}
                  </div>
                </td>

                <td className="p-3">
                  <span
                    className={clsx(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                      u.status === "SUSPENDED"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}
                  >
                    {u.status}
                  </span>
                </td>

                <td className="p-3 text-slate-600">{u.suspendedUntil ? fmtDT(u.suspendedUntil) : "—"}</td>

                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {u.status !== "SUSPENDED" ? (
                      <button
                        onClick={() => openSuspendModal(u)}
                        className="rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 font-semibold hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={loading}
                      >
                        ระงับ
                      </button>
                    ) : (
                      <button
                        onClick={() => openUnsuspendModal(u)}
                        className="rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 font-semibold hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={loading}
                      >
                        ปลดระงับ
                      </button>
                    )}

                    <button
                      onClick={() => openDeleteModal(u)}
                      className="rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 font-semibold hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={loading}
                    >
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!total && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={5}>
                  ไม่มีข้อมูลลูกค้า
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =========================
       * Unsuspend Confirm Modal
       * ========================= */}
      {openUnsuspend && uTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
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
              <div className="mt-1 text-sm text-slate-500">กรุณาตรวจสอบรายละเอียดก่อนยืนยันการทำรายการ</div>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm text-slate-600">ลูกค้า</div>
                <div className="mt-1 font-semibold text-slate-900 break-words">{uTarget.email}</div>
                <div className="mt-1 text-xs text-slate-500">
                  ID: <span className="font-semibold text-slate-700">{uTarget.id}</span>
                </div>

                {(uTarget.suspendedUntil || uTarget.suspendedReason) && (
                  <div className="mt-3 text-sm text-slate-600 space-y-1">
                    <div>
                      หมดระงับเดิม:{" "}
                      <span className="font-semibold text-slate-800">
                        {uTarget.suspendedUntil ? fmtDT(uTarget.suspendedUntil) : "—"}
                      </span>
                    </div>
                    <div>
                      เหตุผลเดิม:{" "}
                      <span className="font-semibold text-slate-800">
                        {uTarget.suspendedReason ? String(uTarget.suspendedReason) : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 text-sm">
                กด <b>“ยืนยัน”</b> เพื่อปลดระงับบัญชีลูกค้านี้ และกลับมาใช้งานได้ตามปกติ
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 text-sm">
                ระบบจะส่งอีเมลแจ้งเตือนไปยัง <b>{uTarget.email}</b> ว่าบัญชีถูกปลดระงับแล้ว
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                onClick={() => {
                  setOpenUnsuspend(false);
                  setUTarget(null);
                }}
                disabled={loading}
              >
                ยกเลิก
              </button>
              <button
                className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
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
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenSuspend(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b border-slate-100">
              <div className="text-lg font-semibold text-slate-900">ระงับบัญชีลูกค้า</div>
              <div className="mt-1 text-sm text-slate-500">กรุณาระบุรายละเอียดและเหตุผลในการทำรายการ</div>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm">
                <div className="text-slate-500">อีเมล</div>
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
                        "rounded-xl px-4 py-2 text-sm font-semibold border",
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
                      "rounded-xl px-4 py-2 text-sm font-semibold border",
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
                <textarea
                  value={sReason}
                  onChange={(e) => setSReason(e.target.value)}
                  placeholder="ระบุเหตุผลการระงับ (แนะนำให้ระบุให้ชัดเจน)"
                  className="mt-2 w-full min-h-[120px] rounded-xl border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
                ระบบจะส่งอีเมลแจ้งเตือนไปยัง <b>{sTarget.email}</b> พร้อมระบุเหตุผลและระยะเวลาระงับ
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setOpenSuspend(false)}
                disabled={loading}
              >
                ยกเลิก
              </button>
              <button
                className="rounded-xl bg-amber-500 px-5 py-2 font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                onClick={doSuspend}
                disabled={loading}
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
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenDelete(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="p-5 border-b border-slate-100">
              <div className="text-lg font-semibold text-rose-600">ลบบัญชีลูกค้า</div>
              <div className="mt-1 text-sm text-slate-500">การลบไม่สามารถกู้คืนได้ กรุณาระบุเหตุผลในการลบ</div>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm">
                <div className="text-slate-500">อีเมล</div>
                <div className="font-semibold text-slate-900 break-words">{dTarget.email}</div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">เหตุผลในการลบ</div>
                <textarea
                  value={dReason}
                  onChange={(e) => setDReason(e.target.value)}
                  placeholder="ระบุเหตุผลการลบ (แนะนำให้ระบุให้ชัดเจน)"
                  className="mt-2 w-full min-h-[140px] rounded-xl border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
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
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setOpenDelete(false)}
                disabled={loading}
              >
                ยกเลิก
              </button>
              <button
                className="rounded-xl bg-rose-600 px-5 py-2 font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                onClick={doDelete}
                disabled={loading}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
