// frontend-sma/src/pages/CustomerComplaints.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import ReCAPTCHA from "react-google-recaptcha";

const TEST_SITE_KEY = "6LfBBV8sAAAAAKDz6Ke5jy76-YfOQ7UbCfcqg2WC"; // Production Key

const CATEGORY_OPTIONS = [
  "การใช้งานระบบ",
  "ปัญหาใบรับประกัน",
  "บัญชีผู้ใช้/เข้าสู่ระบบ",
  "คำแนะนำ/เสนอแนะ",
  "อื่นๆ",
];

const STATUS_META = {
  OPEN: { label: "เปิดเรื่อง", cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-200" },
  IN_PROGRESS: { label: "กำลังดำเนินการ", cls: "bg-sky-100 text-sky-800 ring-1 ring-sky-200" },
  RESOLVED: { label: "แก้ไขแล้ว", cls: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200" },
  REJECTED: { label: "ปฏิเสธ", cls: "bg-rose-100 text-rose-800 ring-1 ring-rose-200" },
};

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

function StatusPill({ status }) {
  const meta =
    STATUS_META[status] || { label: status || "—", cls: "bg-slate-100 text-slate-700 ring-1 ring-slate-200" };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

export default function CustomerComplaints() {
  const { user } = useAuth();

  // form
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]); // ✅ เพิ่ม: แนบรูป

  // ✅ เพิ่ม: warranty dropdown สำหรับหมวด "ปัญหาใบรับประกัน"
  const [warranties, setWarranties] = useState([]);
  const [warrantiesLoading, setWarrantiesLoading] = useState(false);
  const [selectedWarrantyId, setSelectedWarrantyId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");

  // ✅ เพิ่ม: reCAPTCHA state
  const [captchaToken, setCaptchaToken] = useState(null);
  const captchaRef = useRef(null);

  // list / ui
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // ✅ auto refresh (polling)
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const inFlightRef = useRef(false);

  // ✅ เพิ่ม: fetch warranties เมื่อเลือก "ปัญหาใบรับประกัน"
  useEffect(() => {
    if (category === "ปัญหาใบรับประกัน") {
      setWarrantiesLoading(true);
      api.get("/customer/warranties")
        .then((res) => {
          const list = res.data?.data || [];
          setWarranties(list);
        })
        .catch((e) => {
          console.warn("fetch warranties failed", e);
          setWarranties([]);
        })
        .finally(() => setWarrantiesLoading(false));
    } else {
      // reset selections
      setSelectedWarrantyId("");
      setSelectedItemId("");
    }
  }, [category]);

  // ✅ เพิ่ม: หา items ของ warranty ที่เลือก
  const selectedWarranty = warranties.find((w) => w.id === selectedWarrantyId);
  const warrantyItems = selectedWarranty?.items || [];

  async function fetchComplaints({ silent = false } = {}) {
    if (inFlightRef.current) return; // กันยิงซ้ำถี่ๆ
    inFlightRef.current = true;

    if (!silent) setLoading(true);
    setErr("");

    try {
      const r = await api.get("/customer/complaints");
      setItems(r.data?.complaints || []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e) {
      // ถ้าเป็น silent refresh แล้วพัง จะไม่ทับ UI ด้วย loading หนัก
      setErr(e?.response?.data?.message || "โหลดรายการแจ้งปัญหาไม่สำเร็จ");
    } finally {
      if (!silent) setLoading(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ polling: ให้ลูกค้าเห็นสถานะเปลี่ยนเองเมื่อ admin เปลี่ยน
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalMs = 15000; // 15s
    const id = setInterval(() => {
      // ถ้าหน้าไม่ได้ active อยู่ (เช่นเปลี่ยนแท็บ) ก็ไม่ยิง
      if (typeof document !== "undefined" && document.hidden) return;
      // ระหว่างกำลังส่งฟอร์ม ไม่ต้องยิงถี่
      if (submitting) return;

      fetchComplaints({ silent: true });
    }, intervalMs);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, submitting]);

  const filtered = useMemo(() => {
    const query = (q || "").trim().toLowerCase();

    return (items || []).filter((it) => {
      const passStatus = statusFilter === "all" ? true : it.status === statusFilter;

      if (!query) return passStatus;

      const hay = `${it.category || ""} ${it.subject || ""} ${it.message || ""}`.toLowerCase();
      return passStatus && hay.includes(query);
    });
  }, [items, q, statusFilter]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    const s = subject.trim();
    const m = message.trim();

    if (!s || !m) {
      setErr("กรุณากรอกหัวข้อและรายละเอียด");
      return;
    }

    // ✅ Check CAPTCHA
    if (!captchaToken) {
      setErr("กรุณายืนยันตัวตน (I'm not a robot)");
      return;
    }

    setSubmitting(true);
    try {
      // ✅ ถ้าแนบรูป -> multipart / ถ้าไม่แนบ -> JSON (คงพฤติกรรมเดิม)
      if (attachments && attachments.length > 0) {
        const form = new FormData();
        form.append("category", (category || "").trim() || "");
        form.append("subject", s);
        form.append("message", m);
        // ✅ เพิ่ม warranty fields
        if (selectedWarrantyId) form.append("warrantyId", selectedWarrantyId);
        if (selectedItemId) form.append("warrantyItemId", selectedItemId);
        // ✅ เพิ่ม captcha token
        form.append("captchaToken", captchaToken);
        attachments.forEach((f) => form.append("images", f)); // field name = images

        await api.post("/customer/complaints", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/customer/complaints", {
          category: (category || "").trim() || null,
          subject: s,
          message: m,
          // ✅ เพิ่ม warranty fields
          warrantyId: selectedWarrantyId || null,
          warrantyItemId: selectedItemId || null,
          // ✅ เพิ่ม captcha token
          captchaToken,
        });
      }

      setOk("แจ้งปัญหาเรียบร้อย ✅");
      setSubject("");
      setMessage("");
      setAttachments([]); // ✅ รีเซ็ตไฟล์แนบ
      // ✅ รีเซ็ต warranty selections & captcha
      setSelectedWarrantyId("");
      setSelectedItemId("");
      setCaptchaToken(null);
      captchaRef.current?.reset();

      await fetchComplaints();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e2) {
      setErr(e2?.response?.data?.message || "แจ้งปัญหาไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-sky-100/60 pb-12">
      <main className="mx-auto max-w-6xl px-4 pt-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">แจ้งปัญหา / ติดต่อแอดมิน</div>
            <div className="text-sm text-slate-500">
              ส่งปัญหา/ข้อเสนอแนะให้ผู้ดูแลระบบ (ระบบบันทึกลงฐานข้อมูล)
            </div>
          </div>

          <div className="hidden text-right text-sm md:block">
            <div className="font-medium text-slate-900">
              สวัสดี, {user?.customerProfile?.firstName || ""} {user?.customerProfile?.lastName || ""}
            </div>
            <div className="text-xs text-slate-500">{user?.email || ""}</div>
          </div>
        </div>

        {/* Alerts */}
        {(err || ok) && (
          <div className="mb-4 space-y-2">
            {err && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {err}
              </div>
            )}
            {ok && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {ok}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
          <div className="h-2 w-full bg-sky-500" />
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900">แจ้งปัญหา</div>
                <div className="text-sm text-slate-500">กรอกให้ครบ แล้วกดส่ง</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">
                  <input
                    type="checkbox"
                    className="accent-sky-600"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  อัปเดตอัตโนมัติ
                </label>

                <button
                  type="button"
                  onClick={() => fetchComplaints()}
                  className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
                >
                  รีเฟรชรายการ
                </button>
              </div>
            </div>

            {lastUpdatedAt && (
              <div className="mb-4 text-xs text-slate-500">
                อัปเดตล่าสุดเมื่อ: {fmtDateTime(lastUpdatedAt)}
              </div>
            )}

            <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-1">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  หมวดหมู่ (ไม่บังคับ)
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-200"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ เพิ่ม: Dropdown เลือกใบรับประกัน (แสดงเมื่อเลือก "ปัญหาใบรับประกัน") */}
              {category === "ปัญหาใบรับประกัน" && (
                <>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      เลือกใบรับประกัน
                    </label>
                    {warrantiesLoading ? (
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-500">
                        กำลังโหลด...
                      </div>
                    ) : warranties.length === 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        ยังไม่มีใบรับประกัน
                      </div>
                    ) : (
                      <select
                        value={selectedWarrantyId}
                        onChange={(e) => {
                          setSelectedWarrantyId(e.target.value);
                          setSelectedItemId(""); // reset item selection
                        }}
                        className="w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        <option value="">-- เลือกใบรับประกัน --</option>
                        {warranties.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code || w.id} - {w.items?.[0]?.productName || "ไม่มีชื่อสินค้า"}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Dropdown เลือก Serial/Product */}
                  {selectedWarrantyId && warrantyItems.length > 0 && (
                    <div className="md:col-span-1">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        เลือกสินค้า (Serial)
                      </label>
                      <select
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        className="w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        <option value="">-- เลือกสินค้า --</option>
                        {warrantyItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.serial || "-"} - {it.productName || "ไม่มีชื่อ"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  หัวข้อ (subject) <span className="text-rose-500">*</span>
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="เช่น ดาวน์โหลด PDF ไม่ได้"
                  className="w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-200"
                />
                <div className="mt-1 text-xs text-slate-500">{subject.trim().length}/200</div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  รายละเอียด (message) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="อธิบายปัญหา/รายละเอียดเพิ่มเติม เช่น ขั้นตอนที่ทำ, วันเวลา, ข้อความ error ฯลฯ"
                  className="w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-200"
                />
                <div className="mt-1 text-xs text-slate-500">{message.trim().length}/5000</div>
              </div>

              {/* ✅ เพิ่ม: แนบรูปอ้างอิง */}
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  แนบรูปอ้างอิงปัญหา (ถ้ามี)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                  className="w-full rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-200"
                />
                {attachments?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {attachments.map((f, idx) => (
                      <span
                        key={`${f.name}-${idx}`}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                        title={f.name}
                      >
                        📎 {f.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-1 text-xs text-slate-500">
                  รองรับรูปภาพเท่านั้น (เลือกได้หลายรูป)
                </div>
              </div>

              {/* ✅ ReCAPTCHA Widget */}
              <div className="md:col-span-2 mt-2">
                <ReCAPTCHA
                  ref={captchaRef}
                  sitekey={TEST_SITE_KEY}
                  onChange={(token) => setCaptchaToken(token)}
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-500">
                  * คำร้องแจ้งปัญหาจะถูกส่งไปยังแอดมิน และสามารถติดตามสถานะได้ด้านล่าง
                </div>

                <button
                  disabled={submitting}
                  className="rounded-2xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60"
                >
                  {submitting ? "กำลังส่ง..." : "แจ้งปัญหา"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
          <div className="h-2 w-full bg-slate-900" />
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900">รายการแจ้งปัญหา</div>
                <div className="text-sm text-slate-500">แสดงคำร้องแจ้งปัญหาที่คุณส่งไว้ทั้งหมด</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900"
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="OPEN">เปิดเรื่อง</option>
                  <option value="IN_PROGRESS">กำลังดำเนินการ</option>
                  <option value="RESOLVED">แก้ไขแล้ว</option>
                  <option value="REJECTED">ปฏิเสธ</option>
                </select>

                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหา..."
                  className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-5 py-4 text-sm text-slate-600">
                กำลังโหลดข้อมูล...
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-5 py-6 text-center">
                <div className="text-sm font-semibold text-slate-900">ยังไม่มีการแจ้งปัญหา</div>
                <div className="mt-1 text-xs text-slate-500">
                  ถ้าคุณมีปัญหา/ข้อเสนอแนะ สามารถส่งได้จากฟอร์มด้านบน
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((it) => (
                  <div key={it.id} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-slate-900">{it.subject}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <div>หมวด: {it.category || "—"}</div>
                          <div>ส่งเมื่อ: {fmtDateTime(it.createdAt)}</div>
                          <div>อัปเดตล่าสุด: {fmtDateTime(it.updatedAt)}</div>
                        </div>
                      </div>
                      <StatusPill status={it.status} />
                    </div>

                    <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-700">
                      {it.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
