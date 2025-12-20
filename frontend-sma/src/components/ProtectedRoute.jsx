import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function ProtectedRoute({ children }) {
  const { user, token } = useAuth()
  const location = useLocation()

  if (!user || !token) {
    return <Navigate to="/signin" replace state={{ from: location }} />
  }

  return children
}