// src/pages/SignUp.jsx
// เวอร์ชันเต็ม: ฟอร์มสมัครสมาชิก ลูกค้า/ร้านค้า + ตรวจสอบรหัสผ่าน + ส่ง API
// ✅ เพิ่มปุ่ม "สมัครด้วย Google" (พาไปหน้าแยก /signup/google/customer|store)

import { useEffect, useRef, useState, forwardRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

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
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท',
  'ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม',
  'นครราชสีมา','นครศรีธรรมราช','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี',
  'ปัตตานี','พระนครศรีอยุธยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต',
  'มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยะลา','ยโสธร','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี',
  'ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร',
  'สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง',
  'อุดรธานี','อุทัยธานี','อุบลราชธานี','อำนาจเจริญ','อุตรดิตถ์'
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

  // password states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  // other states
  const [consent, setConsent] = useState(false);
  const [pwError, setPwError] = useState("");
  const confirmRef = useRef(null);
  // terms modal visibility
  const [showTerms, setShowTerms] = useState(false);

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
        try { console.debug('loadDistrictsForProvince (from map)', { provinceCode: pid, matched: list.length }); } catch(e) {}
        setDistrictOptions(list.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })));
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
      try { console.debug('loadDistrictsForProvince (fallback)', { provinceCode: pid, districtsTotal: districtsData.length, matched: filtered.length }); } catch(e) {}
      setDistrictOptions(filtered.map((d) => ({ name: d.name_th || d.name, code: d.id ?? d.code })));
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
        try { console.debug('loadSubdistrictsForDistrict (from map)', { districtCode: did, matched: list.length }); } catch(e) {}
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
      try { console.debug('loadSubdistrictsForDistrict (fallback)', { districtCode: did, total: subs.length, matched: filtered.length }); } catch(e) {}
      setSubdistrictOptions(filtered.map((s) => ({ name: s.name_th || s.name, code: s.id ?? s.code, zipcode: s.zip_code || s.zipcode || s.zip })));
    } catch (err) {
      console.error('loadSubdistrictsForDistrict error', err);
      setSubdistrictOptions([]);
    }
  }

  // validate password/confirm
  useEffect(() => {
    let msg = "";
    if (password && password.length < 8) msg = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    // validate confirmation for both customer and store (both use confirm now)
    else if (confirmPassword && password !== confirmPassword) msg = "รหัสผ่านไม่ตรงกัน";
    setPwError(msg);
    if (confirmRef.current) confirmRef.current.setCustomValidity(msg);
  }, [password, confirmPassword]);

  // separate submit checks: customer uses a single password; store requires confirm
  const canSubmitCustomer =
    !submitting && consent && password.length >= 8 && confirmPassword.length >= 8 && password === confirmPassword;
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
      alert(err?.response?.data?.message || "สมัครสมาชิกไม่สำเร็จ");
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
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      storeName: fd.get("storeName"),
      typeStore: fd.get("typeStore"),
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
      alert(err?.response?.data?.message || "สมัครสมาชิกไม่สำเร็จ");
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

            {/* ✅ เพิ่ม: ปุ่มสมัครด้วย Google (แยกหน้าตามแท็บ) */}
            <div className="mt-5 w-full">
              <button
                type="button"
                onClick={() => navigate(googleSignupPath)}
                className="w-full h-11 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 font-semibold shadow-sm transition flex items-center justify-center gap-2"
              >
                {/* Google G icon */}
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.66 32.657 29.194 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.958 3.042l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 19.01 12 24 12c3.059 0 5.842 1.154 7.958 3.042l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.344 4.337-17.694 10.691z" />
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.197l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.173 0-9.626-3.323-11.284-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.23-2.231 4.155-4.094 5.565l.003-.002 6.19 5.238C36.98 39.14 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                </svg>
                สมัครด้วย Google
                <span className="text-xs text-gray-500 font-medium ml-1">
                  ({tab === "store" ? "ร้านค้า" : "ลูกค้า"})
                </span>
              </button>

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
                  <InputIcon name="firstName" placeholder="ชื่อผู้ใช้" required left={Icon.user()} />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700">นามสกุล</span>
                  <InputIcon name="lastName" placeholder="นามสกุล" required left={Icon.user()} />
                </label>
              </div>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">อีเมล</span>
                <InputIcon name="email" type="email" placeholder="กรอกอีเมลของคุณ" required left={Icon.mail()} />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</span>
                <InputIcon name="phone" placeholder="กรอกเบอร์โทรศัพท์" required left={Icon.phone()} />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">รหัสผ่าน</span>
                <InputIcon
                  name="password"
                  type="password"
                  minLength={8}
                  placeholder="กรอกรหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  left={Icon.lock()}
                  right={null}
                  invalid={!!pwError && password.length < 8}
                />
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                <InputIcon name="storeName" placeholder="ชื่อร้านค้า" required left={Icon.home()} />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">ประเภทร้านค้า</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">{Icon.home()}</span>
                  <select
                    name="typeStore"
                    className="mt-1 w-full h-10 rounded-xl border border-gray-300 bg-white pl-10 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue=""
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
                <InputIcon name="ownerStore" placeholder="ชื่อเจ้าของร้าน" required left={Icon.user()} />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">อีเมล</span>
                <InputIcon name="email" type="email" placeholder="กรอกอีเมลของคุณ" required left={Icon.mail()} />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</span>
                <InputIcon name="phone" placeholder="กรอกเบอร์โทรศัพท์" required left={Icon.phone()} />
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
                        onChange={(e) => updateAddress({ postcode: e.target.value })}
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
                  <div className="flex items-center justify-between text-sm text-gray-700 mb-3">
                    <div className="font-medium">เลือกวันที่เปิด</div>
                    <div className="text-xs text-gray-400">คลิกที่วันเพื่อเปิด/ปิด แล้วเลือกเวลาเริ่ม–จบ</div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[
                      ['mon','จ.' ],
                      ['tue','อ.' ],
                      ['wed','พ.' ],
                      ['thu','พฤ.' ],
                      ['fri','ศ.' ],
                      ['sat','ส.' ],
                      ['sun','อา.']
                    ].map(([key,label]) => (
                      <div key={key} className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 py-2 rounded-md hover:bg-slate-50">
                        <div className="flex items-center gap-3 md:w-36 w-full">
                          <input
                            type="checkbox"
                            checked={!!schedule[key].on}
                            onChange={() => setSchedule(s => ({ ...s, [key]: { ...s[key], on: !s[key].on } }))}
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
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  left={Icon.lock()}
                  right={null} // ตัดไอคอนตาออก
                  invalid={!!pwError && password.length < 8}
                />
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
