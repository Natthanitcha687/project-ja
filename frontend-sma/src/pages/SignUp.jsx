// src/pages/SignUp.jsx
// เวอร์ชันเต็ม: ฟอร์มสมัครสมาชิก ลูกค้า/ร้านค้า + ตรวจสอบรหัสผ่าน + ส่ง API
// ✅ เพิ่มปุ่ม "สมัครด้วย Google" (พาไปหน้าแยก /signup/google/customer|store)

import { useEffect, useRef, useState, forwardRef, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { stripEmojisAndSpecials } from "../lib/text";

/* ---------------------------------------------
 * ICONS (เส้นบาง โทนเทา)
 * -------------------------------------------*/
const Icon = {
  user: (cls = "w-5 h-5") => (
    <svg viewBox="0 0 24 24" className={`${cls} text-gray-400`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0116 0" />
    </svg>
  ),
  mail: (cls = "w-5 h-5") => (
    <svg viewBox="0 0 24 24" className={`${cls} text-gray-400`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 6h16v12H4z" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  ),
  phone: (cls = "w-5 h-5") => (
    <svg viewBox="0 0 24 24" className={`${cls} text-gray-400`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012 4.18 2 2 0 014 2h3a2 2 0 012 1.72c.12.9.3 1.78.57 2.63a2 2 0 01-.45 2.11L8.1 9.9a16 16 0 006 6l1.44-1.02a2 2 0 012.11-.45 19 19 0 002.63.57A2 2 0 0122 16.92z" />
    </svg>
  ),
  lock: (cls = "w-5 h-5") => (
    <svg viewBox="0 0 24 24" className={`${cls} text-gray-400`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  ),
  home: (cls = "w-5 h-5") => (
    <svg viewBox="0 0 24 24" className={`${cls} text-gray-400`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 10l9-7 9 7" />
      <path d="M9 22V12h6v10" />
    </svg>
  ),
  clock: (cls = "w-5 h-5") => (
    <svg viewBox="0 0 24 24" className={`${cls} text-gray-400`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  ),
  eye: (cls = "w-5 h-5") => (
    <svg viewBox="0 0 24 24" className={`${cls} text-gray-500`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (cls = "w-5 h-5") => (
    <svg viewBox="0 0 24 24" className={`${cls} text-gray-500`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a21.77 21.77 0 015.06-6.06m4.31-2.2A10.94 10.94 0 0112 5c7 0 11 7 11 7a21.62 21.62 0 01-3.34 4.26M1 1l22 22" />
      <path d="M9.88 9.88A3 3 0 0012 15a3 3 0 002.12-.88" />
    </svg>
  ),
};

// รายชื่อจังหวัด 77 จังหวัด (ชื่อภาษาไทย)
const TH_PROVINCES = [
  'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
  'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม',
  'นครราชสีมา', 'นครศรีธรรมราช', 'นนทบุรี', 'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี',
  'ปัตตานี', 'พระนครศรีอยุธยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่', 'ภูเก็ต',
  'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยะลา', 'ยโสธร', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี',
  'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร',
  'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง',
  'อุดรธานี', 'อุทัยธานี', 'อุบลราชธานี', 'อำนาจเจริญ', 'อุตรดิตถ์'
];

/* ---------------------------------------------
 * INPUT (with left/right icon slots)
 * -------------------------------------------*/
const InputIcon = forwardRef(function InputIcon(
  // รับ type เข้ามา แต่เราจะใช้ type="password" ตรงๆ ใน JSX
  { left, right, onRightClick, className = "", invalid = false, ...props },
  ref
) {
  // กำหนด padding ด้านขวา (pr-10) เมื่อมีไอคอน right ถูกส่งเข้ามาเท่านั้น
  // เนื่องจาก right จะเป็น {null} ในช่องรหัสผ่าน จึงไม่มี pr-10
  const rightPadding = right ? "pr-10 " : "";

  return (
    <div className="relative">
      {/* ไอคอนซ้าย */}
      {left && <span className="absolute left-3 top-1/2 -translate-y-1/2">{left}</span>}

      {/* ช่องกรอก */}
      <input
        ref={ref}
        {...props}
        className={
          "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 transition " +
          (left ? "pl-10 " : "") +
          rightPadding +
          (invalid ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-blue-500") +
          " " +
          className
        }
      />

      {/* ปุ่มไอคอนขวา */}
      {right && (
        <button
          type="button"
          onClick={onRightClick}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 active:scale-95 transition"
          tabIndex={-1}
        >
          {right}
        </button>
      )}
    </div>
  );
});

const TextareaIcon = forwardRef(function TextareaIcon(
  { left, className = "", invalid = false, ...props },
  ref
) {
  return (
    <div className="relative">
      {left ? <span className="absolute left-3 top-3">{left}</span> : null}
      <textarea
        ref={ref}
        {...props}
        className={
          "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 " +
          (left ? "pl-10 " : "") +
          (invalid ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-blue-500") +
          " " +
          className
        }
      />
    </div>
  );
});

/* =========================
 * Google Identity Services helpers
 * ========================= */
function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("No window"));
    if (window.google?.accounts?.id) return resolve(true);

    const existing = document.querySelector('script[data-gsi="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => reject(new Error("Load Google script failed")));
      return;
    }

    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-gsi", "1");
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error("Load Google script failed"));
    document.head.appendChild(s);
  });
}


/* ---------------------------------------------
 * Tabs (ลูกค้า/ร้านค้า)
 * -------------------------------------------*/
function Tabs({ value, onChange }) {
  const Btn = ({ val, label, icon }) => {
    const selected = value === val;
    return (
      <button
        type="button"
        onClick={() => onChange(val)}
        className={
          "h-9 px-4 rounded-xl inline-flex items-center gap-2 text-sm font-medium transition " +
          (selected ? "bg-white border border-gray-300 shadow text-gray-900" : "text-gray-800")
        }
        aria-pressed={selected}
      >
        <span className="text-gray-800">{icon}</span>
        {label}
      </button>
    );
  };

  return (
    <div className="inline-flex items-center bg-gray-200 rounded-2xl border border-gray-300 p-1 shadow-inner">
      <Btn
        val="customer"
        label="ลูกค้า"
        icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" /></svg>}
      />
      <Btn
        val="store"
        label="ร้านค้า"
        icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10l9-7 9 7" /><path d="M9 22V12h6v10" /></svg>}
      />
    </div>
  );
}

/* ---------------------------------------------
 * MAIN: SignUp
 * -------------------------------------------*/
export default function Signup() {
  const [params] = useSearchParams();
  const initial = params.get("role") === "store" ? "store" : "customer";
  const [tab, setTab] = useState(initial);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);


  // ===== Google (ปุ่มจริงในหน้า /signup) =====
  const googleBtnRef = useRef(null);
  const googleWrapRef = useRef(null);

  const [googleReady, setGoogleReady] = useState(false);
  const [googleErr, setGoogleErr] = useState("");
  const [googleMsg, setGoogleMsg] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const googleBusyRef = useRef(false);
  useEffect(() => {
    googleBusyRef.current = googleBusy;
  }, [googleBusy]);

  const googleClientId = useMemo(
    () => (import.meta?.env?.VITE_GOOGLE_CLIENT_ID ? String(import.meta.env.VITE_GOOGLE_CLIENT_ID).trim() : ""),
    []
  );

  async function startWithGoogleCredential(credential) {
    try {
      setGoogleBusy(true);
      setGoogleMsg("");
      setGoogleErr("");

      const isStore = tabRef.current === "store";
      const role = isStore ? "STORE" : "CUSTOMER";
      const targetPath = isStore ? "/signup/google/store" : "/signup/google/customer";

      const { data } = await api.post("/auth/google/start", {
        credential,
        role,
        mode: "signup",
      });

      // กันกรณีมีบัญชีอยู่แล้ว -> ให้ไปหน้าเข้าสู่ระบบ
      if (data?.token || data?.existing) {
        setGoogleMsg("มีบัญชีอยู่แล้ว กรุณาไปหน้าเข้าสู่ระบบ");
        return;
      }

      // ✅ ส่ง state ไปหน้า /signup/google/... เพื่อข้าม STEP 1 (ไม่ต้องกด Google ซ้ำ)
      if (data?.needsProfile && data?.signupToken) {
        navigate(targetPath, {
          state: {
            signupToken: String(data.signupToken),
            email: String(data.email || ""),
            givenName: String(data.givenName || ""),
            familyName: String(data.familyName || ""),
          },
        });
        return;
      }

      setGoogleMsg(data?.message || "สมัครด้วย Google ไม่สำเร็จ");
    } catch (err) {
      const body = err?.response?.data || {};
      setGoogleMsg(body?.message || err?.message || "สมัครด้วย Google ไม่สำเร็จ");
    } finally {
      setGoogleBusy(false);
    }
  }

  // init google button (renderButton ด้วย width จริง แบบ responsive)
  useEffect(() => {
    let cancelled = false;
    let ro = null;
    let raf = 0;

    const MIN_W = 280;
    const MAX_W = 420;
    const RERENDER_THRESHOLD = 24;
    let lastW = 0;

    function getWidth() {
      const wrap = googleWrapRef.current;
      const w = wrap?.clientWidth || MAX_W;
      return Math.max(MIN_W, Math.min(MAX_W, Math.floor(w)));
    }

    function renderAtWidth(w) {
      const g = window.google?.accounts?.id;
      if (!g) return;
      if (!googleBtnRef.current) return;

      if (lastW && Math.abs(w - lastW) < RERENDER_THRESHOLD) return;
      lastW = w;

      googleBtnRef.current.innerHTML = "";
      g.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "medium",
        shape: "pill",
        width: w,
        text: "signup_with",
        locale: "th",
      });
    }

    function scheduleResize() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (cancelled) return;
        renderAtWidth(getWidth());
      });
    }

    async function init() {
      try {
        setGoogleErr("");
        setGoogleReady(false);

        if (!googleClientId) {
          setGoogleErr("ยังไม่ได้ตั้งค่า VITE_GOOGLE_CLIENT_ID");
          return;
        }

        await loadGsiScript();
        if (cancelled) return;

        const g = window.google?.accounts?.id;
        if (!g) {
          setGoogleErr("โหลด Google Identity ไม่สำเร็จ");
          return;
        }

        if (googleBtnRef.current) googleBtnRef.current.innerHTML = "";

        g.initialize({
          client_id: googleClientId,
          callback: (resp) => {
            const cred = resp?.credential;
            if (!cred) {
              setGoogleMsg("ไม่พบ credential จาก Google");
              return;
            }
            if (googleBusyRef.current) return;
            startWithGoogleCredential(cred);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        scheduleResize();
        setGoogleReady(true);

        if (googleWrapRef.current && "ResizeObserver" in window) {
          ro = new ResizeObserver(() => scheduleResize());
          ro.observe(googleWrapRef.current);
        } else {
          window.addEventListener("resize", scheduleResize);
        }
      } catch {
        if (!cancelled) setGoogleErr("ไม่สามารถโหลดปุ่ม Google ได้");
      }
    }

    init();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", scheduleResize);
    };
  }, [googleClientId]);

  // password states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  // other states
  const [consent, setConsent] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwStrength, setPwStrength] = useState(0);
  const [pwChecks, setPwChecks] = useState({
    length: false,
    lower: false,
    upper: false,
    digit: false,
    symbol: false,
  });
  const [showWeakPwModal, setShowWeakPwModal] = useState(false);
  const [emailErrorMsg, setEmailErrorMsg] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const confirmRef = useRef(null);
  // terms modal visibility
  const [showTerms, setShowTerms] = useState(false);
  const [storeTypeValue, setStoreTypeValue] = useState("");
  const [customTypeStore, setCustomTypeStore] = useState("");

  // Helper: compose time availability string for form submission
  const defaultSchedule = {
    mon: { on: true, start: '09:00', end: '18:00' },
    tue: { on: true, start: '09:00', end: '18:00' },
    wed: { on: true, start: '09:00', end: '18:00' },
    thu: { on: true, start: '09:00', end: '18:00' },
    fri: { on: true, start: '09:00', end: '18:00' },
    sat: { on: false, start: '09:00', end: '12:00' },
    sun: { on: false, start: '09:00', end: '12:00' }
  };

  const [schedule, setSchedule] = useState(defaultSchedule);

  // structured address state for store signup
  const [addressStreet, setAddressStreet] = useState("");
  // store selected IDs for selects
  const [addressSubdistrict, setAddressSubdistrict] = useState(""); // subdistrict id
  const [addressDistrict, setAddressDistrict] = useState(""); // district id
  const [addressProvince, setAddressProvince] = useState(""); // province id
  const [addressPostcode, setAddressPostcode] = useState("");

  function updateAddress(patch = {}) {
    if (patch.street !== undefined) setAddressStreet(patch.street);
    if (patch.subdistrict !== undefined) setAddressSubdistrict(patch.subdistrict);
    if (patch.district !== undefined) setAddressDistrict(patch.district);
    if (patch.province !== undefined) setAddressProvince(patch.province);
    if (patch.postcode !== undefined) setAddressPostcode(patch.postcode);
  }

  // ✅ เพิ่ม: path ไปหน้าสมัครด้วย Google (แยกลูกค้า/ร้านค้า)
  const googleSignupPath = tab === "store" ? "/signup/google/store" : "/signup/google/customer";

  // reset เมื่อสลับ tab
  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setPwError("");
    setConsent(false);
    setShowPwd(false);
    setShowPwd2(false);
    setGoogleMsg("");
    setGoogleErr("");
    setSchedule(defaultSchedule);
    // reset address fields when switching between customer/store
    setAddressStreet("");
    setAddressSubdistrict("");
    setAddressDistrict("");
    setAddressProvince("");
    setAddressPostcode("");
  }, [tab]);

  // Dynamic Thai administrative areas (provinces/districts/subdistricts)
  // Prefer local static JSON shipped in public/data; fallback to GitHub raw URLs
  const PROVINCES_JSON_LOCAL = '/data/api_province.json';
  const DISTRICTS_JSON_LOCAL = '/data/api_district.json';
  const SUBDISTRICTS_JSON_LOCAL = '/data/api_subdistrict.json';
  const PROVINCES_JSON_FALLBACK = 'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/province.json';
  const DISTRICTS_JSON_FALLBACK = 'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/district.json';
  const SUBDISTRICTS_JSON_FALLBACK = 'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/sub_district.json';

  const [provincesList, setProvincesList] = useState([]); // { name, code }
  const [districtOptions, setDistrictOptions] = useState([]); // { name, code }
  const [subdistrictOptions, setSubdistrictOptions] = useState([]); // { name, code, zipcode }
  const [districtsCache, setDistrictsCache] = useState(null);
  const [subdistrictsCache, setSubdistrictsCache] = useState(null);
  const [districtsMap, setDistrictsMap] = useState(null);
  const [subdistrictsMap, setSubdistrictsMap] = useState(null);

  // load provinces, districts, subdistricts on mount and build lookup maps
  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      try {
        const fetchOrFallback = async (localUrl, fallbackUrl) => {
          let r = await fetch(localUrl);
          if (!r.ok) r = await fetch(fallbackUrl);
          return await r.json();
        };

        const [provData, districtData, subData] = await Promise.all([
          fetchOrFallback(PROVINCES_JSON_LOCAL, PROVINCES_JSON_FALLBACK),
          fetchOrFallback(DISTRICTS_JSON_LOCAL, DISTRICTS_JSON_FALLBACK),
          fetchOrFallback(SUBDISTRICTS_JSON_LOCAL, SUBDISTRICTS_JSON_FALLBACK),
        ]);

        if (!mounted) return;
        setProvincesList(provData.map((p) => ({ name: p.name_th || p.name, code: p.id ?? p.code })).sort((a, b) => a.name.localeCompare(b.name, 'th')));
        setDistrictsCache(districtData);
        setSubdistrictsCache(subData);

        const dmap = {};
        for (const d of districtData || []) {
          const pid = String(d.province_id ?? d.province_code ?? d.provinceId ?? d.province);
          if (!dmap[pid]) dmap[pid] = [];
          dmap[pid].push(d);
        }
        setDistrictsMap(dmap);

        const smap = {};
        for (const s of subData || []) {
          const did = String(s.district_id ?? s.district_code ?? s.amphure_id ?? s.district);
          if (!smap[did]) smap[did] = [];
          smap[did].push(s);
        }
        setSubdistrictsMap(smap);
      } catch (err) {
        // fallback to static provinces if anything fails
        console.error('loadAll location data failed', err);
        setProvincesList(TH_PROVINCES.map((p, i) => ({ name: p, code: String(i) })));
        setDistrictsCache(null);
        setSubdistrictsCache(null);
        setDistrictsMap(null);
        setSubdistrictsMap(null);
      }
    }
    loadAll();
    return () => { mounted = false; };
  }, []);

  async function loadDistrictsForProvince(provinceNameOrCode) {
    try {
      if (!provinceNameOrCode) {
        setDistrictOptions([]);
        return;
      }
      // find province code if provinceNameOrCode is a name
      let provinceCode = provinceNameOrCode;
      if (isNaN(Number(provinceNameOrCode))) {
        const p = provincesList.find((x) => x.name === provinceNameOrCode);
        provinceCode = p?.code;
      }

      const pid = String(provinceCode);
      // prefer pre-built map
      if (districtsMap) {
        const list = districtsMap[pid] || [];
        try { console.debug('loadDistrictsForProvince (from map)', { provinceCode: pid, matched: list.length }); } catch (e) { }
        setDistrictOptions(list.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })).sort((a, b) => a.name.localeCompare(b.name, 'th')));
        return;
      }

      // fallback: load districts JSON once
      let districtsData = districtsCache;
      if (!districtsData) {
        let res = await fetch(DISTRICTS_JSON_LOCAL);
        if (!res.ok) res = await fetch(DISTRICTS_JSON_FALLBACK);
        districtsData = await res.json();
        setDistrictsCache(districtsData);
      }
      const filtered = districtsData.filter((d) => String(d.province_id ?? d.province_code) === pid);
      try { console.debug('loadDistrictsForProvince (fallback)', { provinceCode: pid, districtsTotal: districtsData.length, matched: filtered.length }); } catch (e) { }
      setDistrictOptions(filtered.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })).sort((a, b) => a.name.localeCompare(b.name, 'th')));
    } catch (err) {
      console.error('loadDistrictsForProvince error', err);
      setDistrictOptions([]);
    }
  }

  async function loadSubdistrictsForDistrict(districtCode) {
    try {
      if (!districtCode) {
        setSubdistrictOptions([]);
        return;
      }
      const did = String(districtCode);
      if (subdistrictsMap) {
        const list = subdistrictsMap[did] || [];
        try { console.debug('loadSubdistrictsForDistrict (from map)', { districtCode: did, matched: list.length }); } catch (e) { }
        setSubdistrictOptions(list.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })).sort((a, b) => a.name.localeCompare(b.name, 'th')));
        return;
      }

      let subs = subdistrictsCache;
      if (!subs) {
        let res = await fetch(SUBDISTRICTS_JSON_LOCAL);
        if (!res.ok) res = await fetch(SUBDISTRICTS_JSON_FALLBACK);
        subs = await res.json();
        setSubdistrictsCache(subs);
      }
      const filtered = subs.filter((s) => String(s.district_id ?? s.district_code) === did);
      try { console.debug('loadSubdistrictsForDistrict (fallback)', { districtCode: did, total: subs.length, matched: filtered.length }); } catch (e) { }
      setSubdistrictOptions(filtered.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })).sort((a, b) => a.name.localeCompare(b.name, 'th')));
    } catch (err) {
      console.error('loadSubdistrictsForDistrict error', err);
      setSubdistrictOptions([]);
    }
  }

  function getPasswordChecks(pw) {
    if (!pw) {
      return { length: false, lower: false, upper: false, digit: false, symbol: false };
    }
    return {
      length: pw.length >= 8,
      lower: /[a-z]/.test(pw),
      upper: /[A-Z]/.test(pw),
      digit: /[0-9]/.test(pw),
      symbol: /[^A-Za-z0-9]/.test(pw),
    };
  }

  function calcPasswordStrength(pw) {
    if (!pw) return 0;
    const checks = getPasswordChecks(pw);
    const count = [
      checks.length,
      checks.lower,
      checks.upper,
      checks.digit,
      checks.symbol,
    ].filter(Boolean).length;

    if (count <= 2) return 1; // อ่อน
    if (count <= 4) return 2; // ปานกลาง
    return 3; // แข็งแรง
  }

  // validate password/confirm
  useEffect(() => {
    let msg = "";
    if (password && password.length < 8) msg = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    // validate confirmation for both customer and store (both use confirm now)
    else if (confirmPassword && password !== confirmPassword) msg = "รหัสผ่านไม่ตรงกัน";
    setPwError(msg);
    if (confirmRef.current) confirmRef.current.setCustomValidity(msg);
    const checks = getPasswordChecks(password);
    setPwChecks(checks);
    setPwStrength(calcPasswordStrength(password));
  }, [password, confirmPassword]);

  // separate submit checks: customer uses a single password; store requires confirm
  const canSubmitCustomer =
    !submitting &&
    consent &&
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    password === confirmPassword;
  const canSubmitStore =
    !submitting &&
    consent &&
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    password === confirmPassword;

  /* ----------------------
   * SUBMIT: CUSTOMER
   * --------------------*/
  async function onSubmitCustomer(e) {
    e.preventDefault();
    if (!canSubmitCustomer) {
      e.currentTarget.reportValidity();
      if (confirmRef.current) confirmRef.current.focus();
      return;
    }
    if (pwStrength < 3) {
      setShowWeakPwModal(true);
      return;
    }
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      password,
      confirmPassword,
      isConsent: !!fd.get("consent"),
    };
    try {
      await api.post("/auth/register/customer", payload);
      navigate("/signin");
    } catch (err) {
      const msg = err?.response?.data?.message || "สมัครสมาชิกไม่สำเร็จ";
      setEmailErrorMsg(msg);
      setShowEmailModal(true);
    } finally {
      setSubmitting(false);
    }
  }

  /* ----------------------
   * SUBMIT: STORE
   * --------------------*/
  async function onSubmitStore(e) {
    e.preventDefault();
    if (!canSubmitStore) {
      e.currentTarget.reportValidity();
      if (confirmRef.current) confirmRef.current.focus();
      return;
    }
    if (pwStrength < 3) {
      setShowWeakPwModal(true);
      return;
    }
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const rawType = fd.get("typeStore") || storeTypeValue;
    const finalTypeStore = rawType === "other"
      ? `other:${String(customTypeStore || "").trim()}`
      : rawType;

    const payload = {
      storeName: fd.get("storeName"),
      typeStore: finalTypeStore,
      ownerStore: fd.get("ownerStore"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      address: fd.get("address"),
      timeAvailable: fd.get("timeAvailable"),
      password,
      confirmPassword,
      isConsent: !!fd.get("consent"),
    };
    try {
      await api.post("/auth/register/store", payload);
      navigate("/signin");
    } catch (err) {
      const msg = err?.response?.data?.message || "สมัครสมาชิกไม่สำเร็จ";
      setEmailErrorMsg(msg);
      setShowEmailModal(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#eaf3ff] flex items-center justify-center px-4 py-10">
      {/* Weak password modal */}
      {showWeakPwModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl px-6 py-6 text-center relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 via-pink-100 to-violet-100 shadow-md">
              <span className="text-2xl">🔒</span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">รหัสผ่านยังไม่ปลอดภัยเพียงพอ</h2>
            <p className="mt-2 text-sm text-gray-600">
              กรุณาปรับรหัสผ่านให้ผ่านทุกเงื่อนไขจนถึงระดับ
              <span className="font-semibold text-emerald-600"> "ความปลอดภัยสูง" </span>
              ก่อนทำการสมัครสมาชิก
            </p>
            <p className="mt-3 text-xs text-gray-500">
              ลองเพิ่มความยาวของรหัสผ่าน ผสมตัวอักษรตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ ตัวเลข และสัญลักษณ์ให้มากขึ้น
            </p>
            <button
              type="button"
              onClick={() => setShowWeakPwModal(false)}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}

      {/* Email error modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl px-6 py-6 text-center relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100 shadow-md">
              <span className="text-2xl">📧</span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">ไม่สามารถใช้ที่อยู่อีเมลนี้ได้</h2>
            <p className="mt-2 text-sm text-gray-600">
              {emailErrorMsg || "อีเมลนี้ไม่สามารถใช้สมัครได้ กรุณาลองใช้อีเมลอื่นที่ยังไม่ถูกใช้งานในระบบ"}
            </p>
            <p className="mt-3 text-xs text-gray-500">
              กรุณาตรวจสอบว่าพิมพ์อีเมลถูกต้อง หรือเลือกใช้อีเมลอื่นสำหรับการสมัครสมาชิก
            </p>
            <button
              type="button"
              onClick={() => setShowEmailModal(false)}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}

      {/* Terms modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">เงื่อนไขการให้บริการ</h3>
                <p className="text-sm text-gray-500 mt-1">โปรดอ่านเอกสารเงื่อนไขด้านล่างก่อนยอมรับ</p>
              </div>
              <div>
                <button onClick={() => setShowTerms(false)} className="rounded-full p-1 hover:bg-gray-100">ปิด</button>
              </div>
            </div>

            <hr className="my-4" />

            <div className="prose max-w-none text-sm text-gray-700">
              {tab === 'store' ? (
                <div>
                  <p>ร้านค้าที่สมัครและใช้งานแพลตฟอร์ม ถือว่าตกลงยอมรับเงื่อนไขดังต่อไปนี้</p>

                  <p className="mt-4"><strong className="font-semibold">1.</strong> การลงทะเบียนและข้อมูลร้านค้า</p>
                  <p><strong>1.1</strong> ร้านค้าต้องลงทะเบียนด้วยข้อมูลที่ถูกต้อง ครบถ้วน และเป็นปัจจุบัน</p>
                  <p><strong>1.2</strong> ร้านค้าต้องรับผิดชอบต่อความถูกต้องของข้อมูลร้านค้าและข้อมูลสินค้า</p>
                  <p><strong>1.3</strong> ห้ามใช้ข้อมูลเท็จ หรือแอบอ้างร้านค้าหรือบุคคลอื่น</p>

                  <p className="mt-6"><strong className="font-semibold">2.</strong> การจัดการใบรับประกันสินค้า</p>
                  <p><strong>2.1</strong> ร้านค้าต้องบันทึกข้อมูลใบรับประกันสินค้าให้ตรงกับสินค้าที่จำหน่ายจริง</p>
                  <p><strong>2.2</strong> ร้านค้าต้องระบุเงื่อนไข ระยะเวลา และขอบเขตการรับประกันอย่างชัดเจน</p>
                  <p><strong>2.3</strong> ห้ามแก้ไข ลบ หรือเปลี่ยนแปลงข้อมูลใบรับประกันย้อนหลังโดยไม่ได้รับความยินยอมจากลูกค้า</p>
                  <p><strong>2.4</strong> ร้านค้าเป็นผู้รับผิดชอบต่อเนื้อหาและเงื่อนไขการรับประกันทั้งหมด</p>

                  <p className="mt-6"><strong className="font-semibold">3.</strong> หน้าที่และความรับผิดของร้านค้า</p>
                  <p><strong>3.1</strong> ร้านค้าต้องปฏิบัติตามพระราชบัญญัติคุ้มครองผู้บริโภค พ.ศ. 2522 และประมวลกฎหมายแพ่งและพาณิชย์ที่เกี่ยวข้องกับการขายและการรับประกัน</p>
                  <p><strong>3.2</strong> ร้านค้าต้องให้บริการตามเงื่อนไขการรับประกันที่แจ้งไว้</p>
                  <p><strong>3.3</strong> ร้านค้าต้องไม่ใช้แพลตฟอร์มเพื่อการหลอกลวงหรือทุจริต</p>

                  <p className="mt-6"><strong className="font-semibold">4.</strong> ข้อจำกัดสิทธิ์และการใช้งานที่ต้องห้าม</p>
                  <p><strong>4.1</strong> ห้ามใช้แพลตฟอร์มเพื่อกระทำการที่ผิดกฎหมาย</p>
                  <p><strong>4.2</strong> ห้ามเข้าถึงข้อมูลลูกค้าที่ไม่เกี่ยวข้องกับธุรกรรมของตน</p>
                  <p><strong>4.3</strong> ห้ามพยายามเจาะระบบ ดัดแปลง หรือรบกวนการทำงานของแพลตฟอร์ม</p>

                  <p className="mt-6"><strong className="font-semibold">5.</strong> บทลงโทษสำหรับร้านค้า</p>
                  <p>หากร้านค้าฝ่าฝืนเงื่อนไข ผู้ให้บริการมีสิทธิ์ดำเนินการดังต่อไปนี้ โดยไม่ต้องแจ้งให้ทราบล่วงหน้า:</p>
                  <ul>
                    <li>ระงับการใช้งานบัญชีชั่วคราว</li>
                    <li>ยกเลิกบัญชีร้านค้า</li>
                    <li>ลบข้อมูลที่เกี่ยวข้อง</li>
                  </ul>

                  <p className="mt-6"><strong className="font-semibold">6.</strong> วัตถุประสงค์ในการเข้าถึงข้อมูล</p>
                  <p>ผู้ดูแลระบบของแพลตฟอร์มมีสิทธิ์เข้าถึงข้อมูลใบรับประกันสินค้าและประวัติกิจกรรม (Activity Logs) เฉพาะเพื่อวัตถุประสงค์ต่อไปนี้: การสนับสนุนทางเทคนิคแก่ร้านค้าและลูกค้า, การตรวจสอบความถูกต้องของธุรกรรมตามคำร้องขอหรือเพื่อสืบสวนเหตุการณ์ร้องเรียน และการเก็บเป็นหลักฐานในกรณีข้อพิพาทหรือปัญหาการใช้งาน โดยการเข้าถึงจะทำเมื่อต้องการเท่านั้นและอยู่ภายใต้การควบคุมของผู้ให้บริการ</p>

                  <p className="mt-6"><strong className="font-semibold">7.</strong> ข้อจำกัดสิทธิ์และการรักษาความถูกต้องของข้อมูล</p>
                  <p>เพื่อรักษาความโปร่งใสและความถูกต้องของข้อมูล ระบบอนุญาตให้ผู้ดูแลระบบมีสิทธิ์เพียง "เรียกดูข้อมูล (Read-only)" และ "ตรวจสอบประวัติกิจกรรม (Activity Logs)" เท่านั้น ผู้ดูแลระบบจะไม่มีสิทธิ์แก้ไข เปลี่ยนแปลง หรือลบข้อมูลใบรับประกันที่ออกโดยร้านค้าโดยเด็ดขาด เพื่อคงสภาพข้อมูลตามความเป็นจริง (Data Integrity) และลดความเสี่ยงจากการดัดแปลงข้อมูล</p>
                </div>
              ) : (
                <div>
                  <p className="mt-4"><strong className="font-semibold">1.</strong> การลงทะเบียนและบัญชีผู้ใช้</p>
                  <p><strong>1.1</strong> ลูกค้าต้องให้ข้อมูลส่วนบุคคลที่ถูกต้องและเป็นปัจจุบัน</p>
                  <p><strong>1.2</strong> ลูกค้าต้องรักษาความลับของชื่อผู้ใช้และรหัสผ่าน</p>
                  <p><strong>1.3</strong> ห้ามให้บุคคลอื่นใช้บัญชีของตน</p>

                  <p className="mt-6"><strong className="font-semibold">2.</strong> การใช้งานใบรับประกันสินค้า</p>
                  <p><strong>2.1</strong> ลูกค้าสามารถใช้แพลตฟอร์มเพื่อตรวจสอบ:</p>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    <li>รายละเอียดใบรับประกันสินค้า</li>
                    <li>ระยะเวลาการรับประกัน</li>
                    <li>สถานะการรับประกัน</li>
                  </ul>
                  <p className="mt-2"><strong>2.2</strong> ใบรับประกันที่แสดงในระบบเป็นข้อมูลอ้างอิง โดยเงื่อนไขการรับประกันเป็นไปตามที่ร้านค้าหรือผู้ผลิตกำหนด</p>
                  <p><strong>2.3</strong> ลูกค้าต้องใช้ข้อมูลในระบบเพื่อประโยชน์ของตนเองเท่านั้น</p>

                  <p className="mt-6"><strong className="font-semibold">3.</strong> หน้าที่ของลูกค้า</p>
                  <p><strong>3.1</strong> ลูกค้าต้องไม่ปลอมแปลง แก้ไข หรือใช้ข้อมูลใบรับประกันของผู้อื่น</p>
                  <p><strong>3.2</strong> ลูกค้าต้องแจ้งผู้ให้บริการเมื่อพบการใช้งานบัญชีที่ผิดปกติ</p>
                  <p><strong>3.3</strong> ลูกค้าต้องปฏิบัติตามกฎหมายที่เกี่ยวข้อง</p>

                  <p className="mt-6"><strong className="font-semibold">4.</strong> ข้อจำกัดการใช้งาน</p>
                  <p><strong>4.1</strong> ห้ามใช้แพลตฟอร์มเพื่อการกระทำที่ผิดกฎหมาย</p>
                  <p><strong>4.2</strong> ห้ามพยายามเข้าถึงข้อมูลของร้านค้าหรือผู้ใช้รายอื่น</p>
                  <p><strong>4.3</strong> ห้ามรบกวนหรือทำให้ระบบเกิดความเสียหาย</p>

                  <p className="mt-6"><strong className="font-semibold">5.</strong> สิทธิ์ของลูกค้า</p>
                  <p><strong>5.1</strong> ลูกค้ามีสิทธิ์เข้าถึงข้อมูลใบรับประกันของตนเอง</p>
                  <p><strong>5.2</strong> ลูกค้าสามารถดาวน์โหลดหรือใช้ข้อมูลใบรับประกันเป็นหลักฐานได้</p>
                  <p><strong>5.3</strong> ลูกค้าสามารถยกเลิกการใช้งานบัญชีได้ตามขั้นตอนที่ระบบกำหนด</p>

                  <p className="mt-6"><strong className="font-semibold">6.</strong> บทลงโทษสำหรับลูกค้า</p>
                  <p>หากลูกค้าฝ่าฝืนเงื่อนไข ผู้ให้บริการมีสิทธิ์ดำเนินการดังต่อไปนี้ โดยไม่ต้องแจ้งให้ทราบล่วงหน้า:</p>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    <li>ระงับการใช้งานบัญชี</li>
                    <li>ยกเลิกบัญชีผู้ใช้</li>
                  </ul>

                  <p className="mt-6"><strong className="font-semibold">7.</strong> วัตถุประสงค์ในการเข้าถึงข้อมูล</p>
                  <p>ผู้ดูแลระบบของแพลตฟอร์มอาจเข้าถึงข้อมูลใบรับประกันสินค้าและประวัติกิจกรรม (Activity Logs) ของระบบเพื่อจุดประสงค์ในการให้การสนับสนุนแก่ลูกค้า การตรวจสอบความถูกต้องของธุรกรรมตามคำร้องขอ หรือเพื่อใช้เป็นหลักฐานในกรณีเกิดข้อพิพาทหรือปัญหาในการใช้งาน การเข้าถึงข้อมูลจะทำโดยจำกัดขอบเขตตามความจำเป็นและอยู่ภายใต้การควบคุมของผู้ให้บริการ</p>

                  <p className="mt-6"><strong className="font-semibold">8.</strong> ข้อจำกัดสิทธิ์และการรักษาความถูกต้องของข้อมูล</p>
                  <p>เพื่อให้ข้อมูลคงความถูกต้องและเชื่อถือได้ ผู้ดูแลระบบมีสิทธิ์เฉพาะในการ "เรียกดูข้อมูล (Read-only)" และ "ตรวจสอบประวัติกิจกรรม (Activity Logs)" เท่านั้น ผู้ดูแลระบบจะไม่ได้รับอนุญาตให้แก้ไข เปลี่ยนแปลง หรือลบข้อมูลใบรับประกันของลูกค้าหรือร้านค้า การเปลี่ยนแปลงข้อมูลใดๆ จะต้องมาจากเจ้าของข้อมูลหรือผ่านกระบวนการที่ระบบกำหนด</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setConsent(true);
                  setShowTerms(false);
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                ยอมรับ
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-xl">
        <div className="bg-white rounded-2xl shadow-2xl border border-black/5 p-8">
          {/* Header */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-300 shadow flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-blue-600" fill="currentColor" aria-hidden="true">
                <path d="M12 2l7 3v7c0 5-3.6 8.4-7 9-3.4-.6-7-4-7-9V5l7-3z" />
                <path fill="#fff" d="M10.3 12.7l-.99-.99-1.41 1.41 1.7 1.7a1 1 0 001.41 0l4.1-4.1-1.41-1.41-3.4 3.39z" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-gray-900">สมัครสมาชิก</h1>
            <p className="text-gray-600 text-sm">เลือกประเภทบัญชีที่ต้องการสมัคร</p>
            <div className="mt-4">
              <Tabs value={tab} onChange={setTab} />
            </div>

            {/* ✅ Google สมัครครั้งเดียว (ไม่เด้งไปกดซ้ำ) */}
            <div className="mt-5 w-full">
              {googleMsg ? (
                <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {googleMsg}
                </div>
              ) : null}

              {googleErr ? (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {googleErr}
                </div>
              ) : null}

              {googleErr ? (
                <button
                  type="button"
                  onClick={() => navigate(googleSignupPath)}
                  className="w-full h-11 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 font-semibold shadow-sm transition flex items-center justify-center gap-2"
                >
                  สมัครด้วย Google (สำรอง)
                  <span className="text-xs text-gray-500 font-medium ml-1">
                    ({tab === "store" ? "ร้านค้า" : "ลูกค้า"})
                  </span>
                </button>
              ) : (
                <div className="w-full flex justify-center">
                  <div ref={googleWrapRef} className="w-full max-w-[420px] flex justify-center overflow-visible">
                    <div
                      ref={googleBtnRef}
                      className="w-full flex justify-center min-h-[56px] overflow-visible origin-center scale-[1.08]"
                      aria-label={`สมัครด้วย Google (${tab === "store" ? "ร้านค้า" : "ลูกค้า"})`}
                    />
                  </div>
                </div>
              )}

              {!googleReady && !googleErr ? (
                <div className="mt-2 text-center text-xs text-gray-400">กำลังโหลดปุ่ม Google...</div>
              ) : null}

              {googleBusy ? (
                <div className="mt-2 text-center text-xs text-gray-500">กำลังดำเนินการ...</div>
              ) : null}

              <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
                <div className="h-px bg-gray-200 flex-1" />
                <span>หรือสมัครด้วยอีเมล</span>
                <div className="h-px bg-gray-200 flex-1" />
              </div>
            </div>

          </div>

          {/* ===================== CUSTOMER FORM ===================== */}
          {tab === "customer" ? (
            <form onSubmit={onSubmitCustomer} className="mt-2 space-y-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700">ชื่อ</span>
                  <InputIcon name="firstName" placeholder="ชื่อผู้ใช้" required left={Icon.user()} onInput={(e) => { e.target.value = e.target.value.replace(/[^a-zA-Z0-9ก-๙\s.\-]/g, '') }} />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700">นามสกุล</span>
                  <InputIcon name="lastName" placeholder="นามสกุล" required left={Icon.user()} onInput={(e) => { e.target.value = e.target.value.replace(/[^a-zA-Z0-9ก-๙\s.\-]/g, '') }} />
                </label>
              </div>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">อีเมล</span>
                <InputIcon
                  name="email"
                  type="email"
                  placeholder="กรอกอีเมลของคุณ"
                  required
                  left={Icon.mail()}
                  onChange={(e) => {
                    e.target.value = e.target.value.replace(/[\u0E00-\u0E7F]/g, "");
                  }}
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</span>
                <InputIcon
                  name="phone"
                  placeholder="กรอกเบอร์โทรศัพท์"
                  required
                  left={Icon.phone()}
                  maxLength={10}
                  onInput={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, '') }}
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">รหัสผ่าน</span>
                <InputIcon
                  name="password"
                  type="password"
                  minLength={8}
                  placeholder="กรอกรหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
                  value={password}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[\u0E00-\u0E7F]/g, "");
                    setPassword(val);
                  }}
                  required
                  left={Icon.lock()}
                  right={null}
                  invalid={!!pwError && password.length < 8}
                />
                {password ? (
                  <div
                    className={
                      "mt-2 rounded-lg border px-3 py-2 " +
                      (pwStrength <= 1
                        ? "border-red-100 bg-red-50/70"
                        : pwStrength === 2
                        ? "border-amber-100 bg-amber-50/70"
                        : "border-emerald-100 bg-emerald-50/70")
                    }
                  >
                    <div className="flex items-center justify-between text-[11px] font-medium">
                      <span className="text-gray-600 flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                        ความปลอดภัยของรหัสผ่าน
                      </span>
                      <span
                        className={
                          pwStrength <= 1
                            ? "text-red-600"
                            : pwStrength === 2
                            ? "text-yellow-600"
                            : "text-emerald-600"
                        }
                      >
                        {pwStrength <= 1
                          ? "ความปลอดภัยต่ำ"
                          : pwStrength === 2
                          ? "ความปลอดภัยปานกลาง"
                          : "ความปลอดภัยสูง"}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={
                          "h-full transition-all duration-200 " +
                          (pwStrength <= 1
                            ? "bg-red-500"
                            : pwStrength === 2
                            ? "bg-yellow-500"
                            : "bg-emerald-500")
                        }
                        style={{ width: `${pwStrength <= 1 ? 33 : pwStrength === 2 ? 66 : 100}%` }}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                      <p className={pwChecks.length ? "text-emerald-700" : "text-gray-500"}>
                        <span className="mr-1">{pwChecks.length ? "✓" : "•"}</span>
                        ยาวอย่างน้อย 8 ตัวอักษรขึ้นไป
                      </p>
                      <p className={pwChecks.lower ? "text-emerald-700" : "text-gray-500"}>
                        <span className="mr-1">{pwChecks.lower ? "✓" : "•"}</span>
                        มีตัวอักษรตัวพิมพ์เล็ก (a-z)
                      </p>
                      <p className={pwChecks.upper ? "text-emerald-700" : "text-gray-500"}>
                        <span className="mr-1">{pwChecks.upper ? "✓" : "•"}</span>
                        มีตัวอักษรตัวพิมพ์ใหญ่ (A-Z)
                      </p>
                      <p className={pwChecks.digit ? "text-emerald-700" : "text-gray-500"}>
                        <span className="mr-1">{pwChecks.digit ? "✓" : "•"}</span>
                        มีตัวเลข (0-9)
                      </p>
                      <p className={pwChecks.symbol ? "text-emerald-700" : "text-gray-500"}>
                        <span className="mr-1">{pwChecks.symbol ? "✓" : "•"}</span>
                        มีอักขระพิเศษ เช่น ! @ # $ %
                      </p>
                      <p className="text-[10px] text-gray-400 sm:col-span-2 mt-1">
                        กรุณาตั้งรหัสผ่านด้วยตัวอักษรภาษาอังกฤษ (a-z, A-Z) ตัวเลข และสัญลักษณ์ โดยไม่ใช้ตัวอักษรไทย
                      </p>
                    </div>
                  </div>
                ) : null}
              </label>

              {/* customer signup: password + confirm (match store's behavior) */}
              <label className="block">
                <span className="block text-sm font-medium text-gray-700">ยืนยันรหัสผ่าน</span>
                <InputIcon
                  ref={confirmRef}
                  name="confirmPassword"
                  type="password"
                  minLength={8}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  value={confirmPassword}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[\u0E00-\u0E7F]/g, "");
                    setConfirmPassword(val);
                  }}
                  required
                  left={Icon.lock()}
                  right={null}
                  invalid={!!pwError && password !== confirmPassword}
                />
                {pwError ? <p className="mt-1 text-sm text-red-600">{pwError}</p> : null}
              </label>

              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="consent"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                  required
                />
                <div className="text-sm text-gray-700 leading-tight">
                  ฉันยอมรับ
                  <button
                    type="button"
                    onClick={() => setShowTerms(true)}
                    className="ml-2 text-blue-600 underline decoration-1 decoration-blue-400 hover:text-blue-700"
                  >
                    เงื่อนไขการใช้งาน
                  </button>
                  <span className="ml-2">ในการเข้าใช้งาน</span>
                </div>
              </label>

              <button
                type="submit"
                disabled={!canSubmitCustomer}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 font-medium shadow"
              >
                {submitting ? "กำลังสมัคร..." : "สมัครสมาชิก"}
              </button>

              <p className="text-center text-sm text-gray-600">
                มีบัญชีอยู่แล้ว?{" "}
                <Link to="/signin" className="text-blue-600 hover:underline">
                  เข้าสู่ระบบ
                </Link>
              </p>
            </form>
          ) : (
            /* ===================== STORE FORM ===================== */
            <form onSubmit={onSubmitStore} className="mt-2 space-y-4" noValidate>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700">ชื่อร้านค้า</span>
                <InputIcon name="storeName" placeholder="ชื่อร้านค้า" required left={Icon.home()} onInput={(e) => { e.target.value = e.target.value.replace(/[^a-zA-Z0-9ก-๙\s.\-]/g, '') }} />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">ประเภทร้านค้า</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">{Icon.home()}</span>
                  <select
                    name="typeStore"
                    className="mt-1 w-full h-10 rounded-xl border border-gray-300 bg-white pl-10 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={storeTypeValue}
                    onChange={(e) => {
                      setStoreTypeValue(e.target.value);
                      if (e.target.value !== "other") setCustomTypeStore("");
                    }}
                    required
                  >
                    <option value="" disabled>เลือกประเภทร้านค้า</option>
                    <option value="electronics">อิเล็กทรอนิกส์</option>
                    <option value="appliance">เครื่องใช้ไฟฟ้า</option>
                    <option value="furniture">เฟอร์นิเจอร์</option>
                    <option value="automotive">ยานยนต์</option>
                    <option value="machine">เครื่องจักร / เครื่องมือช่าง</option>
                    <option value="other">อื่น ๆ</option>
                  </select>
                </div>
                {storeTypeValue === "other" && (
                  <InputIcon
                    value={customTypeStore}
                    onChange={(e) => setCustomTypeStore(e.target.value.replace(/[^a-zA-Z0-9ก-๙\s.\-\/]/g, ''))}
                    placeholder="ระบุประเภทร้านค้า"
                    required
                    left={Icon.home()}
                    className="mt-2"
                  />
                )}
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">ชื่อเจ้าของร้าน</span>
                <InputIcon
                  name="ownerStore"
                  placeholder="ชื่อเจ้าของร้าน"
                  required
                  left={Icon.user()}
                  onChange={(e) => {
                    e.target.value = stripEmojisAndSpecials(e.target.value)
                  }}
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">อีเมล</span>
                <InputIcon
                  name="email"
                  type="email"
                  placeholder="กรอกอีเมลของคุณ"
                  required
                  left={Icon.mail()}
                  onChange={(e) => {
                    e.target.value = stripEmojisAndSpecials(e.target.value).replace(/[\u0E00-\u0E7F]/g, "");
                  }}
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</span>
                <InputIcon
                  name="phone"
                  placeholder="กรอกเบอร์โทรศัพท์"
                  required
                  left={Icon.phone()}
                  maxLength={10}
                  onInput={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, '') }}
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">ที่อยู่ร้าน</span>

                {/* Structured address fields for better UX - combined into hidden 'address' for submission */}
                <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">เลขที่ / ซอย / ถนน</label>
                    <textarea
                      name="addr_street"
                      value={addressStreet}
                      onChange={(e) => updateAddress({ street: stripEmojisAndSpecials(e.target.value) })}
                      placeholder="เช่น 123/4 ซ.สุขุมวิท 11"
                      rows={2}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">จังหวัด</label>
                      <div className="relative">
                        <select
                          name="addr_province"
                          value={addressProvince}
                          onChange={async (e) => {
                            const code = e.target.value;
                            // store province id
                            updateAddress({ province: code, district: '', subdistrict: '', postcode: '' });
                            await loadDistrictsForProvince(code);
                            setSubdistrictOptions([]);
                            setAddressDistrict('');
                            setAddressSubdistrict('');
                          }}
                          className="appearance-none mt-1 w-full h-9 rounded-xl border border-gray-300 bg-white pl-3 pr-8 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
                          required
                        >
                          <option value="" disabled>เลือกจังหวัด</option>
                          {provincesList.length > 0
                            ? provincesList.map((p) => (
                              <option key={p.code} value={p.code}>{p.name}</option>
                            ))
                            : TH_PROVINCES.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">▾</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">อำเภอ/เขต</label>
                      <div className="relative">
                        <select
                          name="addr_district"
                          value={addressDistrict}
                          onChange={async (e) => {
                            const code = e.target.value;
                            // store district id
                            const found = districtOptions.find((d) => String(d.code) === String(code));
                            updateAddress({ district: code, subdistrict: '', postcode: '' });
                            if (found) {
                              await loadSubdistrictsForDistrict(found.code);
                            } else {
                              setSubdistrictOptions([]);
                            }
                          }}
                          className="appearance-none mt-1 w-full h-9 rounded-xl border border-gray-300 bg-white pl-3 pr-8 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="" disabled>{districtOptions.length ? 'เลือกอำเภอ/เขต' : 'เลือกอำเภอ/เขต'}</option>
                          {districtOptions.map((d) => (
                            <option key={d.code || d.name} value={d.code}>{d.name}</option>
                          ))}
                        </select>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">▾</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">ตำบล/แขวง</label>
                      <div className="relative">
                        <select
                          name="addr_subdistrict"
                          value={addressSubdistrict}
                          onChange={(e) => {
                            const code = e.target.value;
                            const found = subdistrictOptions.find((s) => String(s.code) === String(code));
                            updateAddress({ subdistrict: code });
                            if (found && found.zipcode) updateAddress({ postcode: found.zipcode });
                          }}
                          className="appearance-none mt-1 w-full h-9 rounded-xl border border-gray-300 bg-white pl-3 pr-8 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="" disabled>{subdistrictOptions.length ? 'เลือกตำบล/แขวง' : 'เลือกตำบล/แขวง'}</option>
                          {subdistrictOptions.map((s) => (
                            <option key={s.code || s.name} value={s.code}>{s.name}</option>
                          ))}
                        </select>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">▾</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">รหัสไปรษณีย์</label>
                      <input
                        name="addr_postcode"
                        value={addressPostcode}
                        onChange={(e) => updateAddress({ postcode: e.target.value.replace(/[^0-9]/g, '') })}
                        maxLength={5}
                        placeholder="เช่น 10110"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="w-full h-9 rounded-xl border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div className="col-span-2 text-xs text-gray-400 flex items-center">ตัวอย่าง: เลขที่/ซอย/ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์</div>
                  </div>

                  {/* combined hidden address JSON so existing submission code still works */}
                  <input
                    type="hidden"
                    name="address"
                    value={JSON.stringify({
                      street: addressStreet,
                      province: {
                        id: addressProvince,
                        name: provincesList.find((p) => String(p.code) === String(addressProvince))?.name || "",
                      },
                      district: {
                        id: addressDistrict,
                        name: districtOptions.find((d) => String(d.code) === String(addressDistrict))?.name || "",
                      },
                      subdistrict: {
                        id: addressSubdistrict,
                        name: subdistrictOptions.find((s) => String(s.code) === String(addressSubdistrict))?.name || "",
                        zipcode: addressPostcode || (subdistrictOptions.find((s) => String(s.code) === String(addressSubdistrict))?.zipcode || ""),
                      },
                      postcode: addressPostcode,
                    })}
                  />
                </div>
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">เวลาทำการ</span>
                <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                    <div className="text-xs text-gray-500">
                      กำหนดเวลาเปิด-ปิดในแต่ละวัน หรือใช้ทางลัดเพื่อตั้งเวลาเดียวกันทุกวัน
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // ใช้เวลาเดียวกับวันแรกที่เปิด
                        const entries = Object.entries(schedule)
                        const firstOn = entries.find(([, v]) => v && v.on && v.start && v.end)
                        if (!firstOn) return
                        const [, firstVal] = firstOn
                        setSchedule((prev) => {
                          const next = { ...prev }
                          for (const k of Object.keys(next)) {
                            if (next[k].on) {
                              next[k] = {
                                ...next[k],
                                start: firstVal.start,
                                end: firstVal.end,
                              }
                            }
                          }
                          return next
                        })
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 hover:border-sky-300 whitespace-nowrap"
                    >
                      ใช้เวลาเดียวกันทุกวันที่เลือก
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[
                      ['mon', 'จ.'],
                      ['tue', 'อ.'],
                      ['wed', 'พ.'],
                      ['thu', 'พฤ.'],
                      ['fri', 'ศ.'],
                      ['sat', 'ส.'],
                      ['sun', 'อา.']
                    ].map(([key, label]) => (
                      <div key={key} className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 py-2 rounded-md hover:bg-slate-50">
                        <div className="flex items-center gap-3 md:w-36 w-full">
                          <input
                            type="checkbox"
                            checked={!!schedule[key].on}
                            onChange={() =>
                              setSchedule((s) => {
                                const cur = s[key]
                                const nextOn = !cur.on
                                const next = { ...s }
                                next[key] = {
                                  ...cur,
                                  on: nextOn,
                                  // ถ้าเพิ่งเปิดให้ตั้งค่าเริ่มต้นเป็น 09:00-18:00 ถ้ายังไม่มีค่า
                                  start: nextOn ? (cur.start || '09:00') : cur.start,
                                  end: nextOn ? (cur.end || '18:00') : cur.end,
                                }
                                return next
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-700">{label}</span>
                            <span className="text-xs text-gray-400">{schedule[key].on ? 'เปิด' : 'ปิด'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                          <input
                            type="time"
                            value={schedule[key].start}
                            onChange={(e) => setSchedule(s => ({ ...s, [key]: { ...s[key], start: e.target.value } }))}
                            className="h-9 w-24 md:w-32 rounded border border-gray-300 bg-white px-2 text-sm"
                            disabled={!schedule[key].on}
                          />
                          <span className="text-xs text-gray-400">—</span>
                          <input
                            type="time"
                            value={schedule[key].end}
                            onChange={(e) => setSchedule(s => ({ ...s, [key]: { ...s[key], end: e.target.value } }))}
                            className="h-9 w-24 md:w-32 rounded border border-gray-300 bg-white px-2 text-sm"
                            disabled={!schedule[key].on}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* hidden input so FormData picks up current schedule */}
                  <input type="hidden" name="timeAvailable" value={JSON.stringify(schedule)} />
                </div>
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">รหัสผ่าน</span>
                <InputIcon
                  name="password"
                  type="password" // กำหนดเป็น password เสมอ
                  minLength={8}
                  placeholder="กรอกรหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
                  value={password}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[\u0E00-\u0E7F]/g, "");
                    setPassword(val);
                  }}
                  required
                  left={Icon.lock()}
                  right={null} // ตัดไอคอนตาออก
                  invalid={!!pwError && password.length < 8}
                />
                {password ? (
                  <div
                    className={
                      "mt-2 rounded-lg border px-3 py-2 " +
                      (pwStrength <= 1
                        ? "border-red-100 bg-red-50/70"
                        : pwStrength === 2
                        ? "border-amber-100 bg-amber-50/70"
                        : "border-emerald-100 bg-emerald-50/70")
                    }
                  >
                    <div className="flex items-center justify-between text-[11px] font-medium">
                      <span className="text-gray-600 flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                        ความปลอดภัยของรหัสผ่าน
                      </span>
                      <span
                        className={
                          pwStrength <= 1
                            ? "text-red-600"
                            : pwStrength === 2
                            ? "text-yellow-600"
                            : "text-emerald-600"
                        }
                      >
                        {pwStrength <= 1
                          ? "ความปลอดภัยต่ำ"
                          : pwStrength === 2
                          ? "ความปลอดภัยปานกลาง"
                          : "ความปลอดภัยสูง"}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={
                          "h-full transition-all duration-200 " +
                          (pwStrength <= 1
                            ? "bg-red-500"
                            : pwStrength === 2
                            ? "bg-yellow-500"
                            : "bg-emerald-500")
                        }
                        style={{ width: `${pwStrength <= 1 ? 33 : pwStrength === 2 ? 66 : 100}%` }}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                      <p className={pwChecks.length ? "text-emerald-700" : "text-gray-500"}>
                        <span className="mr-1">{pwChecks.length ? "✓" : "•"}</span>
                        ยาวอย่างน้อย 8 ตัวอักษรขึ้นไป
                      </p>
                      <p className={pwChecks.lower ? "text-emerald-700" : "text-gray-500"}>
                        <span className="mr-1">{pwChecks.lower ? "✓" : "•"}</span>
                        มีตัวอักษรตัวพิมพ์เล็ก (a-z)
                      </p>
                      <p className={pwChecks.upper ? "text-emerald-700" : "text-gray-500"}>
                        <span className="mr-1">{pwChecks.upper ? "✓" : "•"}</span>
                        มีตัวอักษรตัวพิมพ์ใหญ่ (A-Z)
                      </p>
                      <p className={pwChecks.digit ? "text-emerald-700" : "text-gray-500"}>
                        <span className="mr-1">{pwChecks.digit ? "✓" : "•"}</span>
                        มีตัวเลข (0-9)
                      </p>
                      <p className={pwChecks.symbol ? "text-emerald-700" : "text-gray-500"}>
                        <span className="mr-1">{pwChecks.symbol ? "✓" : "•"}</span>
                        มีอักขระพิเศษ เช่น ! @ # $ %
                      </p>
                      <p className="text-[10px] text-gray-400 sm:col-span-2 mt-1">
                        กรุณาตั้งรหัสผ่านด้วยตัวอักษรภาษาอังกฤษ (a-z, A-Z) ตัวเลข และสัญลักษณ์ โดยไม่ใช้ตัวอักษรไทย
                      </p>
                    </div>
                  </div>
                ) : null}
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">ยืนยันรหัสผ่าน</span>
                <InputIcon
                  ref={confirmRef}
                  name="confirmPassword"
                  type="password" // กำหนดเป็น password เสมอ
                  minLength={8}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  value={confirmPassword}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[\u0E00-\u0E7F]/g, "");
                    setConfirmPassword(val);
                  }}
                  required
                  left={Icon.lock()}
                  right={null} // ตัดไอคอนตาออก
                  invalid={!!pwError && password !== confirmPassword}
                />
                {pwError ? <p id="pw-help-store" className="mt-1 text-sm text-red-600">{pwError}</p> : null}
              </label>

              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="consent"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                  required
                />
                <div className="text-sm text-gray-700 leading-tight">
                  ฉันยอมรับ
                  <button
                    type="button"
                    onClick={() => setShowTerms(true)}
                    className="ml-2 text-blue-600 underline decoration-1 decoration-blue-400 hover:text-blue-700"
                  >
                    เงื่อนไขการใช้งาน
                  </button>
                  <span className="ml-2">ในการเข้าใช้งาน</span>
                </div>
              </label>

              <button
                type="submit"
                disabled={!canSubmitStore}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 font-medium shadow"
              >
                {submitting ? "กำลังสมัคร..." : "สมัครสมาชิก ร้านค้า"}
              </button>

              <p className="text-center text-sm text-gray-600">
                มีบัญชีอยู่แล้ว?{" "}
                <Link to="/signin" className="text-blue-600 hover:underline">เข้าสู่ระบบ</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
