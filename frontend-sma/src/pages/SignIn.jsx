// src/pages/SignIn.jsx
// [อัปเดต] **ตัดโค้ดไอคอนตาออกทั้งหมด 100%**
// ✅ เพิ่ม: เข้าสู่ระบบด้วย Google (GIS) -> POST /auth/google/start

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

/* ===== ICONS (เทา) ===== */
const Icon = {
  mail: (cls = "w-5 h-5") => (
    <svg viewBox="0 0 24 24" className={`${cls} text-gray-400`} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16v12H4z" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  ),
  lock: (cls = "w-5 h-5") => (
    <svg viewBox="0 0 24 24" className={`${cls} text-gray-400`} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  ),
  // Icon.eye และ Icon.eyeOff ถูกลบออกทั้งหมดแล้ว
};

function InputIcon({ left, right, className = "", ...props }) {
  return (
    <div className="relative">
      {left ? <span className="absolute left-3 top-1/2 -translate-y-1/2">{left}</span> : null}
      <input
        {...props}
        className={
          "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 " +
          (left ? "pl-10 " : "") +
          // ไม่มีการเพิ่ม pr-10 เมื่อไม่มี right icon แล้ว
          (right ? "pr-10 " : "") +
          className
        }
      />
      {right ? <span className="absolute right-3 top-1/2 -translate-y-1/2">{right}</span> : null}
    </div>
  );
}

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
        icon={
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20a8 8 0 0116 0" />
          </svg>
        }
      />
      <Btn
        val="store"
        label="ร้านค้า"
        icon={
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10l9-7 9 7" />
            <path d="M9 22V12h6v10" />
          </svg>
        }
      />
    </div>
  );
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

/* =========================
 * Google Identity Services helpers
 * ========================= */
function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("No window"));
    if (window.google?.accounts?.id) return resolve(true);

    // prevent duplicate script
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

