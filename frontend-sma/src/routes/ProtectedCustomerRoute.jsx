import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';

export default function ProtectedCustomerRoute({ children }) {
  const { user, token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/signin" replace state={{ from: location }} />;
  if (!user || user.role !== 'CUSTOMER') return <Navigate to="/" replace />;
  return children;
}
