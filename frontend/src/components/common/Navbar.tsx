import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { useAppSelector } from '../../store/hooks'
import NotificationCenter from './NotificationCenter'
import { formatCurrency } from '../../utils/formatters'

const ROLE_META: Record<string, { icon: string; color: string; label: string }> = {
  admin:    { icon: '⚙️', color: '#1D4ED8', label: 'Admin' },
  shop:     { icon: '🏪', color: '#16A34A', label: 'Shop' },
  shipper:  { icon: '🚚', color: '#D97706', label: 'Shipper' },
  user:     { icon: '👤', color: '#7C3AED', label: 'Khach hang' },
  employee: { icon: '👷', color: '#DB2777', label: 'Nhan vien' },
}

const BTN       = 36
const ROLE_STEP = BTN + 6

const LOGO_LIGHT = import.meta.env.VITE_LOGO_LIGHT || import.meta.env.VITE_LOGO_URL || '/logo.png'
const LOGO_DARK  = import.meta.env.VITE_LOGO_DARK  || '/logo1.png'
const BRAND_NAME = import.meta.env.VITE_APP_NAME   || 'BuyZo'

const ANIM_CSS = '@keyframes fsd{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}} @keyframes sug{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}'

// ─── SuggestBox — gọi API thật ───────────────────────────────────────────────
// ─── SuggestBox — gọi API thật ───────────────────────────────────────────────
interface SuggestBoxProps {
  query: string
  onNavigate: (path: string) => void
}

