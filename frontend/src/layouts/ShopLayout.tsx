/**
 * ShopLayout — dùng cho tất cả trang của Shop Owner / Shop Employee
 */
import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Navbar from '../components/common/Navbar'
import { shopService } from '../services/shopService'

const SHOP_NAV = [
  { icon: '\u{1F4CA}', label: 'Tổng quan',    path: '/shop' },
  { icon: '\u{1F3F7}️', label: 'Sản phẩm',   path: '/shop/products' },
  { icon: '\u{1F4E6}', label: 'Đơn hàng',    path: '/shop/orders' },
  { icon: '\u{1F4AC}', label: 'Tin nhắn',    path: '/shop/chat' },
  { icon: '\u{1F465}', label: 'Nhân viên',   path: '/shop/employees' },
  { icon: '\u{1F4C8}', label: 'Thống kê',    path: '/shop/analytics' },
  { icon: '\u{1F3AB}', label: 'Voucher',     path: '/shop/vouchers' },
  { icon: '\u{1F3C6}', label: 'Đấu giá QC',  path: '/shop/auction' },
  { icon: '⚠️', label: 'Khiếu nại',   path: '/complaints' },
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
        <div style={{
          background: 'linear-gradient(135deg, #14532D 0%, #16A34A 100%)',
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{'\u{1F3EA}'}</div>
            <div>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 13, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shopName}</p>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>Quản lý shop</p>
            </div>
          </div>
        </div>
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
                color: isActive ? 'var(--role-active-color, #16A34A)' : 'var(--text-secondary)',
                background: isActive ? 'var(--role-active-bg, rgba(22,163,74,0.1))' : 'transparent',
                borderRight: isActive ? '3px solid var(--role-active-border, #22C55E)' : '3px solid transparent',
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

const ShopLayout: React.FC<Props> = ({ children }) => {
  useEffect(() => {
    document.documentElement.setAttribute('data-role', 'shop')
    return () => document.documentElement.removeAttribute('data-role')
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <Navbar />
      <div className="container" style={{ display: 'flex', gap: 24, paddingTop: 24, paddingBottom: 48, flex: 1 }}>
        <ShopSidebar />
        <main style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default ShopLayout
