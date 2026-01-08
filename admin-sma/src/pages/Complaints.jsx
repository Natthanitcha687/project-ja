// admin-sma/src/pages/Complaints.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const STATUS_META = {
  OPEN: { label: "เปิดเรื่อง", cls: "bg-amber-50 text-amber-700 border-amber-200" },
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

function StatusPill({ status, className = "" }) {
  const meta = STATUS_META[status] || {
    label: status || "—",
    cls: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        meta.cls,
        className,
      ].join(" ")}
    >
      {meta.label}
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
  return `${b}${tail}`;
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

export default function Complaints() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [selected, setSelected] = useState(null); // modal
  const [page, setPage] = useState(1);

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
      if (e.key === "Escape") setSelected(null);
    }
    if (selected) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
          <div className="text-sm text-slate-500">ดูรายละเอียด, ผู้ส่ง, และจัดการสถานะการแจ้งปัญหา</div>
        </div>

        <div className="text-sm text-slate-500">
          ทั้งหมด: <span className="text-slate-900 font-semibold">{rows.length}</span> รายการ
        </div>
      </div>

      {/* Controls: 3 sizes */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[220px_1fr_110px] items-center">
        <select
          className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">ทั้งหมด</option>
          <option value="OPEN">OPEN (เปิดเรื่อง)</option>
          <option value="IN_PROGRESS">IN_PROGRESS (กำลังดำเนินการ)</option>
          <option value="RESOLVED">RESOLVED (แก้ไขแล้ว)</option>
          <option value="REJECTED">REJECTED (ปฏิเสธ)</option>
        </select>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          placeholder="ค้นหา ผู้ส่ง / subject / category / message..."
        />

        <button
          onClick={load}
          className="w-full rounded-xl bg-sky-700 text-white px-4 py-2 font-semibold shadow-sm hover:bg-sky-800 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={loading}
        >
          รีเฟรช
        </button>
      </div>

      {loading && <div className="mt-2 text-sm text-slate-500">กำลังโหลด...</div>}

      {err && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
              แสดง {showingFrom}-{showingTo} จาก {total} รายการ (ผลลัพธ์จากการค้นหา/ตัวกรอง)
              <span className="text-slate-400"> • หน้า {safePage}/{totalPages}</span>
            </>
          ) : (
            "ยังไม่มีการแจ้งปัญหา"
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

          <PageButton
            disabled={loading || safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            →
          </PageButton>
        </div>
      </div>

      {/* ===== Mobile + Tablet (Cards) =====
          - Mobile: 1 col
          - Tablet (iPad 768): 2 cols (sm:grid-cols-2)
          - Hide on Desktop (lg+) */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
        {pageRows.map((c) => {
          const attCount = Array.isArray(c.images) ? c.images.length : 0;
          return (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">{fmtDT(c.createdAt)}</div>
                  <div className="mt-1 font-semibold text-slate-900 break-words">{c.subject}</div>
                </div>
                <StatusPill status={c.status} className="shrink-0" />
              </div>

              <div className="mt-3">
                <div className="text-xs text-slate-500">ผู้ส่ง</div>
                <div className="font-medium text-slate-900 break-words">{senderName(c.user)}</div>
                <div className="text-xs text-slate-500 break-words">{senderSub(c.user)}</div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {c.category || "—"}
                </span>
                {attCount > 0 && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    📎 {attCount}
                  </span>
                )}
              </div>

              <div className="mt-3 text-sm text-slate-700 whitespace-pre-wrap break-words">
                {clip(c.message, 140)}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelected(c)}
                  className="rounded-xl bg-sky-50 text-sky-700 border border-sky-200 px-3 py-2 text-sm font-semibold hover:bg-sky-100"
                >
                  ดูรายละเอียด
                </button>

                <button
                  onClick={() => setSt(c.id, "IN_PROGRESS")}
                  className="rounded-xl bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                >
                  รับเรื่อง
                </button>

                <button
                  onClick={() => setSt(c.id, "RESOLVED")}
                  className="rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 text-sm font-semibold hover:bg-emerald-100"
                >
                  ปิดเคส
                </button>

                <button
                  onClick={() => setSt(c.id, "REJECTED")}
                  className="rounded-xl bg-rose-50 text-rose-700 border border-rose-200 px-3 py-2 text-sm font-semibold hover:bg-rose-100"
                >
                  ปฏิเสธ
                </button>
              </div>
            </div>
          );
        })}

        {!loading && !pageRows.length && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-slate-500 sm:col-span-2">
            ยังไม่มีการแจ้งปัญหา (ต้องมีฝั่ง user สร้าง complaint ก่อน)
          </div>
        )}
      </div>

      {/* ===== Desktop (Table) =====
          - Show only on lg+ to avoid iPad column-crush */}
      <div className="mt-4 hidden lg:block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left w-[180px]">เวลา</th>
              <th className="p-3 text-left w-[240px]">ผู้ส่ง</th>
              <th className="p-3 text-left w-[160px]">หมวดหมู่</th>
              <th className="p-3 text-left">หัวข้อ</th>
              <th className="p-3 text-left">รายละเอียด (ย่อ)</th>
              <th className="p-3 text-left w-[160px]">สถานะ</th>
              <th className="p-3 text-left w-[260px]">การดำเนินการ</th>
            </tr>
          </thead>

          <tbody className="text-slate-800">
            {pageRows.map((c) => {
              const attCount = Array.isArray(c.images) ? c.images.length : 0;
              return (
                <tr
                  key={c.id}
                  className="border-t border-slate-200 hover:bg-slate-50/70 cursor-pointer"
                  onClick={() => setSelected(c)}
                  title="คลิกเพื่อดูรายละเอียด"
                >
                  <td className="p-3 whitespace-nowrap">{fmtDT(c.createdAt)}</td>

                  <td className="p-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{senderName(c.user)}</div>
                      <div className="text-xs text-slate-500 truncate">{senderSub(c.user)}</div>
                    </div>
                  </td>

                  <td className="p-3 text-slate-700">
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

                  <td className="p-3 text-slate-600">
                    <div className="truncate" title={c.message || ""}>
                      {clip(c.message, 90)}
                      {attCount > 0 && <span className="ml-2 text-xs text-slate-500">📎 {attCount}</span>}
                    </div>
                  </td>

                  <td className="p-3">
                    <StatusPill status={c.status} />
                  </td>

                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSt(c.id, "IN_PROGRESS")}
                        className="rounded-lg bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1 font-semibold hover:bg-slate-100"
                      >
                        รับเรื่อง
                      </button>
                      <button
                        onClick={() => setSt(c.id, "RESOLVED")}
                        className="rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 font-semibold hover:bg-emerald-100"
                      >
                        ปิดเคส
                      </button>
                      <button
                        onClick={() => setSt(c.id, "REJECTED")}
                        className="rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 font-semibold hover:bg-rose-100"
                      >
                        ปฏิเสธ
                      </button>
                      <button
                        onClick={() => setSelected(c)}
                        className="rounded-lg bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 font-semibold hover:bg-sky-100"
                      >
                        ดูรายละเอียด
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && !pageRows.length && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={7}>
                  ยังไม่มีการแจ้งปัญหา (ต้องมีฝั่ง user สร้าง complaint ก่อน)
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={7}>
                  กำลังโหลด...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal รายละเอียด (โทนเข้ม) */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelected(null)} />

          <div className="relative mx-auto mt-10 w-[min(980px,92vw)] rounded-2xl border border-white/10 bg-zinc-950 text-white shadow-2xl overflow-hidden">
            <div className="bg-white/5 px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate text-white">{selected.subject}</div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
                  <div>
                    ผู้ส่ง:{" "}
                    <span className="text-white font-semibold">{senderName(selected.user)}</span>{" "}
                    <span className="text-white/60">{senderSub(selected.user)}</span>
                  </div>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
                  <div>
                    หมวด: <span className="text-white/90">{selected.category || "—"}</span>
                  </div>
                  <div>สร้างเมื่อ: {fmtDT(selected.createdAt)}</div>
                  <div>อัปเดต: {fmtDT(selected.updatedAt)}</div>
                  <div className="text-white/40">ID: {selected.id}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StatusPill status={selected.status} />
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                >
                  ปิด
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <div className="text-sm font-semibold text-white/85">รายละเอียด</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/85 whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>

              {/* รูปแนบอ้างอิงปัญหา */}
              {Array.isArray(selected.images) && selected.images.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-white/85">
                    รูปแนบอ้างอิง ({selected.images.length})
                  </div>

                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {selected.images.map((p, idx) => {
                      const src = absolutize(p);
                      return (
                        <a
                          key={`${p}-${idx}`}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                          className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/5"
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
                          <div className="px-3 py-2 text-[11px] text-white/60 truncate">{String(p)}</div>
                        </a>
                      );
                    })}
                  </div>

                  <div className="mt-2 text-xs text-white/40">* คลิกรูปเพื่อเปิดดูแบบเต็ม (เปิดแท็บใหม่)</div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <button
                  onClick={() => setSt(selected.id, "IN_PROGRESS")}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                >
                  รับเรื่อง
                </button>
                <button
                  onClick={() => setSt(selected.id, "RESOLVED")}
                  className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm hover:bg-emerald-500/25"
                >
                  ปิดเคส
                </button>
                <button
                  onClick={() => setSt(selected.id, "REJECTED")}
                  className="rounded-xl bg-red-500/20 px-4 py-2 text-sm hover:bg-red-500/25"
                >
                  ปฏิเสธ
                </button>
              </div>

              <div className="text-xs text-white/40">* คลิกพื้นหลังหรือกด ESC เพื่อปิดหน้าต่างนี้</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
