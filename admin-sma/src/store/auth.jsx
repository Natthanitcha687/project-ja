import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken, clearToken } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTok] = useState(() => getToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) setToken(token);
    else clearToken();
  }, [token]);

  async function loadMe() {
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      setLoading(true);
      const { data } = await api.get("/admin/me");
      setUser(data?.user || null);
      return data?.user || null;
    } catch {
      setUser(null);
      setTok("");
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMe(); }, [token]);

  async function login(email, password) {
    const { data } = await api.post("/admin/auth/login", { email, password });
    if (!data?.token) throw new Error("ไม่พบ token");
    setTok(data.token);
    return await loadMe();
  }

  function logout() {
    setTok("");
    setUser(null);
  }

  const value = useMemo(
    () => ({ token, user, loading, login, logout, loadMe }),
    [token, user, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
