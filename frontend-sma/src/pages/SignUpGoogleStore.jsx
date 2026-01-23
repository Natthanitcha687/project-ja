// src/pages/SignUpGoogleStore.jsx
// สมัครด้วย Google (ร้านค้า) -> /auth/google/start -> /auth/google/complete/store

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

/* ===== ICONS (เทา) ===== */
const Icon = {
  user: (cls = "w-5 h-5") => (
    <svg
      viewBox="0 0 24 24"
      className={`${cls} text-gray-400`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0116 0" />
    </svg>
  ),
  mail: (cls = "w-5 h-5") => (
    <svg
      viewBox="0 0 24 24"
      className={`${cls} text-gray-400`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M4 6h16v12H4z" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  ),
  phone: (cls = "w-5 h-5") => (
    <svg
      viewBox="0 0 24 24"
      className={`${cls} text-gray-400`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012 4.18 2 2 0 014 2h3a2 2 0 012 1.72c.12.9.3 1.78.57 2.63a2 2 0 01-.45 2.11L8.1 9.9a16 16 0 006 6l1.44-1.02a2 2 0 012.11-.45 19 19 0 002.63.57A2 2 0 0122 16.92z" />
    </svg>
  ),
  home: (cls = "w-5 h-5") => (
    <svg
      viewBox="0 0 24 24"
      className={`${cls} text-gray-400`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 10l9-7 9 7" />
      <path d="M9 22V12h6v10" />
    </svg>
  ),
  lock: (cls = "w-5 h-5") => (
    <svg
      viewBox="0 0 24 24"
      className={`${cls} text-gray-400`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  ),
};

function InputIcon({ left, className = "", ...props }) {
  return (
    <div className="relative">
      {left ? <span className="absolute left-3 top-1/2 -translate-y-1/2">{left}</span> : null}
      <input
        {...props}
        className={
          "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 " +
          (left ? "pl-10 " : "") +
          className
        }
      />
    </div>
  );
}

// รายชื่อจังหวัด 77 จังหวัด (ชื่อภาษาไทย) (fallback)
const TH_PROVINCES = [
  "กรุงเทพมหานคร","กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท",
  "ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม",
  "นครราชสีมา","นครศรีธรรมราช","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี",
  "ปัตตานี","พระนครศรีอยุธยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่","ภูเก็ต",
  "มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยะลา","ยโสธร","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี",
  "ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม","สมุทรสาคร",
  "สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย","หนองบัวลำภู","อ่างทอง",
  "อุดรธานี","อุทัยธานี","อุบลราชธานี","อำนาจเจริญ","อุตรดิตถ์"
];

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

// ===== helper: ถอด role จาก JWT (รองรับ padding) =====
function decodeRoleFromToken(token) {
  try {
    if (!token) return null;
    let base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const payload = JSON.parse(atob(base64));
    return String(payload?.role || payload?.user?.role || payload?.claims?.role || "").toUpperCase();
  } catch {
    return null;
  }
}

export default function SignUpGoogleStore() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const { setToken } = useAuth?.() ?? { setToken: () => {} };

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ===== Google state =====
  const googleBtnRef = useRef(null);
  const googleWrapRef = useRef(null);

  const [googleReady, setGoogleReady] = useState(false);
  const [googleErr, setGoogleErr] = useState("");

  const googleClientId = useMemo(
    () => (import.meta?.env?.VITE_GOOGLE_CLIENT_ID ? String(import.meta.env.VITE_GOOGLE_CLIENT_ID).trim() : ""),
    []
  );

  // ===== signup flow state =====
  const [signupToken, setSignupToken] = useState(location.state?.signupToken || "");
  const [email, setEmail] = useState(location.state?.email || "");

  // ===== store form state =====
  const [storeName, setStoreName] = useState("");
  const [typeStore, setTypeStore] = useState("");
  const [ownerStore, setOwnerStore] = useState("");
  const [phone, setPhone] = useState("");

  const defaultSchedule = {
    mon: { on: true, start: "09:00", end: "18:00" },
    tue: { on: true, start: "09:00", end: "18:00" },
    wed: { on: true, start: "09:00", end: "18:00" },
    thu: { on: true, start: "09:00", end: "18:00" },
    fri: { on: true, start: "09:00", end: "18:00" },
    sat: { on: false, start: "09:00", end: "12:00" },
    sun: { on: false, start: "09:00", end: "12:00" },
  };
  const [schedule, setSchedule] = useState(defaultSchedule);

  // structured address state (เหมือน SignUp.jsx)
  const [addressStreet, setAddressStreet] = useState("");
  const [addressSubdistrict, setAddressSubdistrict] = useState("");
  const [addressDistrict, setAddressDistrict] = useState("");
  const [addressProvince, setAddressProvince] = useState("");
  const [addressPostcode, setAddressPostcode] = useState("");

  function updateAddress(patch = {}) {
    if (patch.street !== undefined) setAddressStreet(patch.street);
    if (patch.subdistrict !== undefined) setAddressSubdistrict(patch.subdistrict);
    if (patch.district !== undefined) setAddressDistrict(patch.district);
    if (patch.province !== undefined) setAddressProvince(patch.province);
    if (patch.postcode !== undefined) setAddressPostcode(patch.postcode);
  }

  // location datasets (เหมือน SignUp.jsx)
  const PROVINCES_JSON_LOCAL = "/data/api_province.json";
  const DISTRICTS_JSON_LOCAL = "/data/api_district.json";
  const SUBDISTRICTS_JSON_LOCAL = "/data/api_subdistrict.json";
  const PROVINCES_JSON_FALLBACK =
    "https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/province.json";
  const DISTRICTS_JSON_FALLBACK =
    "https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/district.json";
  const SUBDISTRICTS_JSON_FALLBACK =
    "https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/sub_district.json";

  const [provincesList, setProvincesList] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [subdistrictOptions, setSubdistrictOptions] = useState([]);
  const [districtsCache, setDistrictsCache] = useState(null);
  const [subdistrictsCache, setSubdistrictsCache] = useState(null);
  const [districtsMap, setDistrictsMap] = useState(null);
  const [subdistrictsMap, setSubdistrictsMap] = useState(null);

  // terms
  const [consent, setConsent] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const nextFromState = location.state?.next || "";
  const nextFromQuery = params.get("next") || "";
  const nextTarget = nextFromState || nextFromQuery || "/dashboard/warranty";

  async function handleTokenLogin(token) {
    if (!token) {
      setError("ดำเนินการไม่สำเร็จ: ไม่พบโทเคน");
      return;
    }

    localStorage.setItem("token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    if (setToken) setToken(token);

    const role = decodeRoleFromToken(token);
    if (role !== "STORE") {
      localStorage.removeItem("token");
      delete api.defaults.headers.common["Authorization"];
      setError("ไม่พบบัญชีฝั่งร้านค้า (บัญชีนี้เป็นของอีกฝั่ง)");
      return;
    }

    navigate(nextTarget, { replace: true });
  }

  async function startWithGoogleCredential(credential) {
    try {
      setSubmitting(true);
      setError("");
      setGoogleErr("");

      const { data } = await api.post("/auth/google/start", {
        credential,
        role: "STORE",
      });

      if (data?.token) {
        await handleTokenLogin(data.token);
        return;
      }

      if (data?.needsProfile && data?.signupToken) {
        setSignupToken(String(data.signupToken));
        setEmail(String(data.email || ""));
        return;
      }

      setError("สมัครด้วย Google ไม่สำเร็จ");
    } catch (err) {
      const body = err?.response?.data || {};
      setError(body?.message || err?.message || "สมัครด้วย Google ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  // load provinces/districts/subdistricts on mount (เพื่อให้ dropdown ทำงานเหมือนเดิม)
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

        setProvincesList(provData.map((p) => ({ name: p.name_th || p.name, code: p.id ?? p.code })));
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
        console.error("loadAll location data failed", err);
        setProvincesList(TH_PROVINCES.map((p, i) => ({ name: p, code: String(i) })));
        setDistrictsCache(null);
        setSubdistrictsCache(null);
        setDistrictsMap(null);
        setSubdistrictsMap(null);
      }
    }
    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  async function loadDistrictsForProvince(provinceNameOrCode) {
    try {
      if (!provinceNameOrCode) {
        setDistrictOptions([]);
        return;
      }
      let provinceCode = provinceNameOrCode;
      if (isNaN(Number(provinceNameOrCode))) {
        const p = provincesList.find((x) => x.name === provinceNameOrCode);
        provinceCode = p?.code;
      }

      const pid = String(provinceCode);
      if (districtsMap) {
        const list = districtsMap[pid] || [];
        setDistrictOptions(list.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })));
        return;
      }

      let districtsData = districtsCache;
      if (!districtsData) {
        let res = await fetch(DISTRICTS_JSON_LOCAL);
        if (!res.ok) res = await fetch(DISTRICTS_JSON_FALLBACK);
        districtsData = await res.json();
        setDistrictsCache(districtsData);
      }

      const filtered = districtsData.filter((d) => String(d.province_id ?? d.province_code) === pid);
      setDistrictOptions(filtered.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })));
    } catch (err) {
      console.error("loadDistrictsForProvince error", err);
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
        setSubdistrictOptions(list.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })));
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
      setSubdistrictOptions(filtered.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })));
    } catch (err) {
      console.error("loadSubdistrictsForDistrict error", err);
      setSubdistrictOptions([]);
    }
  }

  // init google button (เฉพาะตอนยังไม่มี signupToken) — Responsive แบบไม่เล็ก + ไม่กระพริบ
  useEffect(() => {
    let cancelled = false;
    let ro = null;
    let raf = 0;

    const MIN_W = 280;
    const MAX_W = 420;
    const RERENDER_THRESHOLD = 24;
    let lastW = 0;

    function cleanup() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (ro) {
        ro.disconnect();
        ro = null;
      }
      window.removeEventListener("resize", scheduleResize);
    }

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
        size: "large",
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

        if (signupToken) {
          if (googleBtnRef.current) googleBtnRef.current.innerHTML = "";
          return;
        }
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
            if (cred) startWithGoogleCredential(cred);
            else setError("ไม่พบ credential จาก Google");
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // render ครั้งแรกตามความกว้างจริง
        scheduleResize();
        setGoogleReady(true);

        if (googleWrapRef.current && "ResizeObserver" in window) {
          ro = new ResizeObserver(() => scheduleResize());
          ro.observe(googleWrapRef.current);
        } else {
          window.addEventListener("resize", scheduleResize);
        }
      } catch (e) {
        if (!cancelled) setGoogleErr("ไม่สามารถโหลดปุ่ม Google ได้");
      }
    }

    init();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [signupToken, googleClientId]);

  async function onSubmitComplete(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (!signupToken) {
        setError("กรุณากดสมัครด้วย Google ก่อน");
        return;
      }
      if (!consent) {
        setError("กรุณายอมรับเงื่อนไขการใช้งาน");
        return;
      }

      const addressJson = JSON.stringify({
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
      });

      const payload = {
        signupToken,
        storeName: String(storeName || "").trim(),
        typeStore: String(typeStore || "").trim(),
        ownerStore: String(ownerStore || "").trim(),
        phone: String(phone || "").trim(),
        address: addressJson,
        timeAvailable: JSON.stringify(schedule),
        isConsent: true,
      };

      // required check (ให้สอดคล้องกับ backend)
      const required = ["storeName", "typeStore", "ownerStore", "phone", "address", "timeAvailable"];
      for (const k of required) {
        if (!payload[k] || String(payload[k]).trim() === "") {
          setError(`กรุณากรอกข้อมูลให้ครบ: ${k}`);
          return;
        }
      }

      const { data } = await api.post("/auth/google/complete/store", payload);
      const token = data?.token;
      await handleTokenLogin(token);
    } catch (err) {
      const body = err?.response?.data || {};
      setError(body?.message || err?.message || "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#eaf3ff] flex items-center justify-center px-4 py-10">
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
                <p>หากทำผิดเงื่อนไข ผู้ให้บริการมีสิทธิ์ระงับ/ยกเลิกบัญชี และลบข้อมูลที่เกี่ยวข้องตามความเหมาะสม</p>

                <p className="mt-6"><strong className="font-semibold">6.</strong> การเข้าถึงข้อมูล & Activity Logs</p>
                <p>ผู้ดูแลระบบมีสิทธิ์เข้าถึงข้อมูลและ Logs เฉพาะเพื่อการสนับสนุน/ตรวจสอบข้อร้องเรียน/สืบสวนเหตุการณ์เท่านั้น</p>

                <p className="mt-6"><strong className="font-semibold">7.</strong> Data Integrity</p>
                <p>ผู้ดูแลระบบมีสิทธิ์แบบ Read-only และตรวจสอบ Logs เท่านั้น ไม่มีสิทธิ์แก้ไขหรือลบใบรับประกันที่ออกโดยร้านค้า</p>
              </div>
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
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-300 shadow flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-blue-600" fill="currentColor" aria-hidden="true">
                <path d="M12 2l7 3v7c0 5-3.6 8.4-7 9-3.4-.6-7-4-7-9V5l7-3z" />
                <path fill="#fff" d="M10.3 12.7l-.99-.99-1.41 1.41 1.7 1.7a1 1 0 001.41 0l4.1-4.1-1.41-1.41-3.4 3.39z" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-gray-900">สมัครด้วย Google (ร้านค้า)</h1>
            <p className="text-gray-600 text-sm">ยืนยันบัญชี Google แล้วกรอกข้อมูลร้านที่จำเป็น</p>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {!signupToken ? (
            <div className="mt-5">
              {googleErr ? (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {googleErr}
                </div>
              ) : null}

              {/* ✅ Google button (Responsive แบบไม่เล็ก + ไม่กระพริบ) */}
              <div className="w-full flex justify-center">
                <div ref={googleWrapRef} className="w-full max-w-[420px] flex justify-center">
                  <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" aria-label="สมัครด้วย Google (ร้านค้า)" />
                </div>
              </div>

              {!googleReady && !googleErr ? (
                <div className="mt-2 text-center text-xs text-gray-400">กำลังโหลดปุ่ม Google...</div>
              ) : null}

              <div className="mt-4 text-center text-sm text-gray-600">
                หรือ{" "}
                <Link to="/signup?role=store" className="text-blue-600 hover:underline">
                  กลับไปสมัครด้วยอีเมล
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmitComplete} className="mt-6 space-y-4" noValidate>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700">อีเมล (จาก Google)</span>
                <InputIcon value={email || ""} readOnly left={Icon.mail()} className="bg-gray-50 cursor-not-allowed" />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">ชื่อร้านค้า</span>
                <InputIcon value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="ชื่อร้านค้า" required left={Icon.home()} />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">ประเภทร้านค้า</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">{Icon.home()}</span>
                  <select
                    value={typeStore}
                    onChange={(e) => setTypeStore(e.target.value)}
                    className="mt-1 w-full h-10 rounded-xl border border-gray-300 bg-white pl-10 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">ชื่อเจ้าของร้าน</span>
                <InputIcon value={ownerStore} onChange={(e) => setOwnerStore(e.target.value)} placeholder="ชื่อเจ้าของร้าน" required left={Icon.user()} />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</span>
                <InputIcon value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="กรอกเบอร์โทรศัพท์" required left={Icon.phone()} />
              </label>

              {/* Address (เหมือน SignUp.jsx) */}
              <label className="block">
                <span className="block text-sm font-medium text-gray-700">ที่อยู่ร้าน</span>
                <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">เลขที่ / ซอย / ถนน</label>
                    <textarea
                      value={addressStreet}
                      onChange={(e) => updateAddress({ street: e.target.value })}
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
                          value={addressProvince}
                          onChange={async (e) => {
                            const code = e.target.value;
                            updateAddress({ province: code, district: "", subdistrict: "", postcode: "" });
                            await loadDistrictsForProvince(code);
                            setSubdistrictOptions([]);
                            setAddressDistrict("");
                            setAddressSubdistrict("");
                          }}
                          className="appearance-none mt-1 w-full h-9 rounded-xl border border-gray-300 bg-white pl-3 pr-8 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          value={addressDistrict}
                          onChange={async (e) => {
                            const code = e.target.value;
                            const found = districtOptions.find((d) => String(d.code) === String(code));
                            updateAddress({ district: code, subdistrict: "", postcode: "" });
                            if (found) await loadSubdistrictsForDistrict(found.code);
                            else setSubdistrictOptions([]);
                          }}
                          className="appearance-none mt-1 w-full h-9 rounded-xl border border-gray-300 bg-white pl-3 pr-8 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="" disabled>เลือกอำเภอ/เขต</option>
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
                          <option value="" disabled>เลือกตำบล/แขวง</option>
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
                        value={addressPostcode}
                        onChange={(e) => updateAddress({ postcode: e.target.value })}
                        placeholder="เช่น 10110"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="w-full h-9 rounded-xl border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="col-span-2 text-xs text-gray-400 flex items-center">
                      ตัวอย่าง: เลขที่/ซอย/ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์
                    </div>
                  </div>
                </div>
              </label>

              {/* Business hours schedule (เหมือน SignUp.jsx) */}
              <label className="block">
                <span className="block text-sm font-medium text-gray-700">เวลาทำการ</span>
                <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between text-sm text-gray-700 mb-3">
                    <div className="font-medium">เลือกวันที่เปิด</div>
                    <div className="text-xs text-gray-400">คลิกที่วันเพื่อเปิด/ปิด แล้วเลือกเวลาเริ่ม–จบ</div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[
                      ["mon", "จ."],
                      ["tue", "อ."],
                      ["wed", "พ."],
                      ["thu", "พฤ."],
                      ["fri", "ศ."],
                      ["sat", "ส."],
                      ["sun", "อา."],
                    ].map(([key, label]) => (
                      <div key={key} className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 py-2 rounded-md hover:bg-slate-50">
                        <div className="flex items-center gap-3 md:w-36 w-full">
                          <input
                            type="checkbox"
                            checked={!!schedule[key].on}
                            onChange={() => setSchedule((s) => ({ ...s, [key]: { ...s[key], on: !s[key].on } }))}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-700">{label}</span>
                            <span className="text-xs text-gray-400">{schedule[key].on ? "เปิด" : "ปิด"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                          <input
                            type="time"
                            value={schedule[key].start}
                            onChange={(e) => setSchedule((s) => ({ ...s, [key]: { ...s[key], start: e.target.value } }))}
                            className="h-9 w-24 md:w-32 rounded border border-gray-300 bg-white px-2 text-sm"
                            disabled={!schedule[key].on}
                          />
                          <span className="text-xs text-gray-400">—</span>
                          <input
                            type="time"
                            value={schedule[key].end}
                            onChange={(e) => setSchedule((s) => ({ ...s, [key]: { ...s[key], end: e.target.value } }))}
                            className="h-9 w-24 md:w-32 rounded border border-gray-300 bg-white px-2 text-sm"
                            disabled={!schedule[key].on}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </label>

              {/* Consent */}
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
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
                disabled={submitting}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 font-medium shadow"
              >
                {submitting ? "กำลังสมัคร..." : "ยืนยันสมัครสมาชิก ร้านค้า"}
              </button>

              <p className="text-center text-sm text-gray-600">
                มีบัญชีอยู่แล้ว?{" "}
                <Link to="/signin?role=store" className="text-blue-600 hover:underline">
                  เข้าสู่ระบบ
                </Link>
              </p>

              <div className="text-center text-xs text-gray-400">
                ถ้าต้องการใช้บัญชี Google อื่น ให้{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => {
                    setSignupToken("");
                    setEmail("");
                    setStoreName("");
                    setTypeStore("");
                    setOwnerStore("");
                    setPhone("");
                    setSchedule(defaultSchedule);

                    setAddressStreet("");
                    setAddressProvince("");
                    setAddressDistrict("");
                    setAddressSubdistrict("");
                    setAddressPostcode("");

                    setConsent(false);
                    setError("");
                  }}
                >
                  เริ่มใหม่
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
