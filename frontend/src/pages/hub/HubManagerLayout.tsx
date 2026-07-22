/**
 * HubManagerLayout — Portal kho tổng (cấp 1)
 * Dành cho warehouse_hub_manager
 */
import React, { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '../../store/store'
import { logout } from '../../store/slices/authSlice'

const NAV = [
  { path: '/hub',           icon: '📊', label: 'Tổng quan',    desc: 'Dashboard kho tổng' },
  { path: '/hub/districts', icon: '🏘️', label: 'Kho quận',     desc: 'Quản lý kho cấp 2' },
  { path: '/hub/bundles',   icon: '📦', label: 'Bundle LT',    desc: 'Mã kiện liên tỉnh LT-...' },
  { path: '/hub/shipments', icon: '🚛', label: 'Đơn liên tỉnh',desc: 'Hàng vào/ra thành phố' },
]

const C = { dark: '#0F172A', mid: '#1E293B', teal: '#0D9488', tealLight: '#5EEAD4', muted: '#94A3B8', border: 'rgba(255,255,255,0.08)' }

const HubManagerLayout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const user     = useSelector((s: RootState) => s.auth.user)
  const [collapsed, setCollapsed] = useState(false)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const activeNav = NAV.find(n =>
    n.path === '/hub' ? location.pathname === '/hub' : location.pathname.startsWith(n.path)
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 70 : 256,
        background: `linear-gradient(180deg, ${C.dark} 0%, ${C.mid} 100%)`,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
        transition: 'width 0.2s ease',
        boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
      }}>

        <Link to="/" style={{
          padding: collapsed ? '16px 0' : '18px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          alignItems: collapsed ? 'center' : 'flex-start',
          textDecoration: 'none', gap: 4,
        }}>
          <span style={{ fontWeight: 800, fontSize: collapsed ? 20 : 22, color: '#F43F5E', letterSpacing: -0.5 }}>BuyZo</span>
          {!collapsed && <span style={{ color: C.muted, fontSize: 10 }}>← Về trang chủ</span>}
        </Link>

        {!collapsed && (
          <div style={{ margin: '16px 16px 8px', background: 'rgba(13,148,136,0.15)', border: '1px solid rgba(13,148,136,0.3)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🏢</span>
              <div>
                <p style={{ color: C.tealLight, fontWeight: 800, fontSize: 13, margin: 0 }}>Kho Tổng</p>
                <p style={{ color: C.muted, fontSize: 11, margin: 0 }}>Cấp 1 · City Hub</p>
              </div>
            </div>
          </div>
        )}

        <nav style={{ flex: 1, padding: '8px 10px' }}>
          {NAV.map(item => {
            const active = item.path === '/hub'
              ? location.pathname === '/hub'
              : location.pathname.startsWith(item.path)
            return (
              <Link key={item.path} to={item.path} style={{ textDecoration: 'none', display: 'block', marginBottom: 4 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: collapsed ? '12px 0' : '12px 14px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 12,
                  background: active ? 'rgba(13,148,136,0.2)' : 'transparent',
                  border: active ? '1px solid rgba(13,148,136,0.4)' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed && (
                    <div>
                      <p style={{ color: active ? C.tealLight : '#CBD5E1', fontWeight: active ? 700 : 500, fontSize: 13, margin: 0 }}>{item.label}</p>
                      <p style={{ color: '#475569', fontSize: 11, margin: 0 }}>{item.desc}</p>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '12px 10px', borderTop: `1px solid ${C.border}` }}>
          {!collapsed && user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(13,148,136,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ color: '#F1F5F9', fontWeight: 600, fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(user as any).full_name || 'Hub Manager'}</p>
                <p style={{ color: '#64748B', fontSize: 11, margin: 0 }}>Kho tổng cấp 1</p>
              </div>
            </div>
          )}
          <button onClick={() => setCollapsed(v => !v)}
            style={{ width: '100%', padding: '9px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10, color: C.muted, cursor: 'pointer', fontSize: collapsed ? 18 : 13, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8, marginBottom: 6 }}>
            <span>{collapsed ? '▶' : '◀'}</span>
            {!collapsed && 'Thu gọn'}
          </button>
          <button onClick={() => { dispatch(logout()); navigate('/login') }}
            style={{ width: '100%', padding: '9px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#FCA5A5', cursor: 'pointer', fontSize: collapsed ? 18 : 13, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8 }}>
            <span>🚪</span>
            {!collapsed && 'Đăng xuất'}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ marginLeft: collapsed ? 70 : 256, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', transition: 'margin 0.2s ease' }}>
        <header style={{
          background: '#fff', borderBottom: '1px solid #E2E8F0',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 100,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 22 }}>{activeNav?.icon ?? '🏢'}</span>
            <div>
              <p style={{ fontWeight: 800, color: '#0F172A', fontSize: 15, margin: 0 }}>{activeNav?.label ?? 'Kho Tổng'}</p>
              <p style={{ color: '#64748B', fontSize: 11, margin: 0 }}>{activeNav?.desc ?? 'City Hub · Cấp 1'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '6px 14px' }}>
              <p style={{ fontWeight: 700, color: '#15803D', fontSize: 12, margin: 0 }}>🏢 Kho Tổng · Cấp 1</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: 700, color: '#0F172A', fontSize: 14, margin: 0 }}>{time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
              <p style={{ color: '#64748B', fontSize: 11, margin: 0 }}>{time.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}</p>
            </div>
          </div>
        </header>
        <main style={{ flex: 1, padding: 28 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default HubManagerLayout
