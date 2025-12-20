import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const STATUS_META = {
  OPEN: { label: "เปิดเรื่อง", cls: "bg-amber-500/15 text-amber-200 border-amber-500/30" },
  IN_PROGRESS: { label: "กำลังดำเนินการ", cls: "bg-sky-500/15 text-sky-200 border-sky-500/30" },
  RESOLVED: { label: "แก้ไขแล้ว", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" },
  REJECTED: { label: "ปฏิเสธ", cls: "bg-red-500/15 text-red-200 border-red-500/30" },
};

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

function StatusPill({ status }) {
  const meta = STATUS_META[status] || { label: status || "—", cls: "bg-white/5 text-white/70 border-white/10" };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${meta.cls}`}>
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
  const phone = user.role === "CUSTOMER"
    ? (user.customerProfile?.phone || "")
    : (user.role === "STORE" ? (user.storeProfile?.phone || "") : "");
  const parts = [email, phone].filter(Boolean);
  return parts.join(" • ");
}

export default function Complaints() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [selected, setSelected] = useState(null); // modal

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/admin/complaints", { params: { status } });
      setRows(data.complaints || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "โหลดรายการร้องเรียนไม่สำเร็จ");
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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">คำขอ/ร้องเรียน</div>
          <div className="text-sm text-white/60">ดูรายละเอียด, ผู้ส่ง, และจัดการสถานะคำร้องเรียน</div>
        </div>
        <div className="text-sm text-white/60">
          ทั้งหมด: <span className="text-white">{rows.length}</span> รายการ
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <select
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2"
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
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 min-w-[240px]"
          placeholder="ค้นหา ผู้ส่ง / subject / category / message..."
        />

        <button
          onClick={load}
          className="rounded-xl bg-white text-zinc-950 px-4 py-2 font-medium"
        >
          รีเฟรช
        </button>

        {loading && <div className="text-sm text-white/60">กำลังโหลด...</div>}
      </div>

      {err && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="p-3 text-left w-[180px]">เวลา</th>
              <th className="p-3 text-left w-[220px]">ผู้ส่ง</th>
              <th className="p-3 text-left w-[160px]">หมวดหมู่</th>
              <th className="p-3 text-left">Subject</th>
              <th className="p-3 text-left">รายละเอียด (ย่อ)</th>
              <th className="p-3 text-left w-[160px]">Status</th>
              <th className="p-3 text-left w-[260px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-t border-white/10 hover:bg-white/5 cursor-pointer"
                onClick={() => setSelected(c)}
                title="คลิกเพื่อดูรายละเอียด"
              >
                <td className="p-3">{fmtDT(c.createdAt)}</td>

                <td className="p-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-white/90 truncate">
                      {senderName(c.user)}
                    </div>
                    <div className="text-xs text-white/60 truncate">
                      {senderSub(c.user)}
                    </div>
                  </div>
                </td>

                <td className="p-3 text-white/80">{c.category || "—"}</td>
                <td className="p-3 font-medium">{c.subject}</td>
                <td className="p-3 text-white/70">{clip(c.message, 90)}</td>
                <td className="p-3">
                  <StatusPill status={c.status} />
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSt(c.id, "IN_PROGRESS")}
                      className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/15"
                    >
                      รับเรื่อง
                    </button>
                    <button
                      onClick={() => setSt(c.id, "RESOLVED")}
                      className="rounded-lg bg-emerald-500/20 px-3 py-1 hover:bg-emerald-500/25"
                    >
                      ปิดเคส
                    </button>
                    <button
                      onClick={() => setSt(c.id, "REJECTED")}
                      className="rounded-lg bg-red-500/20 px-3 py-1 hover:bg-red-500/25"
                    >
                      ปฏิเสธ
                    </button>
                    <button
                      onClick={() => setSelected(c)}
                      className="rounded-lg bg-sky-500/15 px-3 py-1 hover:bg-sky-500/20"
                    >
                      ดูรายละเอียด
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && !filtered.length && (
              <tr>
                <td className="p-3 text-white/60" colSpan={7}>
                  ยังไม่มีคำขอ/ร้องเรียน (ต้องมีฝั่ง user สร้าง complaint ก่อน)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal รายละเอียด */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelected(null)} />
          <div className="relative mx-auto mt-10 w-[min(980px,92vw)] rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden">
            <div className="bg-white/5 px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{selected.subject}</div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
                  <div>
                    ผู้ส่ง:{" "}
                    <span className="text-white/85 font-semibold">
                      {senderName(selected.user)}
                    </span>
                    <span className="text-white/40">{"  "}</span>
                    <span className="text-white/60">{senderSub(selected.user)}</span>
                  </div>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
                  <div>
                    หมวด: <span className="text-white/80">{selected.category || "—"}</span>
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
                <div className="text-sm font-semibold text-white/80">รายละเอียด</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80 whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>

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

              <div className="text-xs text-white/40">
                * คลิกพื้นหลังหรือกด ESC เพื่อปิดหน้าต่างนี้
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
