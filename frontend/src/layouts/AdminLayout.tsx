
/**
 * AdminLayout — dùng cho tất cả trang Admin
 * Sidebar 12 nhóm nghiệp vụ theo luận văn
 */
import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Navbar from '../components/common/Navbar'

interface NavItem {
  icon: string
  label: string
  path: string
}
interface NavGroup {
  group: string
  items: NavItem[]
}

const ADMIN_NAV: NavGroup[] = [
  {
    group: 'Tổng quan',
    items: [
      { icon: '📊', label: 'Tổng Quan Hệ Thống', path: '/admin' },
    ],
  },
  {
    group: 'Người dùng',
    items: [
      { icon: '👥', label: 'Danh Sách Người Dùng', path: '/admin/users' },
      { icon: '🔐', label: 'Phân quyền',            path: '/admin/users/roles' },
      { icon: '🧑‍💼', label: 'Nhân Viên Hệ Thống', path: '/admin/system-employees' },
    ],
  },
  {
    group: 'Cửa hàng',
    items: [
      { icon: '🏪', label: 'Danh Sách Shop',    path: '/admin/shops' },
      { icon: '✅', label: 'Duyệt Đăng Ký',    path: '/admin/approvals' },
    ],
  },
  {
    group: 'Sản phẩm',
    items: [
      { icon: '🏷️', label: 'Quản Lý Sản Phẩm',          path: '/admin/products' },
      { icon: '🗑️', label: 'Duyệt & Xử Lý Sản Phẩm',  path: '/admin/deletion-requests' },
    ],
  },
  {
    group: 'Đơn hàng',
    items: [
      { icon: '📦', label: 'Danh Sách Đơn Hàng', path: '/admin/orders' },
      { icon: '⚖️', label: 'Tranh Chấp',        path: '/admin/disputes' },
    ],
  },
  {
    group: 'Tài chính',
    items: [
      { icon: '💰', label: 'Doanh Thu Hệ Thống',     path: '/admin/finance' },
      { icon: '🏦', label: 'Ví & Nạp Tiền Shop',    path: '/admin/wallet' },
      { icon: '🎫', label: 'Mã Giảm Giá',       path: '/admin/vouchers' },
    ],
  },
  {
    group: 'Quảng Cáo & Nội Dung',
    items: [
      { icon: '🖼️', label: 'Banner Quảng Cáo',      path: '/admin/banners' },
      { icon: '🏆', label: 'Đấu Giá Quảng Cáo',     path: '/admin/auction' },
      { icon: '📷', label: 'Thư Viện Ảnh',           path: '/admin/images' },
      { icon: '📣', label: 'Thông Báo Hoạt Động',    path: '/admin/notifications' },
    ],
  },
  {
    group: 'Vận hành',
    items: [
      { icon: '🛵', label: 'Quản Lý Shipper',   path: '/admin/shippers' },
      { icon: '🏭', label: 'Quản Lý Kho',        path: '/admin/warehouse-hierarchy' },
      { icon: '🔑', label: 'Tài Khoản Kho (Cây)', path: '/admin/warehouse-account-tree' },
      { icon: '🚚', label: 'Cấu Hình Vận Chuyển',      path: '/admin/shipping-config' },
    ],
  },
  {
    group: 'Báo cáo & Log',
    items: [
      { icon: '📈', label: 'Báo Cáo',              path: '/admin/reports' },
      { icon: '💬', label: 'Phản Hồi Người Dùng', path: '/admin/feedback' },
      { icon: '📋', label: 'Nhật Ký Hệ Thống',    path: '/admin/logs' },
    ],
  },
]

const AdminSidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggle = (g: string) => setCollapsed(p => ({ ...p, [g]: !p[g] }))

  return (
    <aside style={{ width: 232, flexShrink: 0 }}>
      <div className="card" style={{ overflow: 'hidden', position: 'sticky', top: 80, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)', padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.18)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚙️</div>
            <div>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Quản trị viên</p>
              <p style={{ color: '#BFDBFE', fontSize: 11 }}>Admin Panel v1.0</p>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav style={{ padding: '8px 0' }}>
          {ADMIN_NAV.map(({ group, items }) => (
            <div key={group}>
              {/* Group header — click để collapse */}
              <button
                onClick={() => toggle(group)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 20px 4px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                }}
              >
                {group}
                <span style={{ fontSize: 10, transition: 'transform 0.15s', transform: collapsed[group] ? 'rotate(-90deg)' : '' }}>▾</span>
              </button>

              {/* Items */}
              {!collapsed[group] && items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 20px', fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--role-active-color, #1D4ED8)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--role-active-bg, rgba(29,78,216,0.1))' : 'transparent',
                    borderRight: isActive ? '3px solid var(--role-active-border, #3B82F6)' : '3px solid transparent',
                    textDecoration: 'none', transition: 'all 0.12s ease',
                  })}
                  onMouseEnter={e => { if (!(e.currentTarget as HTMLAnchorElement).className.includes('active')) (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-highlight)' }}
                  onMouseLeave={e => { if (!(e.currentTarget as HTMLAnchorElement).className.includes('active')) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                </NavLink>
              ))}

              <div style={{ height: 4 }} />
            </div>
          ))}
        </nav>

        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-muted)' }}>
          BuyZO Admin © 2025
        </div>
      </div>
    </aside>
  )
}

interface Props { children: React.ReactNode }

const AdminLayout: React.FC<Props> = ({ children }) => {
  useEffect(() => {
    document.documentElement.setAttribute('data-role', 'admin')
    return () => document.documentElement.removeAttribute('data-role')
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <Navbar />
      <div style={{ display: 'flex', gap: 24, flex: 1, width: '100%', maxWidth: 1400, margin: '0 auto', padding: '24px 32px 48px', alignItems: 'flex-start' }}>
        <AdminSidebar />
        <main style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}

