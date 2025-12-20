// frontend-sma/src/routes/ProtectedStoreRoute.jsx
import { Navigate } from "react-router-dom";

function decodeJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch { return null; }
}

export default function ProtectedStoreRoute({ children }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const role = token ? decodeJwt(token)?.role : null;

  if (!token) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }
  if (role !== "STORE") {
    return <Navigate to="/" replace />;
  }
  return children;
}
