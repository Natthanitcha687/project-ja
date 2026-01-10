// src/main.jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useLocation,
  Navigate,
} from 'react-router-dom'
import './index.css'
import { AuthProvider } from './store/auth.jsx'
import Footer from './components/Footer'
import Home from './pages/Home'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import WarrantyDashboard from './pages/WarrantyDashboard'
import WarrantyInfo from './pages/WarrantyInfo'
import About from './pages/About'
import StoreDashboard from './pages/StoreDashboard'
import CustomerWarranty from './pages/CustomerWarranty.jsx'
import CustomerComplaints from './pages/CustomerComplaints'

// แถบของฝั่งลูกค้า / แดชบอร์ด (rich header with profile / notifications)
import CustomerNavbar from './components/CustomerNavbar.jsx'
import Navbar from './components/Navbar.jsx'

import * as Sentry from '@sentry/react'

// ✅ Sentry init (ใช้ DSN จาก ENV: VITE_SENTRY_DSN)
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: Boolean(import.meta.env.VITE_SENTRY_DSN),
})

// ✅ TEMP: ให้ทดสอบว่า Sentry ส่ง event เข้าได้แน่นอน (ลบทิ้งหลังเทส)
window.__sentryTest = () => {
  Sentry.captureException(new Error('Sentry test - frontend (capture)'))
}
window.__sentryThrow = () => {
  throw new Error('Sentry test - frontend (throw)')
}

/** ===== Helpers / Guards ===== */
function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

function ProtectedStoreRoute({ children }) {
  const location = useLocation()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const role = token ? decodeJwt(token)?.role : null

  if (!token) {
    return <Navigate to="/signin" replace state={{ from: location }} />
  }
  if (role !== 'STORE') {
    return <Navigate to="/" replace />
  }
  return children
}

function ProtectedCustomerRoute({ children }) {
  const location = useLocation()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const role = token ? decodeJwt(token)?.role : null

  if (!token) {
    return <Navigate to="/signin" replace state={{ from: location }} />
  }
  if (role !== 'CUSTOMER') {
    if (role === 'STORE') return <Navigate to="/dashboard/warranty" replace />
    return <Navigate to="/" replace />
  }
  return children
}

/** ===== Layouts ===== */
// Layout สาธารณะ (โฮม/สมัคร/ล็อกอิน/แดชบอร์ดร้าน)
function PublicLayout() {
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/dashboard')
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* หน้า dashboard (ร้านค้า) ให้ใช้ CustomerNavbar ที่มีเมนูโปรไฟล์/การแจ้งเตือน
          หน้า public (รวมถึง / home) ให้ใช้ Navbar แบบเดิม */}
      {/* For store dashboard pages we don't show the top CustomerNavbar because
          the dashboard page renders its own header — avoid duplicated headers.
          Customer area (/customer) still uses the rich CustomerNavbar. */}
      {location.pathname.startsWith('/customer') ? (
        <CustomerNavbar />
      ) : location.pathname.startsWith('/dashboard') ? null : (
        <Navbar />
      )}
      <main><Outlet /></main>
      {!isDashboard && <Footer />}
    </div>
  )
}

// Layout เฉพาะฝั่งลูกค้า (ใช้ CustomerNavbar)
function CustomerLayout() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <CustomerNavbar />
      <main><Outlet /></main>
      <Footer />
    </div>
  )
}

/** ===== Router ===== */
const router = createBrowserRouter([
  // กลุ่ม public + แดชบอร์ดฝั่งร้าน
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/warranty', element: <WarrantyInfo /> },
      { path: '/about', element: <About /> },
      { path: '/signin', element: <SignIn /> },
      { path: '/signup', element: <SignUp /> },
      { path: '/verify-email', element: <VerifyEmail /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
      { path: '/reset-password', element: <ResetPassword /> },

      {
        path: '/dashboard/warranty',
        element: (
          <ProtectedStoreRoute>
            <WarrantyDashboard />
          </ProtectedStoreRoute>
        ),
      },

      {
        path: '/dashboard/store',
        element: (
          <ProtectedStoreRoute>
            <StoreDashboard />
          </ProtectedStoreRoute>
        ),
      },
    ],
  },

  // กลุ่มฝั่งลูกค้า — ใช้ CustomerLayout
  {
    path: '/customer',
    element: <CustomerLayout />,
    children: [
      { index: true, element: <Navigate to="warranties" replace /> },
      {
        path: 'warranties',
        element: (
          <ProtectedCustomerRoute>
            <CustomerWarranty />
          </ProtectedCustomerRoute>
        ),
      },

      // ✅ เพิ่มให้ตรงกับลิงก์ /customer/complaints ที่อยู่ใน CustomerNavbar.jsx
      {
        path: 'complaints',
        element: (
          <ProtectedCustomerRoute>
            <CustomerComplaints />
          </ProtectedCustomerRoute>
        ),
      },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
)
