import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function AdminProtectedRoute({ children }) {
  const { token, user, loading, logout } = useAuth();
  const loc = useLocation();

  if (loading) return <div className="p-6">Loading...</div>;
  if (!token) return <Navigate to="/login" replace state={{ from: loc }} />;

  if (!user || user.role !== "ADMIN") {
    logout();
    return <Navigate to="/login" replace />;
  }

  return children;
}
