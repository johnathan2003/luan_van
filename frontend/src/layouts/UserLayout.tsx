/**
 * UserLayout — dùng cho trang của Người mua (buyer/user role)
 * Cart, Checkout, Orders, Profile, Product detail
 * Gồm: Navbar (có giỏ hàng, notif) + content + Footer
 */
import React from 'react'
import Navbar from '../components/common/Navbar'
import Footer from '../components/common/Footer'

interface Props {
  children: React.ReactNode
  /** Tên breadcrumb phụ */
  subtitle?: string
}

const UserLayout: React.FC<Props> = ({ children, subtitle }) => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <Navbar />
    {/* Thanh breadcrumb nhỏ (tuỳ chọn) */}
    {subtitle && (
      <div style={{
        background: 'white',
        borderBottom: '1px solid var(--gray-100)',
        padding: '8px 0',
        fontSize: 13,
        color: 'var(--gray-500)',
      }}>
        <div className="container">{subtitle}</div>
      </div>
    )}
    <main style={{ flex: 1, paddingTop: 32, paddingBottom: 48 }}>
      <div className="container">
        {children}
      </div>
    </main>
    <Footer />
  </div>
)

export default UserLayout
