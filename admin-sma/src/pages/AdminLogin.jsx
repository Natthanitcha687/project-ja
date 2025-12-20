import { useState } from "react";
import { useAuth } from "../store/auth";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPass] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await login(email, password);
      nav("/");
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2.message || "Login failed");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white grid place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-semibold">Admin Login</div>
        <div className="mt-1 text-sm text-white/60">เข้าสู่ระบบผู้ดูแล</div>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl bg-zinc-900/60 border border-white/10 px-3 py-2 outline-none"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-zinc-900/60 border border-white/10 px-3 py-2 outline-none"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPass(e.target.value)}
          />
          {err && <div className="text-sm text-red-300">{err}</div>}
          <button className="w-full rounded-xl bg-white text-zinc-950 py-2 font-medium">
            Login
          </button>
        </div>
      </form>
    </div>
  );
}
