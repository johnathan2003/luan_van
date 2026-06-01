import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { useAppSelector } from '../../store/hooks'
import NotificationCenter from './NotificationCenter'
import ThemeToggle from './ThemeToggle'
import { ROLE_LABELS } from '../../utils/constants'

/** Sáng: public/logo.png | Tối: public/logo1.png — đổi trong .env nếu cần */
const LOGO_LIGHT = import.meta.env.VITE_LOGO_LIGHT || import.meta.env.VITE_LOGO_URL || '/logo.png'
const LOGO_DARK = import.meta.env.VITE_LOGO_DARK || '/logo1.png'
const BRAND_NAME = import.meta.env.VITE_APP_NAME || 'BuyZo'

const Navbar: React.FC = () => {
  const { user, isAuthenticated, signOut, isAdmin, isShop, isShipper, currentRole, switchRole } = useAuth()
  const { resolvedTheme } = useTheme()
  const { cart } = useAppSelector(s => s.cart)
  const navigate = useNavigate()
  const [roleMenu, setRoleMenu] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [logoError, setLogoError] = useState(false)

  const logoSrc = resolvedTheme === 'dark' ? LOGO_DARK : LOGO_LIGHT

  useEffect(() => {
    setLogoError(false)
  }, [logoSrc])

  const handleLogout = () => { signOut(); navigate('/login') }

  const availableRoles = user?.roles?.filter(r => r.status === 'active') || []

  const getDashboardLink = () => {
    if (currentRole === 'admin') return '/admin'
    if (currentRole === 'shop') return '/shop'
    if (currentRole === 'shipper') return '/shipper'
    return '/'
  }

  return (
    <nav style={{
      background: 'var(--topbar-gradient, var(--bg-topbar))',
      color: 'var(--text-on-topbar)',
      height: 'var(--navbar-height)',
      display: 'flex',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      boxShadow: 'var(--topbar-shadow, var(--shadow-md))',
      transition: 'background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease',
    }}>
      <div
        className="container navbar-inner"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--navbar-gap)',
          width: '100%',
          paddingLeft: 'var(--navbar-padding-x)',
          paddingRight: 'var(--navbar-padding-x)',
        }}
      >
        {/* Logo: sáng → logo.png | tối → logo1.png */}
        <Link
          to="/"
          title={BRAND_NAME}
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            textDecoration: 'none',
            marginRight: 'var(--space-2)',
          }}
        >
          {!logoError ? (
            <img
              key={logoSrc}
              src={logoSrc}
              alt={BRAND_NAME}
              onError={() => setLogoError(true)}
              style={{
                height: 'var(--logo-height)',
                width: 'auto',
                maxWidth: 'var(--logo-max-width)',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <span style={{ fontWeight: 700, fontSize: 28, color: 'var(--text-on-topbar)', letterSpacing: -0.5 }}>
              {BRAND_NAME}
            </span>
          )}
        </Link>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 560, marginLeft: 'var(--space-4)', marginRight: 'var(--space-4)' }}>
          <div style={{ position: 'relative' }}>
            <input
              placeholder="Tìm kiếm sản phẩm..."
              style={{
                width: '100%', padding: '8px 40px 8px 14px', borderRadius: 'var(--radius-full)',
                border: 'none', fontSize: 14, outline: 'none',
                background: 'var(--bg-surface)', color: 'var(--text-primary)',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate(`/products?search=${(e.target as HTMLInputElement).value}`)
                }
              }}
            />
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}>🔍</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--navbar-actions-gap)', flexShrink: 0, marginLeft: 'var(--space-2)' }}>
          <ThemeToggle />

          {isAuthenticated ? (
            <>
              {/* Cart */}
              {(currentRole === 'user' || !currentRole) && (
                <Link to="/cart" style={{ color: 'var(--text-on-topbar)', position: 'relative', padding: 4 }}>
                  🛒
                  {cart.item_count > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4, background: 'var(--bg-surface)',
                      color: 'var(--cta-bg)', borderRadius: '50%', width: 18, height: 18,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                    }}>{cart.item_count}</span>
                  )}
                </Link>
              )}

              {/* Notifications */}
              <NotificationCenter />

              {/* Role switcher */}
              {availableRoles.length > 1 && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setRoleMenu(!roleMenu)}
                    style={{
                      background: 'rgba(0,0,0,0.12)', color: 'var(--text-on-topbar)', border: 'none',
                      padding: '6px 12px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {ROLE_LABELS[currentRole || 'user'] || currentRole} ▾
                  </button>
                  {roleMenu && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, background: 'var(--bg-card)',
                      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
                      minWidth: 160, marginTop: 4, overflow: 'hidden', zIndex: 100,
                      border: '1px solid var(--border-subtle)',
                    }}>
                      {availableRoles.map(r => (
                        <button
                          key={r.role_name}
                          onClick={() => { switchRole(r.role_name); setRoleMenu(false); navigate(getDashboardLink()) }}
                          style={{
                            width: '100%', padding: '10px 16px', background: currentRole === r.role_name ? 'var(--gray-100)' : 'var(--bg-card)',
                            border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14,
                            color: 'var(--text-primary)', fontWeight: currentRole === r.role_name ? 600 : 400,
                          }}
                        >
                          {ROLE_LABELS[r.role_name] || r.role_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* User menu */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setUserMenu(!userMenu)} style={{
                  background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: '50%',
                  width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--text-on-topbar)', fontWeight: 700, fontSize: 15,
                }}>
                  {user?.full_name?.[0]?.toUpperCase() || '?'}
                </button>
                {userMenu && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, background: 'var(--bg-card)',
                    borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
                    minWidth: 180, marginTop: 4, overflow: 'hidden', zIndex: 100,
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{user?.full_name}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user?.email}</p>
                    </div>
                    {[
                      { label: '👤 Hồ sơ', path: '/profile' },
                      ...(isShop ? [{ label: '🏪 Shop của tôi', path: '/shop' }] : []),
                      ...(isAdmin ? [{ label: '⚙️ Quản trị', path: '/admin' }] : []),
                      ...(isShipper ? [{ label: '🚚 Giao hàng', path: '/shipper' }] : []),
                      { label: '📦 Đơn hàng', path: '/orders' },
                    ].map(item => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setUserMenu(false)}
                        style={{ display: 'block', padding: '10px 16px', fontSize: 14, color: 'var(--text-primary)' }}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <button
                        onClick={handleLogout}
                        style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 14, color: 'var(--error)', cursor: 'pointer' }}
                      >
                        🚪 Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" style={{ color: 'var(--text-on-topbar)', fontSize: 14, fontWeight: 500 }}>Đăng nhập</Link>
              <Link to="/register" style={{
                background: 'var(--cta-bg)', color: 'var(--cta-text)', padding: '7px 16px',
                borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600,
              }}>Đăng ký</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
