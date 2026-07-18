import React, { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

const NAV = [
  { path: '/warehouse',            icon: '📊', label: 'Tổng quan' },
  { path: '/warehouse/shipments',  icon: '📋', label: 'Tất cả đơn' },
  { path: '/warehouse/incoming',   icon: '🚛', label: 'Đơn đến kho' },
  { path: '/warehouse/transfers',  icon: '🔄', label: 'Chuyến vận chuyển' },
]

const C = {
  navy: '#1E3A5F',
  blue: '#1D4ED8',
  teal: '#0D9488',
  gray: '#64748B',
  bg: '#F0F9FF',
}

const WarehouseManagerLayout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: 'Inter,system-ui,sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 240 : 64,
        background: C.navy,
        transition: 'width 0.2s',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>🏭</span>
          {sidebarOpen && (
            <div>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 14, margin: 0 }}>Quản lý Kho</p>
              <p style={{ color: '#94A3B8', fontSize: 11, margin: 0 }}>Warehouse Manager</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV.map(item => {
            const active = location.pathname === item.path || (item.path !== '/warehouse' && location.pathname.startsWith(item.path))
            return (
              <Link key={item.path} to={item.path} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', margin: '2px 8px', borderRadius: 10,
                  background: active ? 'rgba(13,148,136,0.25)' : 'transparent',
                  borderLeft: active ? '3px solid ' + C.teal : '3px solid transparent',
                  transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 20, minWidth: 24, textAlign: 'center' }}>{item.icon}</span>
                  {sidebarOpen && <span style={{ color: active ? '#fff' : '#94A3B8', fontSize: 14, fontWeight: active ? 700 : 400 }}>{item.label}</span>}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => setSidebarOpen(v => !v)} style={{
            width: '100%', padding: '10px 16px', background: 'transparent', border: 'none',
            borderRadius: 8, color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 14,
          }}>
            <span style={{ fontSize: 18 }}>{sidebarOpen ? '◀' : '▶'}</span>
            {sidebarOpen && 'Thu gọn'}
          </button>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '10px 16px', background: 'rgba(239,68,68,0.15)', border: 'none',
            borderRadius: 8, color: '#FCA5A5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 14, marginTop: 4,
          }}>
            <span style={{ fontSize: 18 }}>🚪</span>
            {sidebarOpen && 'Đăng xuất'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: sidebarOpen ? 240 : 64, flex: 1, transition: 'margin 0.2s', minHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  )
}

export default WarehouseManagerLayout
