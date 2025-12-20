import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

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
      ? { label: "ใช้งานอยู่", cls: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200" }
      : status === "SUSPENDED"
      ? { label: "ถูกระงับ", cls: "bg-rose-100 text-rose-800 ring-1 ring-rose-200" }
      : { label: status || "—", cls: "bg-slate-100 text-slate-700 ring-1 ring-slate-200" };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>
      {meta.label}
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

function ModalShell({ open, onClose, children, widthClass = "max-w-xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className={`w-full ${widthClass} rounded-2xl bg-white shadow-2xl`}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Stores() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(""); // "" | ACTIVE | SUSPENDED
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

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

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/stores", { params: { q, status } });
      setRows(data?.stores || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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

    const days =
      sDaysPreset === -1
        ? (sDaysCustom || "").trim()
        : String(sDaysPreset);

    if (suspendTarget.status === "ACTIVE") {
      // suspend mode -> ต้องมี reason
      if (!sReason.trim()) return alert("กรุณาระบุเหตุผล");
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
          reason: sReason.trim(),
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
    if (!dReason.trim()) return alert("กรุณาระบุเหตุผลในการลบ");

    setDSubmitting(true);
    try {
      await api.delete(`/admin/stores/${deleteTarget.id}`, {
        data: { reason: dReason.trim() },
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
        <div className="text-sm text-slate-500">
          จัดการบัญชีร้านค้าและดูเมนู Portal แยกของแต่ละร้าน
        </div>
      </div>

      {/* Filter row (ตามรูป: dropdown + search) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">ร้านค้าทั้งหมด</option>
          <option value="ACTIVE">ใช้งานอยู่</option>
          <option value="SUSPENDED">ถูกระงับ</option>
        </select>

        <div className="flex flex-1 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-slate-400">🔍</span>
            <input
              className="w-full bg-transparent text-sm outline-none"
              placeholder="ค้นหาร้านค้า"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <button
            onClick={load}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm md:col-span-2 xl:col-span-3">
            กำลังโหลดข้อมูล...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm md:col-span-2 xl:col-span-3">
            <div className="text-sm font-semibold text-slate-900">ไม่มีร้านค้า</div>
            <div className="mt-1 text-xs text-slate-500">ลองเปลี่ยนคำค้นหา/ตัวกรอง</div>
          </div>
        ) : (
          filtered.map((s) => {
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
                        <div className="truncate text-base font-extrabold text-slate-900">
                          {name}
                        </div>
                        <div className="truncate text-xs text-slate-500">{type}</div>
                      </div>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-500">การรับประกัน</div>
                      <div className="text-lg font-extrabold text-slate-900">{warrantiesCount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">ลูกค้า</div>
                      <div className="text-lg font-extrabold text-slate-900">{customersCount}</div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    <div>อีเมล</div>
                    <div className="text-slate-700 font-semibold">{s.email}</div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    วันที่เข้าร่วม: <span className="font-semibold text-slate-700">{fmtDate(s.createdAt)}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 bg-slate-50/60 p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => openPortalModal(s.id)}
                      className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-extrabold text-sky-700 hover:bg-sky-50"
                    >
                      🧩 Portal
                    </button>

                    <button
                      onClick={() => openSuspendModal(s)}
                      className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-extrabold text-amber-700 hover:bg-amber-50"
                    >
                      {s.status === "SUSPENDED" ? "ปลดระงับ" : "ระงับบัญชี"}
                    </button>

                    <button
                      onClick={() => openDeleteModal(s)}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-50"
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

      {/* ============ Portal Modal (ตามรูป 2) ============ */}
      <ModalShell
        open={openPortal}
        onClose={() => setOpenPortal(false)}
        widthClass="max-w-2xl"
      >
        <div className="p-6">
          {portalLoading ? (
            <div className="text-sm text-slate-600">กำลังโหลด Portal...</div>
          ) : !portal ? (
            <div className="text-sm text-slate-600">ไม่พบข้อมูล</div>
          ) : (
            <>
              <div className="text-lg font-extrabold text-slate-900">
                Portal : {portal?.store?.storeProfile?.storeName || "-"}
              </div>
              <div className="text-sm text-slate-500">
                ดูรายละเอียดและสถิติการใช้งานของร้านค้า
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-slate-500">ชื่อร้านค้า</div>
                    <div className="col-span-2 font-semibold text-slate-900">
                      {portal?.store?.storeProfile?.storeName || "-"}
                    </div>

                    <div className="text-slate-500">ประเภท</div>
                    <div className="col-span-2 font-semibold text-slate-900">
                      {portal?.store?.storeProfile?.storeType || "-"}
                    </div>

                    <div className="text-slate-500">อีเมล</div>
                    <div className="col-span-2 font-semibold text-slate-900">
                      {portal?.store?.email || "-"}
                    </div>

                    <div className="text-slate-500">วันที่เข้าร่วม</div>
                    <div className="col-span-2 font-semibold text-slate-900">
                      {fmtDate(portal?.store?.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs text-slate-500">การรับประกัน</div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">
                      {portal?.stats?.warrantyCount ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs text-slate-500">ลูกค้า</div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">
                      {portal?.stats?.customerCount ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs text-slate-500">อัตราความสำเร็จ</div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">
                      {portal?.stats?.successRatePct != null ? `${portal.stats.successRatePct}%` : "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs text-slate-500">เวลาตอบสนองเฉลี่ย</div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">
                      {portal?.stats?.avgResponseHours != null ? `${portal.stats.avgResponseHours}h` : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Table */}
              <div className="mt-5 rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-sm font-extrabold text-slate-900">
                  กิจกรรมล่าสุด
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-white text-slate-500">
                    <tr className="border-t border-slate-200">
                      <th className="p-3 text-left">การกระทำ</th>
                      <th className="p-3 text-left">เป้าหมาย</th>
                      <th className="p-3 text-left">เวลา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(portal?.activities || []).map((a, idx) => (
                      <tr key={idx} className="border-t border-slate-200">
                        <td className="p-3">{a.action}</td>
                        <td className="p-3 font-semibold">{a.subject}</td>
                        <td className="p-3">{fmtDateTime(a.at)}</td>
                      </tr>
                    ))}
                    {!portal?.activities?.length && (
                      <tr className="border-t border-slate-200">
                        <td className="p-3 text-slate-500" colSpan={3}>
                          ยังไม่มีกิจกรรม
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setOpenPortal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>
            </>
          )}
        </div>
      </ModalShell>

      {/* ============ Suspend Modal (ตามรูป 3) ============ */}
      <ModalShell
        open={openSuspend}
        onClose={() => setOpenSuspend(false)}
        widthClass="max-w-xl"
      >
        <div className="p-6">
          <div className="text-lg font-extrabold text-slate-900">
            {suspendTarget?.status === "SUSPENDED" ? "ปลดระงับบัญชีร้านค้า" : "ระงับบัญชีร้านค้า"}
          </div>
          <div className="text-sm text-slate-500">
            กรุณาระบุรายละเอียดและเหตุผลในการทำรายการ
          </div>

          <div className="mt-5 space-y-4">
            {suspendTarget?.status !== "SUSPENDED" && (
              <>
                <div>
                  <div className="text-sm font-bold text-slate-800">ระยะเวลาระงับ (วัน)</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[1, 3, 7, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSDaysPreset(d)}
                        className={[
                          "rounded-lg border px-3 py-1.5 text-sm font-bold",
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
                        "rounded-lg border px-3 py-1.5 text-sm font-bold",
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
                      <div className="text-sm font-bold text-slate-800">ระบุจำนวนวัน</div>
                      <input
                        value={sDaysCustom}
                        onChange={(e) => setSDaysCustom(e.target.value)}
                        placeholder="เช่น 14"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-sm font-bold text-slate-800">เหตุผล</div>
                  <textarea
                    rows={4}
                    value={sReason}
                    onChange={(e) => setSReason(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                  />
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  ระบบจะส่งอีเมลแจ้งเตือนไปยัง <b>{suspendTarget?.email || "-"}</b> พร้อมระบุเหตุผลและระยะเวลาระงับ
                </div>
              </>
            )}

            {suspendTarget?.status === "SUSPENDED" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                กด “ยืนยัน” เพื่อปลดระงับบัญชีร้านนี้ และกลับมาใช้งานได้ตามปกติ
              </div>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setOpenSuspend(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                ยกเลิก
              </button>

              <button
                disabled={sSubmitting}
                onClick={submitSuspend}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-extrabold text-white",
                  suspendTarget?.status === "SUSPENDED"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-500 hover:bg-amber-600",
                  sSubmitting ? "opacity-60" : "",
                ].join(" ")}
              >
                {sSubmitting ? "กำลังทำรายการ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* ============ Delete Modal (ตามรูป 4) ============ */}
      <ModalShell
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        widthClass="max-w-xl"
      >
        <div className="p-6">
          <div className="text-lg font-extrabold text-rose-600">ลบบัญชีร้านค้า</div>
          <div className="text-sm text-slate-500">
            การลบไม่สามารถกู้คืนได้ กรุณาระบุเหตุผลในการลบ
          </div>

          <div className="mt-5">
            <div className="text-sm font-bold text-slate-800">ชื่อบัญชี</div>
            <div className="mt-1 font-extrabold text-slate-900">
              {deleteTarget?.storeProfile?.storeName || "-"}
            </div>

            <div className="mt-4 text-sm font-bold text-slate-800">เหตุผลในการลบ</div>
            <textarea
              rows={5}
              value={dReason}
              onChange={(e) => setDReason(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-200"
            />

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
                onClick={() => setOpenDelete(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                ยกเลิก
              </button>

              <button
                disabled={dSubmitting}
                onClick={submitDelete}
                className={`rounded-xl bg-rose-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-rose-700 ${dSubmitting ? "opacity-60" : ""}`}
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