export default function SignIn() {
  const [params] = useSearchParams();
  const initial = params.get("role") === "store" ? "store" : "customer";
  const [tab, setTab] = useState(initial);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ===== OTP state =====
  const [step, setStep] = useState("password"); // "password" | "otp"
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [otpMsg, setOtpMsg] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [expiresInSec, setExpiresInSec] = useState(null);

  // ===== Google state =====
  const googleBtnRef = useRef(null);

  // ✅ เพิ่มเฉพาะเพื่อทำ responsive แบบ "ไม่กระพริบ" (scale อย่างเดียว ไม่ rebuild ปุ่ม)
  const googleWrapRef = useRef(null);
  const [googleScale, setGoogleScale] = useState(1);

  const [googleReady, setGoogleReady] = useState(false);
  const [googleErr, setGoogleErr] = useState("");
  const googleClientId = useMemo(
    () => (import.meta?.env?.VITE_GOOGLE_CLIENT_ID ? String(import.meta.env.VITE_GOOGLE_CLIENT_ID).trim() : ""),
    []
  );

  const navigate = useNavigate();
  const location = useLocation();
  const { setToken } = useAuth?.() ?? { setToken: () => {} };
  // const [showPwd, setShowPwd] = useState(false); // **ถูกลบออก**

  useEffect(() => {
    const q = params.get("role");
    if (q === "customer" || q === "store") setTab(q);
  }, [params]);

  function resetOtpState() {
    setStep("password");
    setChallengeId("");
    setOtp("");
    setOtpMsg("");
    setPendingEmail("");
    setExpiresInSec(null);
  }

  async function handleTokenLogin(token) {
    if (!token) {
      setError("เข้าสู่ระบบไม่สำเร็จ: ไม่พบโทเคน");
      return;
    }

    // เก็บ token
    localStorage.setItem("token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    if (setToken) setToken(token);

    // ตรวจ role ให้ตรงกับแท็บ
    const role = decodeRoleFromToken(token); // "STORE" | "CUSTOMER"
    const expected = tab === "store" ? "STORE" : "CUSTOMER";
    if (role !== expected) {
      localStorage.removeItem("token");
      delete api.defaults.headers.common["Authorization"];
      setError("ไม่พบบัญชีทางฝั่งนี้ (บัญชีนี้เป็นของอีกฝั่ง)");
      return;
    }

    // ===== จุดแก้หลัก: คำนวณปลายทาง =====
    const nextParam = params.get("next"); // เช่น /customer/warranties
    let redirectTo =
      location.state?.from?.pathname ||
      nextParam ||
      (role === "STORE" ? "/dashboard/warranty" : "/customer/warranties");

    navigate(redirectTo, { replace: true });
  }

  // ===== Google: send credential to backend =====
  async function handleGoogleCredential(credential) {
    try {
      setError("");
      setGoogleErr("");
      setSubmitting(true);

      const role = tab === "store" ? "STORE" : "CUSTOMER";

      const { data } = await api.post("/auth/google/start", {
        credential,
        role,
      });

      // existing -> token login
      if (data?.token) {
        await handleTokenLogin(data.token);
        return;
      }

      // needs profile -> ไปหน้ากรอกข้อมูลเพิ่ม
      if (data?.needsProfile && data?.signupToken) {
        const nextParam = params.get("next") || location.state?.from?.pathname || "";
        const to = tab === "store" ? "/signup/google/store" : "/signup/google/customer";

        navigate(to, {
          replace: true,
          state: {
            signupToken: data.signupToken,
            email: data.email || null,
            givenName: data.givenName || null,
            familyName: data.familyName || null,
            role: data.role || role,
            next: nextParam || null,
          },
        });
        return;
      }

      setError("เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
    } catch (err) {
      const body = err?.response?.data || {};
      setError(body?.message || err?.message || "เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  // ===== Google: init + render button (Responsive แบบไม่กระพริบ: scale อย่างเดียว ไม่ rebuild) =====
  useEffect(() => {
    let cancelled = false;
    let ro = null;

    const BASE_W = 420;

    function applyScale() {
      const wrap = googleWrapRef.current;
      if (!wrap) return;
      const w = wrap.clientWidth || BASE_W;
      const s = Math.min(1, w / BASE_W);
      const rounded = Math.round(s * 1000) / 1000;
      setGoogleScale((prev) => (Math.abs(prev - rounded) < 0.001 ? prev : rounded));
    }

    async function initGoogle() {
      try {
        setGoogleErr("");
        setGoogleReady(false);

        // แสดง Google เฉพาะหน้า password
        if (step !== "password") {
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

        // clear container (เฉพาะตอน init/สลับแท็บ/สลับ step เท่านั้น)
        if (googleBtnRef.current) googleBtnRef.current.innerHTML = "";

        g.initialize({
          client_id: googleClientId,
          callback: (resp) => {
            const cred = resp?.credential;
            if (cred) handleGoogleCredential(cred);
            else setError("ไม่พบ credential จาก Google");
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // ✅ render แค่ครั้งเดียว (ไม่ render ซ้ำตอน resize)
        if (googleBtnRef.current) {
          g.renderButton(googleBtnRef.current, {
            theme: "outline",
            size: "large",
            shape: "pill",
            width: BASE_W,
            text: "signin_with",
            locale: "th",
          });
        }

        // ✅ คำนวณ scale ให้ responsive โดย "ไม่ rebuild ปุ่ม"
        requestAnimationFrame(() => {
          if (!cancelled) applyScale();
        });

        if (googleWrapRef.current && "ResizeObserver" in window) {
          ro = new ResizeObserver(() => applyScale());
          ro.observe(googleWrapRef.current);
        } else {
          window.addEventListener("resize", applyScale);
        }

        setGoogleReady(true);
      } catch (e) {
        if (!cancelled) {
          setGoogleErr("ไม่สามารถโหลดปุ่ม Google ได้");
        }
      }
    }

    initGoogle();
    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      window.removeEventListener("resize", applyScale);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, step, googleClientId]);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const payload = { email: fd.get("email"), password: fd.get("password") };

    try {
      const { data } = await api.post("/auth/login", payload); // ใช้เอ็นด์พอยต์ของคุณ

      // ✅ OTP required
      if (data?.otpRequired && data?.challengeId) {
        setPendingEmail(String(payload.email || ""));
        setChallengeId(String(data.challengeId));
        setExpiresInSec(typeof data.expiresInSec === "number" ? data.expiresInSec : null);
        setOtpMsg(data?.message || "ส่งรหัส OTP ไปที่อีเมลแล้ว");
        setOtp("");
        setStep("otp");
        return;
      }

      const token = data?.token;
      await handleTokenLogin(token);
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data || {};
      if (status === 403 && body?.needsVerify) {
        const verifyUrl = body?.verifyUrl;
        const q = new URLSearchParams();
        q.set("email", payload.email || "");
        if (verifyUrl) q.set("preview", verifyUrl);
        navigate(`/verify-email?${q.toString()}`, { replace: true });
        return;
      }
      setError(body?.message || err?.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerifyOtp(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const code = String(otp || "").trim();
      if (!challengeId || !code) {
        setError("กรุณากรอกรหัส OTP ให้ครบ");
        return;
      }

      const { data } = await api.post("/auth/login/otp/verify", {
        challengeId,
        code,
      });

      const token = data?.token;
      await handleTokenLogin(token);
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data || {};
      if (status === 403 && body?.needsVerify) {
        const verifyUrl = body?.verifyUrl;
        const q = new URLSearchParams();
        q.set("email", pendingEmail || "");
        if (verifyUrl) q.set("preview", verifyUrl);
        navigate(`/verify-email?${q.toString()}`, { replace: true });
        return;
      }
      setError(body?.message || err?.message || "ยืนยัน OTP ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResendOtp() {
    setSubmitting(true);
    setError("");

    try {
      if (!challengeId) {
        setError("ไม่พบข้อมูลสำหรับส่ง OTP อีกครั้ง");
        return;
      }

      const { data } = await api.post("/auth/login/otp/resend", { challengeId });

      if (data?.otpRequired && data?.challengeId) {
        setChallengeId(String(data.challengeId));
        setExpiresInSec(typeof data.expiresInSec === "number" ? data.expiresInSec : null);
        setOtpMsg(data?.message || "ส่ง OTP ใหม่แล้ว");
        setOtp("");
        return;
      }

      setError("ส่ง OTP ใหม่ไม่สำเร็จ");
    } catch (err) {
      const body = err?.response?.data || {};
      setError(body?.message || err?.message || "ส่ง OTP ใหม่ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#eaf3ff] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-2xl shadow-2xl border border-black/5 p-8">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-300 shadow flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-blue-600" fill="currentColor">
                <path d="M12 2l7 3v7c0 5-3.6 8.4-7 9-3.4-.6-7-4-7-9V5l7-3z" />
                <path
                  fill="#fff"
                  d="M10.3 12.7l-.99-.99-1.41 1.41 1.7 1.7a1 1 0 001.41 0l4.1-4.1-1.41-1.41-3.4 3.39z"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-gray-900">เข้าสู่ระบบ</h1>
            <p className="text-gray-600 text-sm">เลือกประเภทบัญชีของคุณ</p>
            <div className="mt-4">
              <Tabs
                value={tab}
                onChange={(v) => {
                  setError("");
                  setTab(v);
                  resetOtpState();
                }}
              />
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {step === "password" ? (
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              {/* ✅ Google login button */}
              <div className="mt-1">
                {googleErr ? (
                  <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {googleErr}
                  </div>
                ) : null}

                {/* ✅ Responsive แบบไม่กระพริบ: scale อย่างเดียว ไม่ rebuild */}
                <div className="w-full flex justify-center">
                  <div ref={googleWrapRef} className="w-full max-w-[420px] overflow-hidden flex justify-center">
                    <div style={{ width: 420, transform: `scale(${googleScale})`, transformOrigin: "top center" }}>
                      <div
                        ref={googleBtnRef}
                        className="flex justify-center"
                        aria-label={`เข้าสู่ระบบด้วย Google (${tab === "store" ? "ร้านค้า" : "ลูกค้า"})`}
                      />
                    </div>
                  </div>
                </div>

                {!googleReady && !googleErr ? (
                  <div className="mt-2 text-center text-xs text-gray-400">กำลังโหลดปุ่ม Google...</div>
                ) : null}

                <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
                  <div className="h-px bg-gray-200 flex-1" />
                  <span>หรือเข้าสู่ระบบด้วยอีเมล</span>
                  <div className="h-px bg-gray-200 flex-1" />
                </div>
              </div>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">อีเมล</span>
                <InputIcon
                  name="email"
                  type="email"
                  placeholder={tab === "store" ? "กรอกอีเมลร้านค้า" : "กรอกอีเมลของคุณ"}
                  required
                  left={Icon.mail()}
                />
              </label>

              <label className="block">
                <div className="flex items-baseline justify-between">
                  <span className="block text-sm font-medium text-gray-700">รหัสผ่าน</span>
                  <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
                    ลืมรหัสผ่าน?
                  </Link>
                </div>
                <InputIcon
                  name="password"
                  type="password"
                  placeholder="กรอกรหัสผ่าน"
                  required
                  left={Icon.lock()}
                  right={null}
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl border border-blue-600 text-blue-700 hover:bg-blue-50 disabled:opacity-70 py-2.5 font-medium"
              >
                {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </button>

              <p className="text-center text-sm text-gray-600">
                ยังไม่มีบัญชีผู้ใช้?{" "}
                <Link to="/signup" className="text-blue-600 hover:underline">
                  สมัครสมาชิก
                </Link>
              </p>
              {/* moved forgot-password link to password field header */}
            </form>
          ) : (
            <form onSubmit={onVerifyOtp} className="mt-4 space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {otpMsg || "ส่งรหัส OTP ไปที่อีเมลแล้ว"}
                {pendingEmail ? <span className="ml-1 font-semibold">({pendingEmail})</span> : null}
                {typeof expiresInSec === "number" ? (
                  <span className="ml-2 text-blue-700/70">หมดอายุประมาณ {Math.ceil(expiresInSec / 60)} นาที</span>
                ) : null}
              </div>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">รหัส OTP (6 หลัก)</span>
                <InputIcon
                  value={otp}
                  onChange={(e) => {
                    setError("");
                    setOtp(e.target.value);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="กรอกรหัส OTP"
                  required
                  left={Icon.lock()}
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl border border-blue-600 text-blue-700 hover:bg-blue-50 disabled:opacity-70 py-2.5 font-medium"
              >
                {submitting ? "กำลังยืนยัน..." : "ยืนยัน OTP"}
              </button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onResendOtp}
                  className="text-sm text-blue-600 hover:underline disabled:opacity-70"
                >
                  ส่ง OTP อีกครั้ง
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setError("");
                    resetOtpState();
                  }}
                  className="text-sm text-gray-600 hover:underline disabled:opacity-70"
                >
                  กลับไปกรอกรหัสผ่าน
                </button>
              </div>

              <p className="text-center text-sm text-gray-600">
                ยังไม่มีบัญชีผู้ใช้?{" "}
                <Link to="/signup" className="text-blue-600 hover:underline">
                  สมัครสมาชิก
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
