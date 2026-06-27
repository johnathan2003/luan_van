/**
 * super/frontend/SuperLayout.tsx
 * --------------------------------
 * Layout tối cho khu vực superadmin.
 * Sidebar riêng, không dùng layout của hệ thống thường.
 */
import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/super',          label: 'Dashboard',   icon: '⚡' },
  { path: '/super/products', label: 'Sản phẩm',    icon: '📦' },
  { path: '/super/orders',   label: 'Đơn hàng',    icon: '🧾' },
  { path: '/super/users',    label: 'Người dùng',  icon: '👥' },
]

interface SuperLayoutProps {
  children: React.ReactNode
}

const SuperLayout: React.FC<SuperLayoutProps> = ({ children }) => {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('super_token')
    navigate('/super/login')
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#0a0a0f',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      color: '#f1f5f9',
    }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        background: '#13131a',
        borderRight: '1px solid #1e1e2e',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid #1e1e2e',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'linear-gradient(135deg, #7f1d1d, #dc2626)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>⚡</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#f1f5f9', lineHeight: 1.2 }}>SUPERADMIN</div>
              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>God Mode</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/super'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fca5a5' : '#94a3b8',
                background: isActive ? 'rgba(220,38,38,0.1)' : 'transparent',
                borderLeft: isActive ? '3px solid #dc2626' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'all 0.15s',
              })}
            >
              <span style={{ width: 18, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e2e' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '9px',
              background: 'transparent',
              border: '1px solid #2d1010',
              borderRadius: 7,
              color: '#ef4444', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ⏻ Thoát
          </button>
          <p style={{ textAlign: 'center', color: '#1e293b', fontSize: 10, marginTop: 10, marginBottom: 0 }}>
            Không ghi log
          </p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}

export default SuperLayout
