import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAppSelector } from '../../store/hooks'
import NotificationCenter from './NotificationCenter'
import { ROLE_LABELS } from '../../utils/constants'

const Navbar: React.FC = () => {
  const { user, isAuthenticated, signOut, isAdmin, isShop, isShipper, currentRole, switchRole } = useAuth()
  const { cart } = useAppSelector(s => s.cart)
  const navigate = useNavigate()
  const [roleMenu, setRoleMenu] = useState(false)
  const [userMenu, setUserMenu] = useState(false)

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
      background: 'var(--primary)', color: 'white', height: 'var(--navbar-height)',
      display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1000,
      boxShadow: 'var(--shadow-md)',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        {/* Logo */}
        <Link to="/" style={{ fontWeight: 700, fontSize: 22, color: 'white', letterSpacing: -0.5 }}>
          🛒 ShopVN
        </Link>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 480 }}>
          <div style={{ position: 'relative' }}>
            <input
              placeholder="Tìm kiếm sản phẩm..."
              style={{
                width: '100%', padding: '8px 40px 8px 14px', borderRadius: 'var(--radius-full)',
                border: 'none', fontSize: 14, outline: 'none',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginLeft: 'auto' }}>
          {isAuthenticated ? (
            <>
              {/* Cart */}
              {(currentRole === 'user' || !currentRole) && (
                <Link to="/cart" style={{ color: 'white', position: 'relative', padding: 4 }}>
                  🛒
                  {cart.item_count > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4, background: 'white',
                      color: 'var(--primary)', borderRadius: '50%', width: 18, height: 18,
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
                      background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none',
                      padding: '6px 12px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {ROLE_LABELS[currentRole || 'user'] || currentRole} ▾
                  </button>
                  {roleMenu && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, background: 'white',
                      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
                      minWidth: 160, marginTop: 4, overflow: 'hidden', zIndex: 100,
                    }}>
                      {availableRoles.map(r => (
                        <button
                          key={r.role_name}
                          onClick={() => { switchRole(r.role_name); setRoleMenu(false); navigate(getDashboardLink()) }}
                          style={{
                            width: '100%', padding: '10px 16px', background: currentRole === r.role_name ? 'var(--gray-100)' : 'white',
                            border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14,
                            color: 'var(--gray-700)', fontWeight: currentRole === r.role_name ? 600 : 400,
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
                  background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                  width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 15,
                }}>
                  {user?.full_name?.[0]?.toUpperCase() || '?'}
                </button>
                {userMenu && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, background: 'white',
                    borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
                    minWidth: 180, marginTop: 4, overflow: 'hidden', zIndex: 100,
                  }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray-800)' }}>{user?.full_name}</p>
                      <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>{user?.email}</p>
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
                        style={{ display: 'block', padding: '10px 16px', fontSize: 14, color: 'var(--gray-700)' }}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div style={{ borderTop: '1px solid var(--gray-100)' }}>
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
              <Link to="/login" style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>Đăng nhập</Link>
              <Link to="/register" style={{
                background: 'white', color: 'var(--primary)', padding: '7px 16px',
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
