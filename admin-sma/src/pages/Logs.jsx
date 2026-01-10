// admin-sma/src/pages/Logs.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";

function fmtDT(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return "—";
  return d.toLocaleString("th-TH");
}

function clip(s, n = 80) {
  const t = (s ?? "").toString();
  if (!t) return "—";
  if (t.length <= n) return t;
  return t.slice(0, n) + "…";
}

function safeStr(v) {
  if (v == null) return "";
  try {
    if (typeof v === "string") return v;
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function actorText(l) {
  const a = l?.actor;
  if (!a) return "ระบบ/ไม่ทราบ";
  const id = a.id != null ? `#${a.id}` : "";
  const role = a.role ? `(${a.role})` : "";
  return `${a.email || "—"} ${id} ${role}`.trim();
}

// ✅ แสดง Target เป็น "email (ROLE)" เมื่อเป็น User / Complaint
function targetText(l) {
  if (!l) return "—";
  const tt = (l.targetType || "").toString().toLowerCase();

  if (tt === "user") {
    const u = l.targetUser;
    if (u?.email) return `${u.email} (${u.role || "—"})`;
    return l.targetId != null ? `User:${l.targetId}` : "User:—";
  }

  if (tt === "complaint") {
    const u = l.targetComplaintUser;
    if (u?.email) return `${u.email} (${u.role || "—"})`;
    return l.targetId != null ? `Complaint:${l.targetId}` : "Complaint:—";
  }

  return l.targetType ? `${l.targetType}:${l.targetId}` : "—";
}

function metaOf(l) {
  const m = l?.meta;
  if (!m) return null;
  if (typeof m === "object") return m;
  try {
    return JSON.parse(m);
  } catch {
    return { raw: m };
  }
}

function resultOf(l) {
  const m = metaOf(l);
  const r = m?.result;
  if (!r) return "";
  return String(r).toUpperCase();
}

function reasonOf(l) {
  const m = metaOf(l);
  return m?.reason || m?.error || "";
}

function changeSummary(l) {
  const m = metaOf(l);
  if (!m) return "";

  const b = m.before || null;
  const a = m.after || null;

  if (l.action === "SET_USER_STATUS") {
    const bSt = b?.status ?? "";
    const aSt = a?.status ?? m?.status ?? "";
    const days = m?.days != null ? ` • ${m.days} วัน` : "";
    const until = m?.suspendedUntil ? ` • ถึง ${fmtDT(m.suspendedUntil)}` : "";
    const rs = m?.reason ? ` • เหตุผล: ${m.reason}` : "";
    const core = bSt && aSt ? `${bSt} → ${aSt}` : aSt ? `${aSt}` : "";
    return [core, days, until, rs].join("").trim();
  }

  if (l.action === "SET_COMPLAINT_STATUS") {
    const bSt = b?.status ?? "";
    const aSt = a?.status ?? "";
    return bSt && aSt ? `${bSt} → ${aSt}` : aSt ? `${aSt}` : "";
  }

  if (l.action === "ADMIN_LOGIN") {
    const r = m?.result ? String(m.result).toUpperCase() : "";
    const why = m?.reason ? ` • ${m.reason}` : "";
    const em = m?.email ? ` • ${m.email}` : "";
    return `${r}${em}${why}`.trim();
  }

  if (b || a) {
    const bKeys = b ? Object.keys(b) : [];
    const aKeys = a ? Object.keys(a) : [];
    const keys = Array.from(new Set([...bKeys, ...aKeys])).slice(0, 4);
    if (!keys.length) return "";
    const parts = keys
      .map((k) => {
        const bv = b?.[k];
        const av = a?.[k];
        if (bv === av) return null;
        return `${k}:${safeStr(bv)}→${safeStr(av)}`;
      })
      .filter(Boolean);
    return parts.join(" • ");
  }

  const r = reasonOf(l);
  return r ? `เหตุผล: ${r}` : "";
}

function ResultPill({ value }) {
  const v = (value || "").toUpperCase();
  const cls =
    v === "SUCCESS"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : v === "FAIL"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  const label = v || "—";
  return (
    <span className={["inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", cls].join(" ")}>
      {label}
    </span>
  );
}

function ActionPill({ value }) {
  return (
    <span
      className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 truncate align-middle"
      title={value || ""}
    >
      {value || "—"}
    </span>
  );
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
        active ? "bg-sky-700 text-white border-sky-700 hover:bg-sky-800" : "bg-white text-slate-700 border-slate-200",
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

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [result, setResult] = useState(""); // "", SUCCESS, FAIL
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState(null); // modal

  // ✅ IP Popover state
  const [ipPop, setIpPop] = useState(null); // { ip, left, top, width }
  const ipPopRef = useRef(null);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const r = await api.get("/admin/audit/logs");
      setLogs(r.data.logs || []);
      setPage(1);
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

  // ESC ปิด modal + ปิด popover IP
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setSelected(null);
        setIpPop(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ปิด popover IP เมื่อคลิกนอกกล่อง
  useEffect(() => {
    if (!ipPop) return;

    function onDown(e) {
      const box = ipPopRef.current;
      if (box && box.contains(e.target)) return;
      setIpPop(null);
    }
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [ipPop]);

  useEffect(() => {
    setPage(1);
  }, [q, result]);

  const filtered = useMemo(() => {
    const query = (q || "").trim().toLowerCase();
    const wantResult = (result || "").trim().toUpperCase();

    return (logs || []).filter((l) => {
      if (wantResult) {
        const r = resultOf(l);
        if ((r || "").toUpperCase() !== wantResult) return false;
      }

      if (!query) return true;

      const who = actorText(l).toLowerCase();
      const tgt = targetText(l).toLowerCase();
      const hay = [l.action || "", who, tgt, l.ip || "", l.userAgent || "", safeStr(l.meta)]
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [logs, q, result]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageLogs = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const pageItems = useMemo(() => buildPageItems(safePage, totalPages), [safePage, totalPages]);

  const showingFrom = total ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = total ? Math.min(safePage * PAGE_SIZE, total) : 0;

  function openDetail(l) {
    setSelected(l);
  }

  function copyMeta(l) {
    const m = metaOf(l);
    const text = m ? JSON.stringify(m, null, 2) : "";
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  function openIpPopover(e, ip) {
    e.preventDefault();
    e.stopPropagation();

    const full = (ip ?? "").toString().trim();
    if (!full) return;

    if (ipPop?.ip === full) {
      setIpPop(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const WIDTH = 340;
    const PAD = 12;

    let left = rect.left;
    left = Math.min(left, window.innerWidth - WIDTH - PAD);
    left = Math.max(PAD, left);

    let top = rect.bottom + 8;
    const estHeight = 120;
    if (top + estHeight > window.innerHeight - PAD) {
      top = rect.top - estHeight - 8;
      top = Math.max(PAD, top);
    }

    setIpPop({ ip: full, left, top, width: WIDTH });
  }

  function copyIp(ip) {
    const text = (ip ?? "").toString();
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <div className="text-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-slate-900">Activity Logs</div>
          <div className="mt-1 text-sm text-slate-500">
            บันทึกการกระทำสำคัญในระบบ (การจัดการสถาะบัญชีผู้ใช้โดยแอดมิน ระงับ ปลดระงับ ลบบัญชี / กาารสร้างใบรับประกันและแก้ไข / การแจ้งปัญหา )
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

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_180px_110px] items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          placeholder="ค้นหา: actor / action / target / ip / user-agent / meta..."
        />

        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
          title="กรองผลลัพธ์"
        >
          <option value="">ผลลัพธ์: ทั้งหมด</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAIL">FAIL</option>
        </select>

        <button
          onClick={() => {
            setQ("");
            setResult("");
          }}
          className="w-full rounded-xl bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 font-semibold shadow-sm hover:bg-slate-100"
          disabled={loading}
        >
          ล้าง
        </button>
      </div>

      {/* Summary + Pagination */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          {loading ? (
            "กำลังโหลด…"
          ) : total ? (
            <>
              แสดง {showingFrom}-{showingTo} จาก {total} รายการ (หลังกรอง/ค้นหา)
              <span className="text-slate-400"> • หน้า {safePage}/{totalPages}</span>
            </>
          ) : (
            "ยังไม่มี log"
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
        {pageLogs.map((l) => {
          const tgt = targetText(l);
          const rs = resultOf(l);
          const why = reasonOf(l);
          const sum = changeSummary(l);

          return (
            <div key={l.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">Time</div>
                  <div className="text-sm font-semibold text-slate-900">{fmtDT(l.createdAt)}</div>

                  <div className="mt-2 text-xs text-slate-500">Who</div>
                  <div className="text-sm text-slate-900 break-words">{actorText(l)}</div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  <ActionPill value={l.action} />
                  <ResultPill value={rs} />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3">
                <div>
                  <div className="text-xs text-slate-500">Target</div>
                  <div className="text-sm text-slate-800 break-words">{tgt}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-slate-500">IP</div>

                    {l.ip ? (
                      <button
                        type="button"
                        onClick={(e) => openIpPopover(e, l.ip)}
                        className="mt-1 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        title="Show IP"
                      >
                        Show
                      </button>
                    ) : (
                      <div className="mt-1 text-sm text-slate-400">—</div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-slate-500">User-Agent</div>
                    <div className="text-sm text-slate-800 break-words" title={l.userAgent || ""}>
                      {clip(l.userAgent || "—", 40)}
                    </div>
                  </div>
                </div>

                {(sum || why) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">Meta</div>
                    <div className="text-sm text-slate-800 break-words">{sum || (why ? `เหตุผล: ${why}` : "—")}</div>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => openDetail(l)}
                  className="rounded-xl bg-sky-50 text-sky-700 border border-sky-200 px-3 py-2 text-sm font-semibold hover:bg-sky-100"
                >
                  ดูรายละเอียด
                </button>
                <button
                  onClick={() => copyMeta(l)}
                  className="rounded-xl bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                  disabled={!metaOf(l)}
                  title={!metaOf(l) ? "ไม่มี meta" : "คัดลอก meta JSON"}
                >
                  คัดลอก meta
                </button>
              </div>
            </div>
          );
        })}

        {!pageLogs.length && !loading && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-slate-500">ยังไม่มี log</div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-slate-500">กำลังโหลด...</div>
        )}
      </div>

      {/* ===== Tablet/Desktop (Table) ===== */}
      <div className="mt-4 hidden md:block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left w-[190px]">Time</th>
              <th className="p-3 text-left w-[260px]">Who</th>
              <th className="p-3 text-left w-[220px]">Action</th>
              <th className="p-3 text-left w-[220px]">Target</th>
              <th className="p-3 text-left w-[140px]">Result</th>

              {/* ✅ ปุ่ม Show อย่างเดียว */}
              <th className="p-3 text-left w-[140px]">IP</th>

              <th className="p-3 text-left hidden xl:table-cell">User-Agent</th>
              <th className="p-3 text-left hidden xl:table-cell">Meta (สรุป)</th>
              <th className="p-3 text-left w-[140px]"> </th>
            </tr>
          </thead>

          <tbody className="text-slate-800">
            {pageLogs.map((l) => {
              const tgt = targetText(l);
              const rs = resultOf(l);
              const sum = changeSummary(l);
              const ua = l.userAgent || "";

              return (
                <tr
                  key={l.id}
                  className="border-t border-slate-200 hover:bg-slate-50/70 cursor-pointer"
                  onClick={() => openDetail(l)}
                  title="คลิกเพื่อดูรายละเอียด"
                >
                  <td className="p-3 whitespace-nowrap">{fmtDT(l.createdAt)}</td>

                  <td className="p-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate" title={actorText(l)}>
                        {actorText(l)}
                      </div>
                      {l.actor?.id != null ? (
                        <div className="text-xs text-slate-500 truncate">actorUserId: {l.actor.id}</div>
                      ) : (
                        <div className="text-xs text-slate-500 truncate">actorUserId: —</div>
                      )}
                    </div>
                  </td>

                  <td className="p-3">
                    <ActionPill value={l.action} />
                  </td>

                  <td className="p-3 text-slate-700">
                    <div className="truncate" title={tgt}>
                      <span className="font-medium text-slate-900">{tgt}</span>
                    </div>
                  </td>

                  <td className="p-3">
                    <ResultPill value={rs} />
                  </td>

                  {/* ✅ IP: Show button */}
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    {l.ip ? (
                      <button
                        type="button"
                        onClick={(e) => openIpPopover(e, l.ip)}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        title="Show IP"
                      >
                        Show
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  <td className="p-3 hidden xl:table-cell">
                    <div className="truncate text-slate-700" title={ua}>
                      {ua ? clip(ua, 60) : "—"}
                    </div>
                  </td>

                  <td className="p-3 hidden xl:table-cell">
                    <div className="truncate text-slate-700" title={sum || safeStr(metaOf(l))}>
                      {sum || (metaOf(l) ? clip(safeStr(metaOf(l)), 70) : "—")}
                    </div>
                  </td>

                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openDetail(l)}
                        className="rounded-lg bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 font-semibold hover:bg-sky-100"
                      >
                        รายละเอียด
                      </button>
                      <button
                        onClick={() => copyMeta(l)}
                        className="rounded-lg bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1 font-semibold hover:bg-slate-100"
                        disabled={!metaOf(l)}
                        title={!metaOf(l) ? "ไม่มี meta" : "คัดลอก meta JSON"}
                      >
                        คัดลอก
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!pageLogs.length && !loading && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={9}>
                  ยังไม่มี log
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={9}>
                  กำลังโหลด...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ IP Popover (fixed) ไม่โดน overflow-hidden ตัดแน่นอน */}
      {ipPop && (
        <div
          ref={ipPopRef}
          className="fixed z-[9999] rounded-2xl border border-slate-200 bg-white shadow-xl p-4"
          style={{ left: ipPop.left, top: ipPop.top, width: ipPop.width }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">IP Address</div>
              <div className="mt-1 text-xs text-slate-500">คลิกนอกกล่องหรือกด ESC เพื่อปิด</div>
            </div>
            <button
              type="button"
              onClick={() => setIpPop(null)}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ปิด
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="font-mono text-sm text-slate-900 break-all">{ipPop.ip}</div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => copyIp(ipPop.ip)}
              className="rounded-xl bg-sky-700 text-white px-3 py-2 text-xs font-semibold hover:bg-sky-800"
            >
              คัดลอก IP
            </button>
          </div>
        </div>
      )}

      {/* Modal รายละเอียด */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelected(null)} />

          <div className="relative w-full max-w-[980px] max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)] rounded-2xl border border-white/10 bg-zinc-950 text-white shadow-2xl overflow-hidden flex flex-col">
            <div className="shrink-0 bg-white/5 px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate text-white">{selected.action || "Log Detail"}</div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
                  <div>
                    เวลา: <span className="text-white/90">{fmtDT(selected.createdAt)}</span>
                  </div>
                  <div>
                    Who: <span className="text-white font-semibold">{actorText(selected)}</span>
                  </div>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
                  <div>
                    Target: <span className="text-white/90">{targetText(selected)}</span>
                  </div>
                  <div>IP: {selected.ip || "—"}</div>
                  <div className="text-white/40">ID: {selected.id}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <ResultPill value={resultOf(selected)} />
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                >
                  ปิด
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-4">
              <div>
                <div className="text-sm font-semibold text-white/85">User-Agent</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 break-words">
                  {selected.userAgent || "—"}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-white/85">Meta Summary</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 break-words">
                  {changeSummary(selected) || "—"}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white/85">Meta JSON (หลักฐาน)</div>
                  <button
                    onClick={() => copyMeta(selected)}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                    disabled={!metaOf(selected)}
                  >
                    คัดลอก JSON
                  </button>
                </div>

                <pre className="mt-2 max-h-[360px] overflow-auto rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-white/80 whitespace-pre-wrap break-words">
{metaOf(selected) ? JSON.stringify(metaOf(selected), null, 2) : "—"}
                </pre>
              </div>

              <div className="text-xs text-white/40">* คลิกพื้นหลังหรือกด ESC เพื่อปิดหน้าต่างนี้</div>
            </div>
          </div>
        </div>
      )}

      {!loading && filtered.length >= 200 && (
        <div className="mt-3 text-xs text-slate-500">
          หมายเหตุ: ตอนนี้ backend ดึงมาเฉพาะรายการล่าสุด 200 รายการ ถ้าต้องการดูเก่ากว่านี้ต้องเพิ่ม pagination ที่ backend (skip/take)
        </div>
      )}
    </div>
  );
}
