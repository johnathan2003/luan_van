/**
 * AdminLayout — dùng cho tất cả trang Admin
 * Gồm: Navbar + Sidebar quản trị + nội dung trang
 *
 * Dùng cho:
 *  - /admin (Dashboard)
 *  - /admin/users
 *  - /admin/approvals
 *  - /admin/disputes
 *  - /admin/system-employees
 *  - /admin/logs
 */
import React from 'react'
import { NavLink } from 'react-router-dom'
import Navbar from '../components/common/Navbar'

interface NavItem {
  icon: string
  label: string
  path: string
  badge?: number
}

const ADMIN_NAV: NavItem[] = [
  { icon: '📊', label: 'Tổng quan',         path: '/admin' },
  { icon: '👥', label: 'Người dùng',        path: '/admin/users' },
  { icon: '✅', label: 'Phê duyệt',         path: '/admin/approvals' },
  { icon: '🗑️', label: 'Xóa sản phẩm',     path: '/admin/deletion-requests' },
  { icon: '⚖️', label: 'Khiếu nại',        path: '/admin/disputes' },
  { icon: '🧑‍💼', label: 'Nhân viên HT',   path: '/admin/system-employees' },
  { icon: '📋', label: 'Nhật ký',           path: '/admin/logs' },
]

const AdminSidebar: React.FC = () => (
  <aside style={{ width: 220, flexShrink: 0 }}>
    <div className="card" style={{ overflow: 'hidden', position: 'sticky', top: 80 }}>
      {/* Header sidebar */}
        <div style={{
        background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)',
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚙️</div>
          <div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Quản trị viên</p>
            <p style={{ color: '#94a3b8', fontSize: 11 }}>Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ padding: '8px 0' }}>
        {ADMIN_NAV.map(item => (
              <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
                color: isActive ? '#3B82F6' : 'var(--gray-700)',
              background: isActive ? '#EFF6FF' : 'transparent',
              borderRight: isActive ? '3px solid #3B82F6' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            })}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span style={{ background: 'var(--error)', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '12px 20px', borderTop: '1px solid #DBEAFE', fontSize: 11, color: '#64748b' }}>
        Hệ thống quản trị v1.0
      </div>
    </div>
  </aside>
)

interface Props { children: React.ReactNode }

const AdminLayout: React.FC<Props> = ({ children }) => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--gray-50)' }}>
    <Navbar />
    <div className="container" style={{ display: 'flex', gap: 24, paddingTop: 24, paddingBottom: 48, flex: 1 }}>
      <AdminSidebar />
      <main style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  </div>
)

export default AdminLayout
