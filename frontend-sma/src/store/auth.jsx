//import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
//import { api } from '../lib/api'

//const AuthCtx = createContext(null)

//export function AuthProvider({ children }) {
  //const [user, setUser] = useState(() => {
    //const raw = localStorage.getItem('user')
    //if (!raw) return null
    //try {
     // return JSON.parse(raw)
    //} catch (error) {
     // console.warn('Invalid user payload in storage, clearing…')
      //localStorage.removeItem('user')
      //return null
    //}
  //})
  //const [token, setToken] = useState(() => localStorage.getItem('token'))

  //const login = useCallback(async (email, password) => {
  //  const { data } = await api.post('/auth/login', { email, password })
   // setUser(data.user)
   // setToken(data.token)
   // localStorage.setItem('user', JSON.stringify(data.user))
    //localStorage.setItem('token', data.token)
   // return data.user
//  }, [])

  //const logout = useCallback(() => {
   // setUser(null)
    //setToken(null)
   // localStorage.removeItem('user')
  //  localStorage.removeItem('token')
//  }, [])

  //useEffect(() => {
   // if (token) {
    //  api.defaults.headers.common.Authorization = `Bearer ${token}`
   // } else {
   //   delete api.defaults.headers.common.Authorization
   // }
//  }, [token])

//  const value = useMemo(() => ({ user, token, login, logout }), [user, token, login, logout])
 // return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
//}

//export const useAuth = () => useContext(AuthCtx)

// frontend-sma/src/store/auth.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // set header ให้ axios ทุกครั้งที่ token เปลี่ยน
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      localStorage.removeItem("token");
      delete api.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // โหลดข้อมูลผู้ใช้ปัจจุบัน (รวม role และ storeProfile)
  async function loadMe() {
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      setLoading(true);
      const { data } = await api.get("/auth/me");
 
      setUser(data?.user || data || null);
      return data?.user || data || null;
    } catch {
      setUser(null);
      setToken("");
      return null;
    } finally {
      setLoading(false);
    }
  }

  // เรียกโหลด me ครั้งแรกเมื่อมี token
  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // API สะดวกใช้
  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    if (!data?.token) throw new Error("ไม่พบโทเคนจากเซิร์ฟเวอร์");
    setToken(data.token);
    const me = await loadMe();
    return me; // ให้หน้าล็อกอินรู้ role / storeProfile ได้ทันที
  }

  function logout() {
    setToken("");
    setUser(null);
  }

  const value = useMemo(
    () => ({ token, setToken, user, setUser, loading, login, logout, loadMe }),
    [token, user, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
