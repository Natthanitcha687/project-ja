// src/components/Navbar.jsx
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const { user, logout } = useAuth() || {};
  const isAuthenticated = !!user;
  const role = (user?.role || '').toUpperCase();

  // ปลายทางแดชบอร์ดแยกตาม role
  const dashHref =
    role === 'STORE'
      ? '/dashboard/warranty'
      : role === 'CUSTOMER'
      ? '/customer/warranties'
      : '/signin?next=/customer/warranties';

  const displayName =
    user?.store?.name || user?.storeName || user?.name || user?.email || 'บัญชีของฉัน';

  const onSignin = pathname !== "/signin";
  const onSignup = pathname !== "/signup";

  const handleLogout = async () => {
    try {
      await logout?.();
    } finally {
      navigate('/signin', { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-black/10">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* โลโก้ */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/home-assets/logo.png"
            alt="Warranty Platform Logo"
            className="w-8 h-8 object-contain drop-shadow-sm"
            draggable="false"
          />
          <span className="text-xl font-semibold text-gray-900">Warranty</span>
        </Link>

        {/* เมนูกลาง */}
        <div className="hidden md:flex items-center gap-6">
          <NavLink
            end
            to="/"
            className={({ isActive }) =>
              `text-sm ${isActive ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`
            }
          >
            หน้าหลัก
          </NavLink>
          <NavLink
            to="/warranty"
            className={({ isActive }) =>
              `text-sm ${isActive ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`
            }
          >
            การรับประกัน
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `text-sm ${isActive ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`
            }
          >
            เกี่ยวกับเรา
          </NavLink>

          {isAuthenticated && (
            <NavLink
              to={dashHref}
              className={({ isActive }) =>
                `text-sm ${isActive ? 'text-[color:var(--brand)]' : 'text-gray-600 hover:text-gray-900'}`
              }
            >
              แดชบอร์ด
            </NavLink>
          )}
        </div>

        {/* ปุ่มขวา */}
        {isAuthenticated ? (
          <div className="flex items-center gap-4">
            <Link
              to={dashHref}
              className="hidden md:inline text-sm font-medium text-[color:var(--brand)] hover:text-[color:var(--brand-600)]"
            >
              ไปที่แดชบอร์ด
            </Link>
            <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{displayName}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-800 transition"
            >
              ออกจากระบบ
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {onSignin && (
              <Link
                to="/signin"
                className="inline-flex items-center justify-center rounded-xl border border-blue-600 text-blue-700 px-4 py-2 text-sm font-medium hover:bg-blue-50 transition"
              >
                เข้าสู่ระบบ
              </Link>
            )}
            {onSignup && (
              <Link
                to="/signup"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition shadow-sm"
              >
                สมัครสมาชิก
              </Link>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}