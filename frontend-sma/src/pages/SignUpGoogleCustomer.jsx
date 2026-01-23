// src/pages/SignUpGoogleCustomer.jsx
// สมัครด้วย Google (ลูกค้า) -> /auth/google/start -> /auth/google/complete/customer

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

/* ===== ICONS (เทา) ===== */
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
};

/* ---------------------------------------------
 * INPUT (with left icon)
 * -------------------------------------------*/
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

export default function SignUpGoogleCustomer() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const { setToken } = useAuth?.() ?? { setToken: () => {} };

  // ===== UI state =====
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ===== Google state =====
  const googleBtnRef = useRef(null);

  // ✅ wrapper สำหรับวัดความกว้างจริง (responsive แบบไม่ทำให้ปุ่มเล็ก)
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
  const [givenName, setGivenName] = useState(location.state?.givenName || "");
  const [familyName, setFamilyName] = useState(location.state?.familyName || "");

  const [firstName, setFirstName] = useState(location.state?.givenName || "");
  const [lastName, setLastName] = useState(location.state?.familyName || "");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const nextFromState = location.state?.next || "";
  const nextFromQuery = params.get("next") || "";
  const nextTarget = nextFromState || nextFromQuery || "/customer/warranties";

  async function handleTokenLogin(token) {
    if (!token) {
      setError("ดำเนินการไม่สำเร็จ: ไม่พบโทเคน");
      return;
    }

    localStorage.setItem("token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    if (setToken) setToken(token);

    const role = decodeRoleFromToken(token);
    if (role !== "CUSTOMER") {
      localStorage.removeItem("token");
      delete api.defaults.headers.common["Authorization"];
      setError("ไม่พบบัญชีฝั่งลูกค้า (บัญชีนี้เป็นของอีกฝั่ง)");
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
        role: "CUSTOMER",
        mode: "signup", // ✅ สำคัญ: บอก backend ว่านี่คือ flow สมัคร
      });

      // ✅ กันกรณี backend เก่าเผลอส่ง token มา (ไม่ควรล็อกอินในหน้าสมัคร)
      if (data?.token || data?.existing) {
        setError("มีบัญชีอยู่แล้ว กรุณาไปหน้าเข้าสู่ระบบ");
        return;
      }

      if (data?.needsProfile && data?.signupToken) {
        setSignupToken(String(data.signupToken));
        setEmail(String(data.email || ""));
        setGivenName(String(data.givenName || ""));
        setFamilyName(String(data.familyName || ""));

        // prefill
        setFirstName((data.givenName || "").toString());
        setLastName((data.familyName || "").toString());
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

  // init google button (เฉพาะตอนยังไม่มี signupToken) — Responsive แบบ "กำหนด width จริง" (ไม่ใช้ scale)
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

        // render ครั้งแรกด้วยความกว้างจริง
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

      const payload = {
        signupToken,
        firstName: String(firstName || "").trim(),
        lastName: String(lastName || "").trim(),
        phone: String(phone || "").trim(),
        isConsent: true,
      };

      if (!payload.firstName || !payload.lastName || !payload.phone) {
        setError("กรุณากรอกข้อมูลให้ครบ: ชื่อ, นามสกุล, เบอร์โทรศัพท์");
        return;
      }

      const { data } = await api.post("/auth/google/complete/customer", payload);
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
            <h1 className="mt-4 text-2xl font-extrabold text-gray-900">สมัครด้วย Google (ลูกค้า)</h1>
            <p className="text-gray-600 text-sm">ยืนยันบัญชี Google แล้วกรอกข้อมูลที่จำเป็น</p>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {/* STEP 1: Google */}
          {!signupToken ? (
            <div className="mt-5">
              {googleErr ? (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {googleErr}
                </div>
              ) : null}

              {/* ✅ Google button (Responsive แบบไม่เล็ก: renderButton ด้วย width จริง) */}
              <div className="w-full flex justify-center">
                <div ref={googleWrapRef} className="w-full max-w-[420px] flex justify-center overflow-visible">
                  <div
                     ref={googleBtnRef}
                     className="w-full flex justify-center min-h-[56px] overflow-visible origin-center scale-[1.08]"
                     aria-label="สมัครด้วย Google (ลูกค้า)"
                  />
                </div>
              </div>

              {!googleReady && !googleErr ? (
                <div className="mt-2 text-center text-xs text-gray-400">กำลังโหลดปุ่ม Google...</div>
              ) : null}

              <div className="mt-4 text-center text-sm text-gray-600">
                หรือ{" "}
                <Link to="/signup" className="text-blue-600 hover:underline">
                  กลับไปสมัครด้วยอีเมล
                </Link>
              </div>
            </div>
          ) : (
            // STEP 2: Complete profile
            <form onSubmit={onSubmitComplete} className="mt-6 space-y-4" noValidate>
              {/* Email from Google */}
              <label className="block">
                <span className="block text-sm font-medium text-gray-700">อีเมล (จาก Google)</span>
                <InputIcon
                  value={email || ""}
                  readOnly
                  left={Icon.mail()}
                  className="bg-gray-50 cursor-not-allowed"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700">ชื่อ</span>
                  <InputIcon
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="ชื่อผู้ใช้"
                    required
                    left={Icon.user()}
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700">นามสกุล</span>
                  <InputIcon
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="นามสกุล"
                    required
                    left={Icon.user()}
                  />
                </label>
              </div>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</span>
                <InputIcon
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="กรอกเบอร์โทรศัพท์"
                  required
                  left={Icon.phone()}
                />
              </label>

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
                {submitting ? "กำลังสมัคร..." : "ยืนยันสมัครสมาชิก"}
              </button>

              <p className="text-center text-sm text-gray-600">
                มีบัญชีอยู่แล้ว?{" "}
                <Link to="/signin" className="text-blue-600 hover:underline">
                  เข้าสู่ระบบ
                </Link>
              </p>

              <div className="text-center text-xs text-gray-400">
                ถ้าต้องการใช้บัญชี Google อื่น ให้{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => {
                    // reset to step Google
                    setSignupToken("");
                    setEmail("");
                    setGivenName("");
                    setFamilyName("");
                    setFirstName("");
                    setLastName("");
                    setPhone("");
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
