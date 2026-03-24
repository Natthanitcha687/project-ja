// src/components/Navbar.jsx
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import LanguageSwitcher from './LanguageSwitcher'
import { useTranslation } from 'react-i18next';

export default function Navbar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const { user, logout } = useAuth() || {};
  const isAuthenticated = !!user;
  const role = (user?.role || '').toUpperCase();
  const customerProfile = user?.customerProfile || {};
  const storeProfile = user?.storeProfile || null;

  // ปลายทางแดชบอร์ดแยกตาม role
  const dashHref =
    role === 'STORE'
      ? '/dashboard/warranty'
      : role === 'CUSTOMER'
        ? '/customer/warranties'
        : '/signin?next=/customer/warranties';

  let displayName = user?.name || user?.email || 'บัญชีของฉัน';
  let avatarUrl = '';

  if (role === 'STORE') {
    displayName = storeProfile?.storeName || user?.storeName || user?.store?.name || displayName;
    avatarUrl = storeProfile?.avatarUrl || '';
  } else if (role === 'CUSTOMER') {
    displayName = customerProfile.firstName
      ? `${customerProfile.firstName} ${customerProfile.lastName || ''}`.trim()
      : displayName;
    avatarUrl = customerProfile.avatarUrl && customerProfile.avatarUrl.trim() !== ''
      ? customerProfile.avatarUrl
      : '';
  }

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
          <span className="text-xl font-semibold text-gray-900">{t('navbar.logo', 'Warranty')}</span>
        </Link>
        {/* ...existing code... */}

        {/* เมนูกลาง */}
        <div className="hidden md:flex items-center gap-6 flex-1 justify-center">
          <NavLink
            end
            to="/"
            className={({ isActive }) =>
              `text-sm ${isActive ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`
            }
          >
            {t('navbar.home', 'หน้าหลัก')}
          </NavLink>
          <NavLink
            to="/warranty"
            className={({ isActive }) =>
              `text-sm ${isActive ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`
            }
          >
            {t('navbar.warranty', 'การรับประกัน')}
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `text-sm ${isActive ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`
            }
          >
            {t('navbar.about', 'เกี่ยวกับเรา')}
          </NavLink>

          {/* If authenticated, dashboard link is available on the right as 'ไปที่แดชบอร์ด' —
              remove duplicate middle nav item to avoid repetition */}
        </div>

        {/* ปุ่มขวา + LanguageSwitcher */}
        <div className="flex items-center gap-3 ml-auto">
          {isAuthenticated ? (
            <>
              <Link
                to={dashHref}
                className="hidden md:inline text-sm font-medium text-[color:var(--brand)] hover:text-[color:var(--brand-600)]"
              >
                {t('navbar.gotoDashboard', 'ไปที่แดชบอร์ด')}
              </Link>
              <Link
                to={dashHref}
                className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100 transition"
                title={t('navbar.gotoDashboard', 'ไปที่แดชบอร์ด')}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white overflow-hidden">
                  {role === 'CUSTOMER' ? (
                    avatarUrl && avatarUrl.trim() !== '' ? (
                      <img
                        src={avatarUrl}
                        alt="customer-avatar"
                        className="h-full w-full object-cover"
                        onError={e => { e.target.src = '/home-assets/customer.jpg'; }}
                      />
                    ) : (
                      <img
                        src="/home-assets/customer.jpg"
                        alt="customer-avatar"
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : role === 'STORE' ? (
                    avatarUrl && avatarUrl.trim() !== '' ? (
                      <img
                        src={avatarUrl}
                        alt="Store"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src="/home-assets/store.png"
                        alt="Store"
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : null}
                </span>
                <span className="hidden sm:inline">{displayName}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-800 transition"
              >
                {t('navbar.logout', 'ออกจากระบบ')}
                <img src="/home-assets/logout.png" alt={t('navbar.logout', 'ออกจากระบบ')} className="inline h-4 w-4 object-cover ml-2" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              {onSignin && (
                <Link
                  to="/signin"
                  className="inline-flex items-center justify-center rounded-xl border border-blue-600 text-blue-700 px-4 py-2 text-sm font-medium hover:bg-blue-50 transition"
                >
                  {t('navbar.signin', 'เข้าสู่ระบบ')}
                </Link>
              )}
              {onSignup && (
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition shadow-sm"
                >
                  {t('navbar.signup', 'สมัครสมาชิก')}
                </Link>
              )}
            </>
          )}
          <LanguageSwitcher />
        </div>
      </nav>
    </header>
  );
}