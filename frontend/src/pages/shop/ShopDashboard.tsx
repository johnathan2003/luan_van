import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import Navbar from '../../components/common/Navbar'
import Sidebar from '../../components/common/Sidebar'

const SHOP_MENU = [
  { icon: '📊', label: 'Tổng quan', path: '/shop' },
  { icon: '🏷️', label: 'Sản phẩm', path: '/shop/products' },
  { icon: '📦', label: 'Đơn hàng', path: '/shop/orders' },
  { icon: '👥', label: 'Nhân viên', path: '/shop/employees' },
  { icon: '📈', label: 'Thống kê', path: '/shop/analytics' },
  { icon: '🎫', label: 'Voucher', path: '/shop/vouchers' },
]

const ShopDashboard: React.FC = () => (
  <div className="page-wrapper">
    <Navbar />
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40, display: 'flex', gap: 24 }}>
      <Sidebar items={SHOP_MENU} title="Quản lý shop" />
      <main style={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  </div>
)

export default ShopDashboard
