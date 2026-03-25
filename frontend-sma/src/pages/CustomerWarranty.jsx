// frontend-sma/src/pages/CustomerWarranty.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { stripEmojisAndSpecials } from "../lib/text";
import { useAuth } from "../store/auth";
import SatisfactionSurveyModal from "../components/SatisfactionSurveyModal";
import ImagePreview from "../components/ImagePreview";
import introJs from "intro.js";
import "intro.js/introjs.css";
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
  return `${day}/${m}/${y}`;
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
  const { user, setUser } = useAuth();
  const location = useLocation();
  const [focusWarrantyId, setFocusWarrantyId] = useState(
    () => (location.state?.focusWarrantyId ? String(location.state.focusWarrantyId) : null)
  );
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
  const [highlightWarrantyId, setHighlightWarrantyId] = useState(null);
  const [noteModal, setNoteModal] = useState({
    open: false,
    itemId: null,
    name: "",
    note: "",
  });
  const [showEmptyOnboarding, setShowEmptyOnboarding] = useState(false);
  // ✅ Modal สำหรับแสดงเงื่อนไขการรับประกัน
  const [conditionsModal, setConditionsModal] = useState({ open: false, conditions: [], custom: '' });
  // ✅ Popup แบบประเมินความพึงพอใจ (ลูกค้า เห็นเพียงครั้งเดียว)
  const [surveyOpen, setSurveyOpen] = useState(false);
  const surveyCheckedRef = useRef(false);
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  const tourStartedRef = useRef(false);
  const [imagePreview, setImagePreview] = useState({ open: false, images: [], index: 0 });

  // รองรับการนำทางมาหน้านี้หลายครั้ง (เช่น คลิก "ไปที่ใบรับประกัน" จากแจ้งเตือนซ้ำๆ)
  useEffect(() => {
    const idFromNav = location.state && location.state.focusWarrantyId;
    if (idFromNav) {
      setFocusWarrantyId(String(idFromNav));
    }
  }, [location]);

  async function markCustomerOnboardingSeen() {
    if (setUser) {
      setUser((prev) => (prev ? { ...prev, hasSeenOnboarding: true } : prev));
    }
    // ไม่เรียก backend เพื่อเลี่ยง 404 บนโฮสต์ที่ยังไม่มี endpoint นี้
  }

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

      try {
        const ls = typeof window !== "undefined" ? window.localStorage : null;
        const firstKey = "wp_seen_customer_empty_onboarding_v1";
        const hasSeenEmpty = ls ? ls.getItem(firstKey) : null;
        if ((rows || []).length === 0 && !hasSeenEmpty) {
          setShowEmptyOnboarding(true);
        } else {
          setShowEmptyOnboarding(false);
        }
      } catch {
        // ignore localStorage errors
      }

      // ถ้าไม่ได้โฟกัสจากแจ้งเตือน ให้รีเซ็ตหน้า/สถานะขยายตามเดิม
      if (!focusWarrantyId) {
        setPage(1);
        setExpandedByHeader((prev) => {
          const next = {};
          for (const w of rows) if (prev[w.id]) next[w.id] = true;
          return next;
        });
      }
    } catch (e) {
      console.error("fetch customer warranties failed", e);
      setTotals({
        all: 0,
        active: 0,
        nearing_expiration: 0,
        expired: 0,
      });
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [filter]);

  // ตรวจสอบเงื่อนไขแสดง popup แบบประเมินความพึงพอใจ (ฝั่งลูกค้า)
  useEffect(() => {
    if (!user) return;
    if (user.role !== "CUSTOMER") return;
    if (loading) return;
    if (surveyCheckedRef.current) return;

    surveyCheckedRef.current = true;

    api
      .get("/public/usage-survey")
      .then((res) => {
        if (res?.data?.shouldShow) {
          setSurveyOpen(true);
        }
      })
      .catch(() => {
        // เงียบ ๆ ถ้ามี error เพื่อไม่ให้กระทบการใช้งานหลัก
      });
  }, [user, loading]);

  // Intro.js customer onboarding tour (ผูกกับ user ทีละคน)
  useEffect(() => {
    if (!user) return;
    if (user.role !== "CUSTOMER") return;
    if (user.hasSeenOnboarding) return;
    if (loading) return;
    if (tourStartedRef.current) return;

    try {
      const ls = typeof window !== "undefined" ? window.localStorage : null;
      const key = `wp_seen_tour_customer_v1_${user.id}`;
      const seen = ls ? ls.getItem(key) : null;
      if (seen) return;

      if (typeof window === "undefined" || typeof document === "undefined") return;

      let attempts = 0;
      const maxAttempts = 20; // ~5 วินาที
      const intervalMs = 250;
      let timer = null;

      const tryStart = () => {
        attempts += 1;
        const statsEl = document.querySelector("#customer-step-stats");
        const listEl = document.querySelector("#customer-step-list");
        const detailsEl = document.querySelector("#customer-step-details");
        const pdfEl = document.querySelector("#customer-step-pdf");
        const complaintEl = document.querySelector("#customer-step-complaint");
        const bellEl = document.querySelector("#customer-step-bell");

        const steps = [];
        if (statsEl) {
          steps.push({
            element: "#customer-step-stats",
            intro:
              "ดูสรุปจำนวนใบรับประกันทั้งหมดของคุณได้ที่นี่ พร้อมสถานะว่าใบไหนยังใช้งานได้ หรือใกล้หมดอายุ",
            position: "bottom",
          });
        }
        if (listEl) {
          steps.push({
            element: "#customer-step-list",
            intro:
              "เลื่อนดูรายการใบรับประกันทั้งหมดได้จากส่วนนี้ สามารถค้นหาและกรองตามสถานะได้",
            position: "bottom",
          });
        }
        if (detailsEl) {
          steps.push({
            element: "#customer-step-details",
            intro:
              "กดปุ่ม 'รายละเอียดเพิ่มเติม' บนการ์ดใบรับประกัน เพื่อดูข้อมูลสินค้า วันหมดอายุ และเงื่อนไขการรับประกันอย่างละเอียด",
            position: "bottom",
            tooltipClass: "custom-tooltip-left",
          });
        }
        if (pdfEl) {
          steps.push({
            element: "#customer-step-pdf",
            intro:
              "หากต้องการเก็บเอกสารไว้เอง สามารถกดปุ่ม PDF บนการ์ดใบรับประกัน เพื่อดาวน์โหลดใบรับประกันเป็นไฟล์เก็บไว้ได้",
            position: "bottom",
            tooltipClass: "introjs-pdf-step custom-tooltip-left",
          });
        }
        if (complaintEl) {
          steps.push({
            element: "#customer-step-complaint",
            intro:
              "หากสินค้ามีปัญหา สามารถกดปุ่ม 'แจ้งปัญหา' เพื่อส่งเรื่องถึงทีมงาน/ร้านค้าได้ทันที",
            position: "bottom",
          });
        }
        if (bellEl) {
          steps.push({
            element: "#customer-step-bell",
            intro:
              "เมื่อมีการแก้ไขหรือยกเลิกใบรับประกัน ระบบจะแจ้งเตือนให้ทราบที่กระดิ่งตรงนี้ เสมอ",
            position: "bottom",
          });
        }

        const ready = steps.length > 0;
        const timedOut = attempts >= maxAttempts;

        if (!ready && !timedOut) return;

        if (timer) window.clearInterval(timer);
        if (!ready) return;

        tourStartedRef.current = true;
        if (ls) ls.setItem(key, "1");

        const intro = introJs();
        intro.setOptions({
          steps,
          showProgress: true,
          showBullets: false,
          exitOnOverlayClick: false,
          overlayOpacity: 0.5,
          nextLabel: "ถัดไป",
          prevLabel: "ย้อนกลับ",
          skipLabel: "ข้าม",
          doneLabel: "เสร็จสิ้น",
          showStepNumbers: false,
          scrollTo: "element",
          scrollToElement: true,
        });
        intro.oncomplete(() => {
          markCustomerOnboardingSeen();
        });
        intro.onexit(() => {
          markCustomerOnboardingSeen();
        });
        intro.start();
      };

      timer = window.setInterval(tryStart, intervalMs);
      return () => {
        if (timer) window.clearInterval(timer);
      };
    } catch (e) {
      // ignore
    }
  }, [loading, user?.id, user?.role, user?.hasSeenOnboarding]);

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

  // เมื่อมี focusWarrantyId (เช่น มาจากปุ่ม "ไปที่ใบรับประกัน") และมี data แล้ว
  // ให้หาว่าใบรับประกันนั้นอยู่ index ไหน -> ตั้งหน้า + ขยายการ์ด + เล่นเอฟเฟกต์ไฮไลต์
  useEffect(() => {
    if (!focusWarrantyId) return;
    if (!Array.isArray(data) || data.length === 0) return;

    const idx = data.findIndex((w) => String(w.id) === String(focusWarrantyId));
    if (idx === -1) {
      setFocusWarrantyId(null);
      return;
    }

    const targetPage = Math.floor(idx / PAGE_SIZE) + 1;
    setPage(targetPage);
    setExpandedByHeader((prev) => ({
      ...prev,
      [focusWarrantyId]: true,
    }));
    setHighlightWarrantyId(String(focusWarrantyId));

    // ใช้ครั้งเดียวต่อการนำทางหนึ่งครั้ง
    setFocusWarrantyId(null);
  }, [focusWarrantyId, data, PAGE_SIZE]);

  // เมื่อมี highlightWarrantyId และข้อมูลของหน้าปัจจุบันพร้อมแล้ว ให้เลื่อนและไฮไลต์การ์ดเป้าหมาย
  useEffect(() => {
    if (!highlightWarrantyId) return;

    // หน่วงเล็กน้อยให้ DOM วาดการ์ดหน้าใหม่เสร็จ
    const timer = window.setTimeout(() => {
      try {
        const el = document.querySelector(
          `[data-warranty-id="${highlightWarrantyId}"]`
        );
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.remove("warranty-focus-highlight");
          // trigger reflow เพื่อให้ animation เล่นซ้ำได้
          // eslint-disable-next-line no-unused-expressions
          void el.offsetHeight;
          el.classList.add("warranty-focus-highlight");
        }
      } catch {
        // ignore
      } finally {
        // ให้ effect นี้เล่นแค่ครั้งเดียวต่อการนำทาง
        setTimeout(() => setHighlightWarrantyId(null), 1700);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [highlightWarrantyId, currentPage, paginated.length]);

  async function onSaveNote() {
    if (!noteModal.itemId) {
      setNoteModal({ open: false, itemId: null, name: "", note: "" });
      return;
    }
    try {
      await api.patch(`/customer/warranty-items/${noteModal.itemId}/note`, {
        note: noteModal.note,
      });
      setNoteModal({ open: false, itemId: null, name: "", note: "" });
      fetchData();
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error?.message ||
        "ไม่สามารถบันทึกหมายเหตุได้";
      // ใช้ alert แบบง่าย เพื่อไม่ให้ error เงียบหาย และหลีกเลี่ยง unhandled rejection
      alert(msg);
    }
  }

  async function onDownloadPdf(warrantyId) {
    try {
      const resp = await api.get(`/customer/warranties/${warrantyId}/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      // Safari-friendly approach:
      // Try to open in new tab first
      const win = window.open(url, "_blank");
      if (!win) {
        // Pop-up blocked or failed, fallback to direct download or current window
        alert("Pop-up blocked. Downloading file instead.");
        const a = document.createElement("a");
        a.href = url;
        a.download = `warranty-${warrantyId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      // Cleanup
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
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
        <div
          id="customer-step-stats"
          className="grid grid-cols-2 gap-3 md:grid-cols-4"
        >
          <StatBox value={totals.all} label="ใบรับประกันทั้งหมด" colorClass="bg-slate-900" />
          <StatBox value={totals.active} label="ใช้งานได้" colorClass="bg-emerald-500" />
          <StatBox value={totals.nearing_expiration} label="ใกล้หมดอายุ" colorClass="bg-amber-400" />
          <StatBox value={totals.expired} label="หมดอายุ" colorClass="bg-rose-500" />
        </div>

        {/* Search + Filters / list controls */}
        <div
          id="customer-step-list"
          className="mt-6 flex flex-col items-stretch gap-3 md:flex-row md:items-center"
        >
          <div className="flex-1">
            <div className="flex items-center rounded-2xl bg-white px-4 py-2 shadow ring-1 ring-black/5">
              <img src="/home-assets/search.jpg" alt="ค้นหา" className="h-5 w-5 object-cover mr-1 opacity-70" />
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
                  className={`px-2 sm:px-4 h-8 sm:h-10 rounded-full text-xs sm:text-sm border font-medium shadow-sm hover:-translate-y-0.5 transition ${colors}`}
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

          {!loading && !hasData && showEmptyOnboarding && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-8 text-center text-slate-700">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                ยินดีต้อนรับสู่สมุดรับประกันออนไลน์ของคุณ
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
                ตอนนี้ยังไม่มีใบรับประกันผูกกับบัญชีนี้ ระบบจะแสดงใบรับประกันอัตโนมัติเมื่อร้านค้าบันทึกใบรับประกันด้วยอีเมลของคุณ
                คุณสามารถกลับมาดูที่หน้านี้ได้ทุกเมื่อ และใช้ทัวร์แนะนำด้านบนเพื่อเรียนรู้วิธีใช้งาน
              </p>
              <button
                type="button"
                onClick={() => {
                  try {
                    const ls = typeof window !== "undefined" ? window.localStorage : null;
                    if (ls) ls.setItem("wp_seen_customer_empty_onboarding_v1", "1");
                  } catch {
                    // ignore
                  }
                  setShowEmptyOnboarding(false);
                }}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow hover:bg-sky-500"
              >
                เข้าใจแล้ว ซ่อนข้อความนี้
              </button>
            </div>
          )}

          {!loading && !hasData && !showEmptyOnboarding && (
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
                <article
                  key={w.id}
                  data-warranty-id={w.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-md transition hover:shadow-lg"
                >
                  <div className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 min-w-0">
                        {/* หัวการ์ด: รหัสใบรับประกัน เป็น Title หลัก */}
                        <div className="text-lg font-semibold text-slate-900 truncate">
                          รหัสใบรับประกัน #{w.code}
                        </div>

                        {/* เนื้อหาหลัก: ชื่อร้านค้า + เบอร์โทรศัพท์ */}
                        <div className="mt-3 text-sm text-slate-700 space-y-1">
                          <div className="truncate">
                            ร้านค้า: {" "}
                            <span className="font-medium text-slate-900">{storeName}</span>
                          </div>
                          <div className="truncate">
                            เบอร์โทรศัพท์: {" "}
                            <span className="font-medium text-slate-900">{phone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 items-stretch md:items-end">
                        <button
                          id="customer-step-pdf"
                          onClick={() => onDownloadPdf(w.id)}
                          className="h-9 w-full rounded-full border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-white hover:-translate-y-0.5 hover:bg-sky-50 transition md:h-10 md:w-auto md:min-w-[96px] md:px-4 md:py-2 md:text-sm"
                        >
                          PDF
                        </button>
                        <button
                          id="customer-step-details"
                          type="button"
                          onClick={() =>
                            setExpandedByHeader((prev) => ({
                              ...prev,
                              [w.id]: !prev[w.id],
                            }))
                          }
                          className="w-full rounded-full border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-white hover:-translate-y-0.5 hover:bg-sky-50 transition md:w-auto md:px-4 md:py-2"
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
                                      ({Math.max(0, daysLeft)} วัน)
                                    </span>
                                  )}

                                </div>

                                <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                                  <div>
                                    Serial No.:{" "}
                                    <span className="font-medium text-slate-900">
                                      {!it.serial || it.serial.trim() === '' || it.serial === 'SN001' ? '-' : it.serial}
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
                                    {/* ✅ ปุ่มดูเงื่อนไขการรับประกัน */}
                                    {(Array.isArray(it.selectedConditions) && it.selectedConditions.length > 0) || it.customCondition ? (
                                      <button
                                        type="button"
                                        onClick={() => setConditionsModal({
                                          open: true,
                                          conditions: it.selectedConditions || [],
                                          custom: it.customCondition || ''
                                        })}
                                        className="rounded-xl border border-sky-400 bg-sky-500 px-3 py-1.5 text-xs text-white font-medium shadow-sm hover:bg-sky-600 transition inline-flex items-center gap-1"
                                      >
                                        <img src="/home-assets/condition.png" alt="เงื่อนไขการรับประกัน" className="inline h-5 w-5 object-cover align-text-bottom" />
                                        <span>ดูเงื่อนไข ({(it.selectedConditions?.length || 0) + (it.customCondition ? 1 : 0)})</span>
                                      </button>
                                    ) : (
                                      <span className="font-medium text-slate-400">- ไม่มีเงื่อนไข -</span>
                                    )}
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

                                {it.images && it.images.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    <div className="text-sm font-medium text-slate-700">รูปภาพประกอบ</div>
                                    <div className="flex gap-2 overflow-x-auto">
                                      {it.images.map((image, index) => (
                                        <button
                                          key={image.id || index}
                                          type="button"
                                          className="group relative flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                                          onClick={() => setImagePreview({ open: true, images: it.images, index })}
                                        >
                                          <img
                                            src={absolutize(image.url || image.path || image)}
                                            alt={image.originalName || "Warranty image"}
                                            className="h-20 w-20 object-cover transition-transform group-hover:scale-105"
                                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                                          />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                                            <span className="text-xs text-white">👁️</span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="grid place-items-center">
                                <div className="relative h-32 w-40 overflow-hidden rounded-2xl border border-slate-300 bg-slate-50">
                                  {it.images && it.images.length > 0 && img ? (
                                    <button
                                      type="button"
                                      className="group relative h-full w-full cursor-pointer"
                                      onClick={() => setImagePreview({ open: true, images: it.images, index: 0 })}
                                    >
                                      <img
                                        src={img}
                                        alt="Warranty preview"
                                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                      />
                                      {it.images.length > 1 && (
                                        <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
                                          +{it.images.length - 1}
                                        </div>
                                      )}
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                        <span className="text-xs text-white">👁️ ดูรูป</span>
                                      </div>
                                    </button>
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
                className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${currentPage === 1
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
                  className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${n === currentPage
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
                className={`rounded-full px-3 py-2 text-xs font-medium shadow-sm ${currentPage === totalPages
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

      {imagePreview.open && (
        <ImagePreview
          images={imagePreview.images}
          initialIndex={imagePreview.index}
          onClose={() => setImagePreview({ open: false, images: [], index: 0 })}
        />
      )}

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
                  setNoteModal({ ...noteModal, note: stripEmojisAndSpecials(e.target.value) })}
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

      {/* ✅ Modal แสดงเงื่อนไขการรับประกัน */}
      {conditionsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-sky-600 px-5 py-4">
              <div className="text-base font-semibold text-white"><img src="/home-assets/condition.png" alt="เงื่อนไขการรับประกัน" className="inline h-5 w-5 object-cover align-text-bottom mr-1" />เงื่อนไขการรับประกัน</div>
              <button
                type="button"
                onClick={() => setConditionsModal({ open: false, conditions: [], custom: '' })}
                className="text-2xl text-white/80 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              {conditionsModal.conditions.length > 0 ? (
                <ul className="space-y-2">
                  {conditionsModal.conditions.map((cond, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-sky-600">•</span>
                      <span>{cond}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">ไม่มีเงื่อนไขที่เลือก</p>
              )}

              {conditionsModal.custom && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="text-xs font-medium text-gray-500 mb-2">เงื่อนไขเพิ่มเติม:</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{conditionsModal.custom}</p>
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
              <button
                type="button"
                onClick={() => setConditionsModal({ open: false, conditions: [], custom: '' })}
                className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-500 transition"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup แบบประเมินความพึงพอใจของลูกค้า */}
      <SatisfactionSurveyModal
        open={surveyOpen}
        onClose={() => setSurveyOpen(false)}
        context="customer"
      />
    </div>
  );
}