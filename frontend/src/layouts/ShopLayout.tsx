/**
 * ShopLayout — dùng cho tất cả trang của Shop Owner / Shop Employee
 * Gồm: Navbar + Sidebar quản lý shop + nội dung
 *
 * Dùng cho:
 *  - /shop (Dashboard)
 *  - /shop/products
 *  - /shop/orders
 *  - /shop/employees
 *  - /shop/analytics
 *  - /shop/vouchers
 */
import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Navbar from '../components/common/Navbar'
import { shopService } from '../services/shopService'

const SHOP_NAV = [
  { icon: '📊', label: 'Tổng quan',    path: '/shop' },
  { icon: '🏷️', label: 'Sản phẩm',   path: '/shop/products' },
  { icon: '📦', label: 'Đơn hàng',    path: '/shop/orders' },
  { icon: '👥', label: 'Nhân viên',   path: '/shop/employees' },
  { icon: '📈', label: 'Thống kê',    path: '/shop/analytics' },
  { icon: '🎫', label: 'Voucher',     path: '/shop/vouchers' },
]

const ShopSidebar: React.FC = () => {
  const [shopName, setShopName] = useState('Shop của tôi')

  useEffect(() => {
    shopService.getMyShop()
      .then(r => setShopName(r.data.shop_name))
      .catch(() => {})
  }, [])

  return (
    <aside style={{ width: 220, flexShrink: 0 }}>
      <div className="card" style={{ overflow: 'hidden', position: 'sticky', top: 80 }}>
        {/* Shop header */}
        <div style={{
          background: 'linear-gradient(135deg, #14532D 0%, #16A34A 100%)',

          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏪</div>
            <div>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 13, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shopName}</p>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>Quản lý shop</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px 0' }}>
          {SHOP_NAV.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/shop'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#16A34A' : 'var(--gray-700)',
                background: isActive ? '#F0FDF4' : 'transparent',
                borderRight: isActive ? '3px solid #22C55E' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              })}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}

interface Props { children: React.ReactNode }

const ShopLayout: React.FC<Props> = ({ children }) => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--gray-50)' }}>
    <Navbar />
    <div className="container" style={{ display: 'flex', gap: 24, paddingTop: 24, paddingBottom: 48, flex: 1 }}>
      <ShopSidebar />
      <main style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  </div>
)

export default ShopLayout
