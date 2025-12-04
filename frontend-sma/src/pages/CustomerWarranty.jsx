// frontend-sma/src/pages/CustomerWarranty.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
// CustomerProfileModal removed here because top-level CustomerNavbar provides profile UI

/* =======================
 * Helpers
 * ======================= */
const FILTERS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "ใช้งานได้" },
  { value: "nearing_expiration", label: "ใกล้หมดอายุ" },
  { value: "expired", label: "หมดอายุ" },
];

// ✅ helper: ปัดให้เป็น "UTC date-only" เสมอ
const dateOnlyUTC = (v) => {
  if (!v) return null;
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
      return new Date(Date.UTC(y, mo, d));
    }
  }
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

// ✅ แปลงเป็น YYYY-MM-DD เสมอ (UTC)
const fmtDate = (d) => {
  const u = dateOnlyUTC(d);
  if (!u) return "-";
  const y = u.getUTCFullYear();
  const m = String(u.getUTCMonth() + 1).padStart(2, "0");
  const day = String(u.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function absolutize(p) {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const base = (api.defaults.baseURL || "").replace(/\/$/, "");
  return `${base}/${String(p).replace(/^\/+/, "")}`;
}

function firstImageSrc(images) {
  if (!images) return null;
  if (Array.isArray(images) && images.length) {
    const first = images[0];
    if (typeof first === "string") return absolutize(first);
    if (first?.url) return absolutize(first.url);
    if (first?.path) return absolutize(first.path);
  }
  return null;
}

function calcDaysLeft(expiryDate) {
  if (!expiryDate) return null;
  const todayUTC = dateOnlyUTC(new Date());     // ✅ ใช้ UTC date-only
  const expUTC = dateOnlyUTC(expiryDate);       // ✅ ใช้ UTC date-only
  if (!todayUTC || !expUTC) return null;
  return Math.ceil(
    (Date.UTC(
      expUTC.getUTCFullYear(),
      expUTC.getUTCMonth(),
      expUTC.getUTCDate()
    ) -
      Date.UTC(
        todayUTC.getUTCFullYear(),
        todayUTC.getUTCMonth(),
        todayUTC.getUTCDate()
      )) /
      (24 * 3600 * 1000)
  );
}

function deriveItemStatusCode(item, notifyDays = 14) {
  const dl = Number.isFinite(item?._daysLeft)
    ? item._daysLeft
    : calcDaysLeft(item?.expiryDate);
  if (!Number.isFinite(dl)) return "active";
  if (dl < 0) return "expired";
  if (dl <= notifyDays) return "nearing_expiration";
  return "active";
}

/* =======================
 * UI Components
 * ======================= */
function StatBox({ value, label, colorClass = "bg-slate-900" }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <div className={`h-2 w-full ${colorClass}`}></div>
      <div className="px-6 py-4">
        <div className="text-3xl font-extrabold text-slate-900">{value ?? 0}</div>
        <div className="mt-1 text-sm text-slate-600">{label}</div>
      </div>
    </div>
  );
}

function StatusPill({ code }) {
  const cls =
    code === "active"
      ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
      : code === "nearing_expiration"
      ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
      : code === "expired"
      ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
      : "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  const label =
    code === "active"
      ? "ใช้งานได้"
      : code === "nearing_expiration"
      ? "ใกล้หมดอายุ"
      : code === "expired"
      ? "หมดอายุ"
      : "—";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

/* =======================
 * Main Page
 * ======================= */
export default function CustomerWarranty() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [totals, setTotals] = useState({
    all: 0,
    active: 0,
    nearing_expiration: 0,
    expired: 0,
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedByHeader, setExpandedByHeader] = useState({});
  const [noteModal, setNoteModal] = useState({
    open: false,
    itemId: null,
    name: "",
    note: "",
  });
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);

  async function fetchData(opts = {}) {
    setLoading(true);
    try {
      const r = await api.get("/customer/warranties", {
        params: { q: opts.q ?? query, status: opts.filter ?? filter },
      });
      setTotals(
        r.data?.totals || {
          all: 0,
          active: 0,
          nearing_expiration: 0,
          expired: 0,
        }
      );
      const rows = r.data?.data || [];
      setData(rows);
      setPage(1);
      setExpandedByHeader((prev) => {
        const next = {};
        for (const w of rows) if (prev[w.id]) next[w.id] = true;
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [filter]);

  // no per-page profile dropdown here — CustomerNavbar handles profile menu/modal

  const hasData = useMemo(() => Array.isArray(data) && data.length > 0, [data]);

  const { totalPages, currentPage, paginated } = useMemo(() => {
    const totalPagesCalc = Math.max(1, Math.ceil((data?.length || 0) / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPagesCalc);
    const start = (safePage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return {
      totalPages: totalPagesCalc,
      currentPage: safePage,
      paginated: (data || []).slice(start, end),
    };
  }, [data, page]);

  async function onSaveNote() {
    await api.patch(`/customer/warranty-items/${noteModal.itemId}/note`, {
      note: noteModal.note,
    });
    setNoteModal({ open: false, itemId: null, name: "", note: "" });
    fetchData();
  }

  async function onDownloadPdf(warrantyId) {
    try {
      const resp = await api.get(`/customer/warranties/${warrantyId}/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `warranty-${warrantyId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      alert("เปิดไฟล์ PDF ไม่ได้");
    }
  }

  const pageNumbers = useMemo(() => {
    const arr = [];
    const total = Math.max(1, Math.ceil((data?.length || 0) / PAGE_SIZE));
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(total, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [data, currentPage]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-sky-100/60 pb-12">
      <main className="mx-auto max-w-6xl px-4 pt-6">

        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">Warranty</div>
            <div className="text-sm text-slate-500">ใบรับประกันของคุณทั้งหมด</div>
          </div>

          <div className="hidden text-right text-sm md:block">
            <div className="font-medium text-slate-900">
              สวัสดี, {user?.customerProfile?.firstName || ""} {user?.customerProfile?.lastName || ""}
            </div>
            <div className="text-xs text-slate-500">ยินดีต้อนรับ</div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatBox value={totals.all} label="ใบรับประกันทั้งหมด" colorClass="bg-slate-900" />
          <StatBox value={totals.active} label="ใช้งานได้" colorClass="bg-emerald-500" />
          <StatBox value={totals.nearing_expiration} label="ใกล้หมดอายุ" colorClass="bg-amber-400" />
          <StatBox value={totals.expired} label="หมดอายุ" colorClass="bg-rose-500" />
        </div>

        {/* Search + Filters */}
        <div className="mt-6 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="flex items-center rounded-2xl bg-white px-4 py-2 shadow ring-1 ring-black/5">
              <span className="text-slate-400">🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchData({ q: query })}
                placeholder="ค้นหาด้วยชื่อสินค้า, ร้านค้า, รหัสรับประกัน"
                className="w-full bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const isActive = filter === f.value;
              const colors = isActive
                ? f.value === "active"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : f.value === "nearing_expiration"
                  ? "bg-amber-500 text-white border-amber-500"
                  : f.value === "expired"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-slate-900 text-white border-slate-900"
                : f.value === "active"
                ? "bg-white text-emerald-700 border-emerald-400"
                : f.value === "nearing_expiration"
                ? "bg-white text-amber-700 border-amber-300"
                : f.value === "expired"
                ? "bg-white text-rose-700 border-rose-300"
                : "bg-white text-slate-800 border-slate-300";
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-4 h-10 rounded-full text-sm border font-medium shadow-sm hover:-translate-y-0.5 transition ${colors}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cards */}
        <div className="mt-6 space-y-5">
          {loading && (
            <div className="rounded-2xl border border-black/10 bg-white p-6 text-center text-slate-600 shadow-sm">
              กำลังโหลดข้อมูล…
            </div>
          )}

          {!loading && !hasData && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              ไม่พบข้อมูล
            </div>
          )}

          {!loading && hasData &&
            paginated.map((w) => {
              const storeName = w?.store?.storeProfile?.storeName || w?.store?.storeName || "ร้านค้า";
              const phone = w?.store?.storeProfile?.phone || "-";
              const expanded = !!expandedByHeader[w.id];
              const itemsCount = (w.items || []).length;

              return (
                <article key={w.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-md transition hover:shadow-lg">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-lg font-semibold text-slate-900">Warranty Card</div>
                        <div className="mt-2 grid gap-1 text-sm text-slate-700 md:grid-cols-2">
                          <div className="truncate">
                            รหัสใบรับประกัน:{" "}
                            <span className="font-medium text-slate-900">{w.code}</span>
                          </div>
                          <div className="truncate">
                            ร้านค้า:{" "}
                            <span className="font-medium text-slate-900">{storeName}</span>
                          </div>
                          <div className="truncate">
                            เบอร์โทรศัพท์:{" "}
                            <span className="font-medium text-slate-900">{phone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => onDownloadPdf(w.id)}
                          className="h-10 min-w-[96px] rounded-full bg-sky-600 px-5 text-sm font-medium text-white shadow transition hover:-translate-y-0.5 hover:bg-sky-500"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedByHeader((prev) => ({
                              ...prev,
                              [w.id]: !prev[w.id],
                            }))
                          }
                          className="rounded-full border border-sky-300 px-4 py-2 text-xs font-semibold text-sky-700 bg-white hover:-translate-y-0.5 hover:bg-sky-50 transition"
                        >
                          {expanded ? "ซ่อนรายละเอียด" : "รายละเอียดเพิ่มเติม"}
                        </button>
                      </div>
                    </div>

                    <p className="mt-4 rounded-xl bg-white/70 p-3 text-xs text-slate-700">
                      ใบนี้มีทั้งหมด {itemsCount} รายการ
                    </p>

                    {expanded && (
                      <div className="mt-4 grid gap-4">
                        {(w.items || []).map((it) => {
                          const code =
                            it._status || deriveItemStatusCode(it, 14);
                          const img = firstImageSrc(it.images);
                          const daysLeft = Number.isFinite(it?._daysLeft)
                            ? it._daysLeft
                            : calcDaysLeft(it?.expiryDate);

                          return (
                            <div
                              key={it.id}
                              className="flex flex-col justify-between gap-6 rounded-2xl bg-white p-4 shadow ring-1 ring-black/5 md:flex-row"
                            >
                              <div className="flex-1 space-y-3">
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="text-base font-semibold text-slate-900">
                                    {it.productName || "-"}
                                  </div>
                                  <StatusPill code={code} />
                                  {Number.isFinite(daysLeft) && (
                                    <span className="text-xs text-slate-500">
                                      ({daysLeft} วัน)
                                    </span>
                                  )}
                                  
                                </div>

                                <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                                  <div>
                                    Serial No.:{" "}
                                    <span className="font-medium text-slate-900">
                                      {it.serial || "-"}
                                    </span>
                                  </div>
                                  <div>
                                    วันที่ซื้อ:{" "}
                                    <span className="font-medium text-slate-900">
                                      {fmtDate(it.purchaseDate)}
                                    </span>
                                  </div>
                                  <div>
                                    วันหมดอายุ:{" "}
                                    <span className="font-medium text-slate-900">
                                      {fmtDate(it.expiryDate)}
                                    </span>
                                  </div>
                                  <div>
                                    เงื่อนไขรับประกัน:{" "}
                                    <span className="font-medium text-slate-900">
                                      {it.coverageNote || "-"}
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  <div className="text-sm font-medium text-slate-700">
                                    หมายเหตุของฉัน
                                  </div>
                                  <div className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                    {it.customerNote?.trim()
                                      ? it.customerNote
                                      : "-"}
                                  </div>
                                  <div className="mt-2">
                                    <button
                                      onClick={() =>
                                        setNoteModal({
                                          open: true,
                                          itemId: it.id,
                                          name: it.productName,
                                          note:
                                            it.customerNote || "",
                                        })
                                      }
                                      className="rounded-full border border-sky-500 px-4 py-2 text-sm font-medium text-sky-600 hover:bg-sky-50"
                                    >
                                      เพิ่มหมายเหตุ
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="grid place-items-center">
                                <div className="relative h-32 w-40 overflow-hidden rounded-2xl border border-slate-300 bg-slate-50">
                                  {img ? (
                                    <img
                                      src={img}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                                      <div className="text-center">
                                        <div className="mb-1 text-2xl">📷</div>
                                        <div>ไม่มีรูปภาพ</div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
        </div>

        {/* Pagination */}
        {!loading && hasData && (
          <div className="mt-6 flex flex-col items-center gap-3 md:flex-row md:justify-between">
            <div className="text-xs text-slate-500">
              หน้า{" "}
              <span className="font-medium text-slate-900">{currentPage}</span>{" "}
              จาก{" "}
              <span className="font-medium text-slate-900">{totalPages}</span> •{" "}
              แสดง{" "}
              {Math.min((currentPage - 1) * PAGE_SIZE + 1, data.length)}–
              {Math.min(currentPage * PAGE_SIZE, data.length)} จาก{" "}
              {data.length} ใบ
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${
                  currentPage === 1
                    ? "cursor-not-allowed bg-white text-slate-300 ring-1 ring-black/10"
                    : "bg-white text-slate-700 ring-1 ring-black/10 hover:bg-slate-50"
                }`}
              >
                ก่อนหน้า
              </button>
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${
                    n === currentPage
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-700 ring-1 ring-black/10 hover:bg-slate-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${
                  currentPage === totalPages
                    ? "cursor-not-allowed bg-white text-slate-300 ring-1 ring-black/10"
                    : "bg-white text-slate-700 ring-1 ring-black/10 hover:bg-slate-50"
                }`}
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal: เพิ่มหมายเหตุ */}
      {noteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between rounded-t-3xl bg-gradient-to-r from-sky-600 to-sky-500 px-6 py-4 text-white">
              <div className="text-base font-semibold">
                เพิ่มหมายเหตุ - {noteModal.name}
              </div>
              <button
                onClick={() =>
                  setNoteModal({
                    open: false,
                    itemId: null,
                    name: "",
                    note: "",
                  })
                }
                className="text-2xl text-white/80 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5">
              <textarea
                rows={5}
                value={noteModal.note}
                onChange={(e) =>
                  setNoteModal({ ...noteModal, note: e.target.value })}
                className="w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
                placeholder="พิมพ์หมายเหตุของคุณ"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() =>
                    setNoteModal({
                      open: false,
                      itemId: null,
                      name: "",
                      note: "",
                    })
                  }
                  className="rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-600 shadow ring-1 ring-black/10 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={onSaveNote}
                  className="rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-sky-500"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}