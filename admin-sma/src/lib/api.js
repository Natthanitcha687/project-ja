import axios from "axios";

export const API_URL =
  (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.replace(/\/+$/, "")) ||
  "http://localhost:4000";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

const KEY = "admin_token";

export function getToken() {
  return localStorage.getItem(KEY) || "";
}
export function setToken(token) {
  if (!token) return clearToken();
  localStorage.setItem(KEY, token);
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}
export function clearToken() {
  localStorage.removeItem(KEY);
  delete api.defaults.headers.common.Authorization;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const bootToken = getToken();
if (bootToken) api.defaults.headers.common.Authorization = `Bearer ${bootToken}`;