const SuggestBox: React.FC<SuggestBoxProps> = ({ query, onNavigate }) => {
  const [products, setProducts] = React.useState<any[]>([])
  const [shops,    setShops]    = React.useState<any[]>([])
  const [loading,  setLoading]  = React.useState(false)

  React.useEffect(() => {
    if (!query.trim()) { setProducts([]); setShops([]); return }
    const timer = setTimeout(() => {
      setLoading(true)
      const q = encodeURIComponent(query.trim())
      Promise.all([
        fetch(`/api/v1/products?search=${q}&limit=5`).then(r => r.ok ? r.json() : { items: [] }),
        fetch(`/api/v1/shop/search?q=${q}&limit=4`).then(r => r.ok ? r.json() : { shops: [] }),
      ]).then(([pRes, sRes]) => {
        setProducts(pRes.items ?? [])
        setShops(sRes.shops ?? [])
      }).finally(() => setLoading(false))
    }, 300)  // debounce 300ms
    return () => clearTimeout(timer)
  }, [query])

  const row = (e: React.MouseEvent<HTMLDivElement>, enter: boolean) => {
    (e.currentTarget as HTMLDivElement).style.background = enter ? 'var(--bg-highlight,#f3f4f6)' : 'transparent'
  }

  if (loading) return (
    <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
      Đang tìm kiếm...
    </div>
  )

  if (!query.trim()) return (
    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
      Nhập từ khoá để tìm sản phẩm hoặc cửa hàng
    </div>
  )

  const empty = products.length === 0 && shops.length === 0

  return (
    <div>
      {/* Sản phẩm */}
      {products.length > 0 && (
        <div>
          <div style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Sản phẩm</span>
            <button onMouseDown={e => { e.preventDefault(); onNavigate(`/products?search=${encodeURIComponent(query.trim())}`) }}
              style={{ fontSize: 11, color: 'var(--primary,#7C3AED)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              Xem tất cả →
            </button>
          </div>
          {products.map((p: any) => (
            <div key={p.product_id} onMouseDown={e => { e.preventDefault(); onNavigate(`/products/${p.product_id}`) }}
              onMouseEnter={e => row(e, true)} onMouseLeave={e => row(e, false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', cursor: 'pointer', transition: 'background 0.15s' }}>
              {p.image_urls?.[0]
                ? <img src={p.image_urls[0]} alt={p.product_name} style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover', border: '1px solid var(--border-subtle)', flexShrink: 0 }} />
                : <div style={{ width: 40, height: 40, borderRadius: 7, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📦</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product_name}</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary,#7C3AED)', margin: 0 }}>{formatCurrency(parseFloat(p.price))}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      {products.length > 0 && shops.length > 0 && (
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
      )}

      {/* Cửa hàng */}
      {shops.length > 0 && (
        <div>
          <div style={{ padding: '10px 16px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Cửa hàng</span>
          </div>
          {shops.map((sh: any) => (
            <div key={sh.shop_id} onMouseDown={e => { e.preventDefault(); onNavigate(`/shops/${sh.shop_id}`) }}
              onMouseEnter={e => row(e, true)} onMouseLeave={e => row(e, false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', cursor: 'pointer', transition: 'background 0.15s' }}>
              {sh.avatar_url
                ? <img src={sh.avatar_url} alt={sh.shop_name} style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover', border: '1px solid var(--border-subtle)', flexShrink: 0 }} />
                : <div style={{ width: 40, height: 40, borderRadius: 7, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏪</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sh.shop_name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                  <span style={{ color: '#f59e0b' }}>★</span> {sh.rating}
                  {sh.address && <span> · {sh.address}</span>}
                </p>
              </div>
              <div style={{ flexShrink: 0, padding: '2px 8px', background: '#dcfce7', borderRadius: 10, fontSize: 10, fontWeight: 700, color: '#16a34a' }}>Shop</div>
            </div>
          ))}
        </div>
      )}

      {/* Không tìm thấy */}
      {empty && (
        <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
          Không tìm thấy kết quả cho "{query}"
        </div>
      )}

      {/* Xem tất cả */}
      {!empty && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-highlight,#f8f9fa)' }}>
          <button
            onMouseDown={e => { e.preventDefault(); onNavigate(`/products?search=${encodeURIComponent(query.trim())}`) }}
            style={{ width: '100%', padding: '7px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary,#7C3AED)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            🔍 Tìm kiếm tất cả kết quả cho "{query}"
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Dropdown menu item helper ────────────────────────────────────────────────
interface MenuItemProps {
  icon: string
  label: string
  sub?: string
  path: string
  onClick: () => void
}
const MenuItem: React.FC<MenuItemProps> = ({ icon, label, sub, path, onClick }) => (
  <Link to={path} onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 14, color: 'var(--text-primary)', textDecoration: 'none', transition: 'background 0.15s' }}
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-highlight,#f3f4f6)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
    <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
    <div>
      <p style={{ margin: 0, fontWeight: 500, lineHeight: 1.3 }}>{label}</p>
      {sub && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{sub}</p>}
    </div>
  </Link>
)

const SectionLabel: React.FC<{ children: React.ReactNode; border?: boolean }> = ({ children, border }) => (
  <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, borderTop: border ? '1px solid var(--border-subtle)' : 'none', marginTop: border ? 4 : 0 }}>
    {children}
  </div>
)

// ─── Navbar ───────────────────────────────────────────────────────────────────
const Navbar: React.FC = () => {
  const { user, isAuthenticated, signOut, isAdmin, isShop, isShipper, currentRole, switchRole } = useAuth()
  const { resolvedTheme } = useTheme()
  const { cart }          = useAppSelector(s => s.cart)
  const navigate          = useNavigate()

  const [radialOpen,   setRadialOpen]   = useState(false)
  const [logoError,    setLogoError]    = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchFocus,  setSearchFocus]  = useState(false)

  const radialRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!radialOpen) return
    const h = (e: MouseEvent) => {
      if (radialRef.current && !radialRef.current.contains(e.target as Node)) setRadialOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [radialOpen])

  const logoSrc = resolvedTheme === 'dark' ? LOGO_DARK : LOGO_LIGHT
  useEffect(() => { setLogoError(false) }, [logoSrc])

  const handleLogout = () => { signOut(); navigate('/login') }

  const availableRoles = user?.roles?.filter(r => r.status === 'active') || []
  const roleNames      = availableRoles.map(r => r.role_name)

  const PURPLE = '#6D28D9'
  const roleGradient: Record<string, string> = {
    admin:    `linear-gradient(to right, ${PURPLE} 0%, #1D4ED8 100%)`,
    shop:     `linear-gradient(to right, ${PURPLE} 0%, #16A34A 100%)`,
    shipper:  `linear-gradient(to right, ${PURPLE} 0%, #D97706 100%)`,
    employee: `linear-gradient(to right, ${PURPLE} 0%, #DB2777 100%)`,
  }
  const navBg = (isAuthenticated && currentRole && roleGradient[currentRole])
    ? roleGradient[currentRole]
    : 'var(--topbar-gradient, var(--bg-topbar))'

  const goTo = (rn: string) => {
    switchRole(rn)
    setRadialOpen(false)
    const dest = rn === 'admin' ? '/admin' : rn === 'shop' ? '/shop' : rn === 'shipper' ? '/shipper' : rn === 'employee' ? '/employee' : '/'
    setTimeout(() => navigate(dest), 50)
  }

  const bellShift = radialOpen ? roleNames.length * ROLE_STEP : 0

  const handleSearchNav = (path: string) => {
    setSearchFocus(false)
    setSearchQuery('')
    if (path.startsWith('#')) {
      const el = document.getElementById(path.slice(1))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        navigate('/')
        setTimeout(() => {
          document.getElementById(path.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 400)
      }
      return
    }
    navigate(path)
  }

  const showSuggest = searchFocus

  // Role badge color
  const roleBadgeStyle = (role: string | undefined) => {
    if (role === 'shop')    return { bg: '#DBEAFE', color: '#1D4ED8', label: '🏪 Shop' }
    if (role === 'admin')   return { bg: '#FEF3C7', color: '#D97706', label: '⚙️ Admin' }
    if (role === 'shipper') return { bg: '#FEF9C3', color: '#854D0E', label: '🚚 Shipper' }
    if (role === 'user')     return { bg: '#EDE9FE', color: '#7C3AED', label: '👤 Khach hang' }
    if (role === 'employee') return { bg: '#FCE7F3', color: '#DB2777', label: '👷 Nhan vien' }
    return { bg: '#F3F4F6', color: '#6B7280', label: '👤 Khach hang' }
  }
  const badge = roleBadgeStyle(currentRole)

  const close = () => setRadialOpen(false)

  return (
    <nav style={{
      background: navBg,
      color: 'var(--text-on-topbar)',
      height: 'var(--navbar-height)',
      display: 'flex', alignItems: 'center',
      position: 'sticky', top: 0, zIndex: 1000,
      boxShadow: 'var(--topbar-shadow, var(--shadow-md))',
      transition: 'background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease',
    }}>
      <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />

      <div className="container navbar-inner" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--navbar-gap)', width: '100%',
        paddingLeft: 'var(--navbar-padding-x)', paddingRight: 'var(--navbar-padding-x)',
      }}>

        {/* Logo */}
        <Link to="/" title={BRAND_NAME} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, textDecoration: 'none', marginRight: 'var(--space-2)', gap: 2 }}>
          {!logoError
            ? <img key={logoSrc} src={logoSrc} alt={BRAND_NAME} onError={() => setLogoError(true)} style={{ height: 'var(--logo-height)', width: 'auto', maxWidth: 'var(--logo-max-width)', objectFit: 'contain', display: 'block' }} />
            : <span style={{ fontWeight: 700, fontSize: 28, color: 'var(--text-on-topbar)', letterSpacing: -0.5 }}>{BRAND_NAME}</span>
          }
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-on-topbar)', opacity: 0.85, lineHeight: 1 }}>BuyZO.com</span>
        </Link>

        {/* Search */}
        <div ref={searchRef} style={{ flex: 1, maxWidth: 560, marginLeft: 'var(--space-4)', marginRight: 'var(--space-4)', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
              placeholder="Tim kiem san pham, nhan hang, cua hang..."
              style={{
                width: '100%', padding: '8px 40px 8px 14px', fontSize: 14, outline: 'none',
                borderRadius: showSuggest ? '10px 10px 0 0' : 'var(--radius-full)',
                border: showSuggest ? '1.5px solid var(--primary,#7C3AED)' : 'none',
                borderBottom: showSuggest ? 'none' : undefined,
                background: 'var(--bg-surface)', color: 'var(--text-primary)',
                transition: 'border-radius 0.15s', boxSizing: 'border-box',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  setSearchFocus(false)
                  navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`)
                  setSearchQuery('')
                }
                if (e.key === 'Escape') setSearchFocus(false)
              }}
            />
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: showSuggest ? 'var(--primary,#7C3AED)' : 'var(--gray-400)', pointerEvents: 'none', transition: 'color 0.2s' }}>
              🔍
            </span>
          </div>

          {showSuggest && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2000 }}>
              <div style={{
                background: 'var(--bg-card)', borderRadius: '0 0 14px 14px',
                border: '1.5px solid var(--primary,#7C3AED)', borderTop: 'none',
                boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden',
                animation: 'sug 0.18s cubic-bezier(0.34,1.2,0.64,1)',
                maxHeight: 460, overflowY: 'auto',
              }}>
                <SuggestBox query={searchQuery} onNavigate={handleSearchNav} />
              </div>
            </div>
          )}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--navbar-actions-gap)', flexShrink: 0, marginLeft: 'var(--space-2)' }}>
          {isAuthenticated ? (
            <div ref={radialRef} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

              {/* Cart + Bell */}
              <div style={{ transform: `translateX(-${bellShift}px)`, transition: 'transform 0.35s cubic-bezier(0.34,1.2,0.64,1)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, position: 'relative', zIndex: 2 }}>
                <Link to="/cart" style={{ position: 'relative', textDecoration: 'none', width: BTN, height: BTN, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.25)', color: 'var(--text-on-topbar)', fontSize: 17, transition: 'background 0.2s', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}>
                  🛒
                  {cart.item_count > 0 && (
                    <span style={{ position: 'absolute', top: -3, right: -3, background: '#EF4444', color: '#fff', borderRadius: '50%', width: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, border: '1.5px solid rgba(255,255,255,0.8)' }}>
                      {cart.item_count > 9 ? '9+' : cart.item_count}
                    </span>
                  )}
                </Link>
                <NotificationCenter />
              </div>

              {/* Role buttons + Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {roleNames.map((rn, i) => {
                  const meta     = ROLE_META[rn] || { icon: '👤', color: '#888', label: rn }
                  const isActive = rn === currentRole
                  return (
                    <button key={rn} title={meta.label} onClick={() => goTo(rn)} style={{
                      position: 'absolute', right: `calc(100% + ${i * ROLE_STEP}px + 4px)`, top: '50%',
                      width: BTN, height: BTN, borderRadius: '50%',
                      background: isActive ? meta.color : 'rgba(255,255,255,0.2)',
                      border: isActive ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.5)',
                      color: '#fff', fontSize: 16, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isActive ? `0 0 0 3px ${meta.color}55` : '0 2px 6px rgba(0,0,0,0.25)',
                      zIndex: 10,
                      transform: radialOpen ? 'translateY(-50%) scale(1)' : 'translateY(-50%) scale(0.1)',
                      opacity: radialOpen ? 1 : 0,
                      pointerEvents: radialOpen ? 'auto' : 'none',
                      transition: `transform 0.3s cubic-bezier(0.34,1.56,0.64,1) ${i * 50}ms, opacity 0.25s ease ${i * 50}ms`,
                    }}>
                      {meta.icon}
                    </button>
                  )
                })}

                <button onClick={() => setRadialOpen(o => !o)} title={user?.full_name || ''} style={{
                  background: radialOpen ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)',
                  border: radialOpen ? '2px solid rgba(255,255,255,0.8)' : '2px solid rgba(255,255,255,0.3)',
                  borderRadius: 20, height: BTN + 4, padding: '0 10px 0 8px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  color: 'var(--text-on-topbar)', fontWeight: 700, fontSize: 14,
                  transition: 'all 0.2s ease', position: 'relative', zIndex: 3,
                }}>
                  <span style={{ width: BTN - 6, height: BTN - 6, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                    {user?.full_name?.[0]?.toUpperCase() || '?'}
                  </span>
                  <span style={{ fontSize: 10, opacity: 0.8, display: 'inline-block', transform: radialOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}>▾</span>
                </button>

                {/* Dropdown */}
                {radialOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', minWidth: 220, overflow: 'hidden', zIndex: 400, border: '1px solid var(--border-subtle)', animation: 'fsd 0.18s ease' }}>

                    {/* Header */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{user?.full_name}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 6px' }}>{user?.email}</p>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </div>

                    {/* ── Role-switcher nhanh (chỉ hiện khi có > 1 role) ── */}
                    {availableRoles.length > 1 && (
                      <div style={{ padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)' }}>
                        {availableRoles.map(r => {
                          const meta = ROLE_META[r.role_name] || { icon: '👤', color: '#888', label: r.role_name }
                          const active = r.role_name === currentRole
                          return (
                            <button key={r.role_name} onClick={() => { goTo(r.role_name) }}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
                                fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                                background: active ? meta.color : 'var(--bg-highlight, #f3f4f6)',
                                color: active ? '#fff' : 'var(--text-primary)', transition: 'all 0.15s' }}>
                              {meta.icon} {meta.label}
                              {active && <span style={{ fontSize: 9, opacity: 0.8 }}>✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* ── Menu theo current_role ── */}

                    {/* Shop owner */}
                    {currentRole === 'shop' && (
                      <div>
                        <SectionLabel>Tai khoan</SectionLabel>
                        <MenuItem icon="👤" label="Trang ca nhan"       path="/profile"               onClick={close} />
                        <MenuItem icon="📦" label="Don hang cua toi"    sub="Lich su mua hang"         path="/orders"              onClick={close} />
                        <MenuItem icon="💬" label="Tin nhan khach"      sub="Chat voi nguoi mua"       path="/shop/chat"           onClick={close} />
                        <SectionLabel border>Quan ly Shop</SectionLabel>
                        <MenuItem icon="⚙️" label="Quan ly shop"       sub="San pham, don hang, NV"   path="/shop"                onClick={close} />
                        <MenuItem icon="🏪" label="Xem trang shop"     sub="Giao dien khach thay"     path={`/shops/${user?.user_id}`} onClick={close} />
                        <MenuItem icon="🎫" label="Voucher shop"        sub="Ma giam gia cua shop"     path="/shop/vouchers"       onClick={close} />
                        <MenuItem icon="🎁" label="Trung tam voucher"                                  path="/vouchers"            onClick={close} />
                        <MenuItem icon="⚠️" label="Khieu nai cua toi"                                 path="/complaints"          onClick={close} />
                      </div>
                    )}

                    {/* Admin */}
                    {currentRole === 'admin' && (
                      <div>
                        <SectionLabel>Tai khoan</SectionLabel>
                        <MenuItem icon="👤" label="Ho so ca nhan"       path="/profile"  onClick={close} />
                        <MenuItem icon="📦" label="Don hang cua toi"    path="/orders"   onClick={close} />
                        <MenuItem icon="🎁" label="Trung tam voucher"   path="/vouchers" onClick={close} />
                        <SectionLabel border>Quan tri</SectionLabel>
                        <MenuItem icon="⚙️" label="Admin dashboard"    sub="Nguoi dung, shop, don hang" path="/admin" onClick={close} />
                      </div>
                    )}

                    {/* Shipper */}
                    {currentRole === 'shipper' && (
                      <div>
                        <SectionLabel>Tai khoan</SectionLabel>
                        <MenuItem icon="👤" label="Ho so ca nhan"       path="/profile"   onClick={close} />
                        <MenuItem icon="📦" label="Don hang cua toi"    path="/orders"    onClick={close} />
                        <MenuItem icon="🎁" label="Trung tam voucher"   path="/vouchers"  onClick={close} />
                        <SectionLabel border>Giao hang</SectionLabel>
                        <MenuItem icon="🚚" label="Quan ly giao hang"  sub="Don hang, lo trinh, thu nhap" path="/shipper" onClick={close} />
                      </div>
                    )}

                    {/* Employee */}
                    {currentRole === 'employee' && (
                      <div>
                        <SectionLabel>Tai khoan</SectionLabel>
                        <MenuItem icon="👤" label="Ho so ca nhan"           path="/profile"           onClick={close} />
                        <SectionLabel border>Nhan vien</SectionLabel>
                        <MenuItem icon="🏠" label="Tong quan"              sub="Dashboard cua ban"    path="/employee"          onClick={close} />
                        <MenuItem icon="📋" label="Don hang"                                          path="/employee/orders"   onClick={close} />
                        <MenuItem icon="📦" label="San pham"                                          path="/employee/products" onClick={close} />
                        <MenuItem icon="💬" label="Tin nhan"                                          path="/employee/messages" onClick={close} />
                      </div>
                    )}

                    {/* Customer / default */}
                    {(currentRole === 'user' || !currentRole) && (
                      <div>
                        <SectionLabel>Tai khoan</SectionLabel>
                        <MenuItem icon="👤" label="Ho so ca nhan"       path="/profile"     onClick={close} />
                        <MenuItem icon="📦" label="Don hang cua toi"    path="/orders"      onClick={close} />
                        <MenuItem icon="💬" label="Tin nhan"            path="/chat"        onClick={close} />
                        <MenuItem icon="🎁" label="Trung tam voucher"   path="/vouchers"    onClick={close} />
                        <MenuItem icon="⚠️" label="Khieu nai cua toi"  path="/complaints"  onClick={close} />
                      </div>
                    )}

                    {/* Logout */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
                      <button onClick={handleLogout}
                        style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 14, color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#FFF1F1')}
                        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}>
                        <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>🚪</span>
                        Dang xuat
                      </button>
                    </div>

                  </div>
                )}
              </div>

            </div>
          ) : (
            <React.Fragment>
              <Link to="/login" style={{ color: 'var(--text-on-topbar)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Dang nhap</Link>
              <Link to="/register" style={{ background: 'var(--cta-bg)', color: 'var(--cta-text)', padding: '7px 16px', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Dang ky</Link>
            </React.Fragment>
          )}
        </div>

      </div>
    </nav>
  )
}

export default Navbar
