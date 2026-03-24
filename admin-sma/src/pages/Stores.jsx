// admin-sma/src/pages/Stores.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { stripEmojis, stripEmojisAndSpecials } from "../lib/text";

const PAGE_SIZE = 10;

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return "—";
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const meta =
    status === "ACTIVE"
      ? { label: "ใช้งานอยู่", dot: "bg-emerald-500" }
      : status === "SUSPENDED"
        ? { label: "ถูกระงับ", dot: "bg-rose-500" }
        : { label: status || "—", dot: "bg-slate-400" };

  return (
    <span className="inline-flex items-center gap-2" title={meta.label}>
      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      <span className="text-xs font-semibold text-slate-800">{meta.label}</span>
    </span>
  );
}

function StoreAvatar({ name }) {
  const initial = (name?.trim()?.[0] || "S").toUpperCase();
  return (
    <div className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-slate-200 shadow-sm">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-sky-50 ring-1 ring-sky-100 text-sky-700 font-extrabold">
        {initial}
      </div>
    </div>
  );
}

function ModalShell({ open, onClose, children, widthClass = "max-w-xl", ariaLabel = "Dialog" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className={`w-full ${widthClass} rounded-2xl bg-white shadow-2xl`}>
          {children}
        </div>
      </div>
    </div>
  );
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

export default function Stores() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(""); // "" | ACTIVE | SUSPENDED
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Pagination
  const [page, setPage] = useState(1);

  // Portal modal
  const [openPortal, setOpenPortal] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portal, setPortal] = useState(null);

  // Suspend modal
  const [openSuspend, setOpenSuspend] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [sDaysPreset, setSDaysPreset] = useState(7); // 1/3/7/30/-1(custom)
  const [sDaysCustom, setSDaysCustom] = useState("");
  const [sReason, setSReason] = useState("");
  const [sSubmitting, setSSubmitting] = useState(false);

  // Delete modal
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dReason, setDReason] = useState("");
  const [dSubmitting, setDSubmitting] = useState(false);

  // ✅ บังคับเหตุผลก่อนกดได้ (เฉพาะส่วนที่เกี่ยวกับเหตุผล)
  const sReasonTrim = sReason.trim();
  const dReasonTrim = dReason.trim();
  const isUnsuspendMode = suspendTarget?.status === "SUSPENDED";
  const canSubmitSuspend = isUnsuspendMode ? true : !!sReasonTrim;
  const canSubmitDelete = !!dReasonTrim;

  // a11y ids (แก้ Select ไม่มี label + เพิ่มความชัดเจน)
  const STATUS_SELECT_ID = "stores-status";
  const SEARCH_INPUT_ID = "stores-search";
  const HELP_ID = "stores-controls-help";

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/stores", { params: { q, status } });
      setRows(data?.stores || []);
      setPage(1); // ✅ โหลดใหม่กลับหน้า 1
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ✅ เปลี่ยนคำค้นหา (client-side filter) -> กลับหน้า 1 (กันหน้าล้น/หน้าว่าง)
  useEffect(() => {
    setPage(1);
  }, [q]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;

    return (rows || []).filter((s) => {
      const name = s?.storeProfile?.storeName || "";
      const email = s?.email || "";
      const type = s?.storeProfile?.storeType || "";
      return `${name} ${email} ${type}`.toLowerCase().includes(query);
    });
  }, [rows, q]);

  // ✅ Pagination derived (แสดง 10 ต่อหน้า)
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

  async function openPortalModal(storeId) {
    setOpenPortal(true);
    setPortalLoading(true);
    setPortal(null);
    try {
      const { data } = await api.get(`/admin/stores/${storeId}/portal`);
      setPortal(data);
    } finally {
      setPortalLoading(false);
    }
  }

  function openSuspendModal(store) {
    setSuspendTarget(store);
    setSDaysPreset(7);
    setSDaysCustom("");
    setSReason("");
    setOpenSuspend(true);
  }

  function openDeleteModal(store) {
    setDeleteTarget(store);
    setDReason("");
    setOpenDelete(true);
  }

  async function submitSuspend() {
    if (!suspendTarget) return;

    const days = sDaysPreset === -1 ? (sDaysCustom || "").trim() : String(sDaysPreset);

    if (suspendTarget.status === "ACTIVE") {
      // suspend mode -> ต้องมี reason
      if (!sReasonTrim) return alert("กรุณาระบุเหตุผล");
    }

    setSSubmitting(true);
    try {
      if (suspendTarget.status === "SUSPENDED") {
        // ปลดระงับ
        await api.patch(`/admin/users/${suspendTarget.id}/status`, {
          status: "ACTIVE",
          reason: null,
          days: null,
        });
      } else {
        // ระงับ
        await api.patch(`/admin/users/${suspendTarget.id}/status`, {
          status: "SUSPENDED",
          reason: sReasonTrim,
          days: days ? Number(days) : null,
        });
      }

      setOpenSuspend(false);
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || "ทำรายการไม่สำเร็จ");
    } finally {
      setSSubmitting(false);
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return;
    if (!dReasonTrim) return alert("กรุณาระบุเหตุผลในการลบ");

    setDSubmitting(true);
    try {
      await api.delete(`/admin/stores/${deleteTarget.id}`, {
        data: { reason: dReasonTrim },
      });
      setOpenDelete(false);
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || "ลบบัญชีไม่สำเร็จ");
    } finally {
      setDSubmitting(false);
    }
  }

  return (
    <div>
      {/* Title */}
      <div className="mb-2">
        <div className="text-2xl font-extrabold text-slate-900">จัดการร้านค้า</div>
        {/* ✅ เพิ่ม contrast */}
        <div className="text-sm text-slate-600">จัดการบัญชีร้านค้าและดูเมนู Portal แยกของแต่ละร้าน</div>
      </div>

      {/* a11y help */}
      <p id={HELP_ID} className="sr-only">
        เลือกสถานะเพื่อกรองร้านค้า, พิมพ์คำค้นหาเพื่อค้นหาร้านค้า/อีเมล/ประเภท, และกดปุ่มรีเฟรชเพื่อโหลดข้อมูลใหม่
      </p>

      {/* Filter row (dropdown + search) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* ✅ label for select (แก้ Lighthouse) */}
        <div>
          <label htmlFor={STATUS_SELECT_ID} className="sr-only">
            กรองตามสถานะร้านค้า
          </label>
          <select
            id={STATUS_SELECT_ID}
            name="status"
            aria-describedby={HELP_ID}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">ร้านค้าทั้งหมด</option>
            <option value="ACTIVE">ใช้งานอยู่</option>
            <option value="SUSPENDED">ถูกระงับ</option>
          </select>
        </div>

        <div className="flex flex-1 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-sky-200">
            {/* ✅ แก้ contrast จาก slate-400 */}
            <span className="text-slate-600" aria-hidden="true">
              🔍
            </span>

            <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
              ค้นหาร้านค้า/อีเมลร้านค้า
            </label>
            <input
              id={SEARCH_INPUT_ID}
              name="q"
              type="search"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
              placeholder="ค้นหาร้านค้า/อีเมลร้านค้า"
              value={q}
              onChange={(e) => setQ(stripEmojisAndSpecials(e.target.value))}
              aria-describedby={HELP_ID}
            />
          </div>

          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200"
            aria-describedby={HELP_ID}
          >
            รีเฟรช
          </button>
        </div>
      </div>

      {/* ✅ Summary */}
      <div className="mt-4">
        <div className="text-sm text-slate-700">
          {loading ? (
            <span role="status" aria-live="polite">
              กำลังโหลดข้อมูล...
            </span>
          ) : total ? (
            <>
              แสดง {showingFrom}-{showingTo} จาก {total} รายการ
              {/* ✅ แก้ contrast จาก slate-400 */}
              <span className="text-slate-600"> • หน้า {safePage}/{totalPages}</span>
            </>
          ) : (
            "ไม่มีร้านค้า"
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm md:col-span-2 xl:col-span-3">
            <span role="status" aria-live="polite">
              กำลังโหลดข้อมูล...
            </span>
          </div>
        ) : pageRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm md:col-span-2 xl:col-span-3">
            <div className="text-sm font-semibold text-slate-900">ไม่มีร้านค้า</div>
            <div className="mt-1 text-xs text-slate-600">ลองเปลี่ยนคำค้นหา/ตัวกรอง</div>
          </div>
        ) : (
          pageRows.map((s) => {
            const name = s?.storeProfile?.storeName || "-";
            const type = s?.storeProfile?.storeType || "-";
            const warrantiesCount = s?.warrantiesCount ?? 0;
            const customersCount = s?.customersCount ?? 0;

            return (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <StoreAvatar name={name} />
                      <div className="min-w-0">
                        <div className="truncate text-base font-extrabold text-slate-900">{name}</div>
                        {/* ✅ เพิ่ม contrast */}
                        <div className="truncate text-xs text-slate-600">{type}</div>
                      </div>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-600">การรับประกัน</div>
                      <div className="text-lg font-extrabold text-slate-900">{warrantiesCount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600">ลูกค้า</div>
                      <div className="text-lg font-extrabold text-slate-900">{customersCount}</div>
                    </div>
                  </div>

                  {/* ✅ เพิ่ม User ID ด้านนอกตามที่ขอ */}
                  <div className="mt-3 text-xs text-slate-600">
                    <div>User ID</div>
                    <div className="text-slate-900 font-semibold">{s.id}</div>
                  </div>

                  <div className="mt-2 text-xs text-slate-600">
                    <div>อีเมล</div>
                    <div className="text-slate-900 font-semibold break-words">{s.email}</div>
                  </div>

                  <div className="mt-2 text-xs text-slate-700">
                    วันที่เข้าร่วม: <span className="font-semibold text-slate-900">{fmtDate(s.createdAt)}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 bg-slate-50/60 p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => openPortalModal(s.id)}
                      className="rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-xs font-extrabold text-sky-900 hover:bg-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      aria-label={`เปิด Portal ของร้าน ${name}`}
                    >
                    รายละเอียด
                    </button>

                    <button
                      type="button"
                      onClick={() => openSuspendModal(s)}
                      className={`rounded-lg border px-3 py-2 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-sky-200 ${s.status === "SUSPENDED"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200"
                        : "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200"
                        }`}
                      aria-label={`${s.status === "SUSPENDED" ? "ปลดระงับ" : "ระงับ"} ร้าน ${name}`}
                    >
                      {s.status === "SUSPENDED" ? "ปลดระงับ" : "ระงับบัญชี"}
                    </button>

                    <button
                      type="button"
                      onClick={() => openDeleteModal(s)}
                      className="rounded-lg border border-rose-300 bg-rose-100 px-3 py-2 text-xs font-extrabold text-rose-900 hover:bg-rose-200 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      aria-label={`ลบบัญชีร้าน ${name}`}
                    >
                      ลบบัญชี
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination (ใต้การ์ด ชิดขวา) */}
      {total > 0 && (
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

      {/* ============ Portal Modal ============ */}
      <ModalShell
        open={openPortal}
        onClose={() => setOpenPortal(false)}
        widthClass="max-w-2xl"
        ariaLabel="Portal ร้านค้า"
      >
        <div className="p-6">
          {portalLoading ? (
            <div className="text-sm text-slate-700" role="status" aria-live="polite">
              กำลังโหลด Portal...
            </div>
          ) : !portal ? (
            <div className="text-sm text-slate-700">ไม่พบข้อมูล</div>
          ) : (
            <>
              <div className="text-lg font-extrabold text-slate-900">
                Portal : {portal?.store?.storeProfile?.storeName || "-"}
              </div>
              <div className="text-sm text-slate-600">ดูรายละเอียดและสถิติการใช้งานของร้านค้า</div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-slate-700">User ID</div>
                    <div className="col-span-2 font-semibold text-slate-900">{portal?.store?.id ?? "-"}</div>

                    <div className="text-slate-700">ชื่อร้านค้า</div>
                    <div className="col-span-2 font-semibold text-slate-900">
                      {portal?.store?.storeProfile?.storeName || "-"}
                    </div>

                    <div className="text-slate-700">ประเภท</div>
                    <div className="col-span-2 font-semibold text-slate-900">
                      {portal?.store?.storeProfile?.storeType || "-"}
                    </div>

                    <div className="text-slate-700">อีเมล</div>
                    <div className="col-span-2 font-semibold text-slate-900">{portal?.store?.email || "-"}</div>

                    <div className="text-slate-700">วันที่เข้าร่วม</div>
                    <div className="col-span-2 font-semibold text-slate-900">{fmtDate(portal?.store?.createdAt)}</div>
                  </div>
                </div>

                {/* ✅ เหลือแค่ 2 ช่อง */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs text-slate-600">การรับประกัน</div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">
                      {portal?.stats?.warrantyCount ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs text-slate-600">ลูกค้า</div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">
                      {portal?.stats?.customerCount ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Table */}
              <div className="mt-5 rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-sm font-extrabold text-slate-900">กิจกรรมล่าสุด</div>
                <table className="w-full text-sm">
                  <thead className="bg-white text-slate-700">
                    <tr className="border-t border-slate-200">
                      <th className="p-3 text-left">การกระทำ</th>
                      <th className="p-3 text-left">เป้าหมาย</th>
                      <th className="p-3 text-left">เวลา</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-900">
                    {(portal?.activities || []).map((a, idx) => (
                      <tr key={idx} className="border-t border-slate-200">
                        <td className="p-3">{a.action}</td>
                        <td className="p-3 font-semibold">{a.subject}</td>
                        <td className="p-3">{fmtDateTime(a.at)}</td>
                      </tr>
                    ))}
                    {!portal?.activities?.length && (
                      <tr className="border-t border-slate-200">
                        <td className="p-3 text-slate-700" colSpan={3}>
                          ยังไม่มีกิจกรรม
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenPortal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200"
                >
                  ปิด
                </button>
              </div>
            </>
          )}
        </div>
      </ModalShell>

      {/* ============ Suspend Modal ============ */}
      <ModalShell
        open={openSuspend}
        onClose={() => setOpenSuspend(false)}
        widthClass="max-w-xl"
        ariaLabel="ระงับหรือปลดระงับบัญชีร้านค้า"
      >
        <div className="p-6">
          <div className="text-lg font-extrabold text-slate-900">
            {suspendTarget?.status === "SUSPENDED" ? "ปลดระงับบัญชีร้านค้า" : "ระงับบัญชีร้านค้า"}
          </div>
          <div className="text-sm text-slate-600">กรุณาระบุรายละเอียดและเหตุผลในการทำรายการ</div>

          <div className="mt-5 space-y-4">
            {suspendTarget?.status !== "SUSPENDED" && (
              <>
                <div>
                  <div className="text-sm font-bold text-slate-900">ระยะเวลาระงับ (วัน)</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[1, 3, 7, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSDaysPreset(d)}
                        className={[
                          "rounded-lg border px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-200",
                          sDaysPreset === d
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {d} วัน
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSDaysPreset(-1)}
                      className={[
                        "rounded-lg border px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-200",
                        sDaysPreset === -1
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      กำหนดเอง
                    </button>
                  </div>

                  {sDaysPreset === -1 && (
                    <div className="mt-3">
                      <div className="text-sm font-bold text-slate-900">ระบุจำนวนวัน</div>
                      <input
                        value={sDaysCustom}
                        onChange={(e) => setSDaysCustom(e.target.value)}
                        placeholder="เช่น 14"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-sky-200"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-sm font-bold text-slate-900">เหตุผล</div>
                  <textarea
                    rows={4}
                    value={sReason}
                    onChange={(e) => setSReason(stripEmojis(e.target.value))}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-sky-200"
                  />
                  {!sReasonTrim && <div className="mt-2 text-xs font-semibold text-rose-600">กรุณาระบุเหตุผล</div>}
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  ระบบจะส่งอีเมลแจ้งเตือนไปยัง <b>{suspendTarget?.email || "-"}</b> พร้อมระบุเหตุผลและระยะเวลาระงับ
                </div>
              </>
            )}

            {suspendTarget?.status === "SUSPENDED" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                กด “ยืนยัน” เพื่อปลดระงับบัญชีร้านนี้ และกลับมาใช้งานได้ตามปกติ
              </div>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenSuspend(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                disabled={sSubmitting || !canSubmitSuspend}
                onClick={submitSuspend}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-sky-200",
                  suspendTarget?.status === "SUSPENDED"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-500 hover:bg-amber-600",
                  sSubmitting || !canSubmitSuspend ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {sSubmitting ? "กำลังทำรายการ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* ============ Delete Modal ============ */}
      <ModalShell
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        widthClass="max-w-xl"
        ariaLabel="ลบบัญชีร้านค้า"
      >
        <div className="p-6">
          <div className="text-lg font-extrabold text-rose-600">ลบบัญชีร้านค้า</div>
          <div className="text-sm text-slate-600">การลบไม่สามารถกู้คืนได้ กรุณาระบุเหตุผลในการลบ</div>

          <div className="mt-5">
            <div className="text-sm font-bold text-slate-900">ชื่อบัญชี</div>
            <div className="mt-1 font-extrabold text-slate-900">{deleteTarget?.storeProfile?.storeName || "-"}</div>

            <div className="mt-4 text-sm font-bold text-slate-900">เหตุผลในการลบ</div>
            <textarea
              rows={5}
              value={dReason}
              onChange={(e) => setDReason(stripEmojis(e.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-rose-200"
            />
            {!dReasonTrim && <div className="mt-2 text-xs font-semibold text-rose-600">กรุณาระบุเหตุผลในการลบ</div>}

            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              คำเตือน
              <ul className="mt-2 list-disc pl-5">
                <li>ข้อมูลร้านค้าจะถูกลบออกจากระบบ</li>
                <li>ระบบจะส่งอีเมลแจ้งเตือนไปยัง {deleteTarget?.email || "-"}</li>
                <li>ไม่สามารถกู้คืนข้อมูลได้หลังลบ</li>
              </ul>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenDelete(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                disabled={dSubmitting || !canSubmitDelete}
                onClick={submitDelete}
                className={[
                  "rounded-xl bg-rose-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-sky-200",
                  dSubmitting || !canSubmitDelete ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {dSubmitting ? "กำลังลบ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}