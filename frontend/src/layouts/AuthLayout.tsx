/**
 * AuthLayout — dùng cho trang Login, Register, ForgotPassword
 * Centered card, không có Navbar/Footer
 */
import React from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: React.ReactNode
  title: string
  subtitle?: string
}

const AuthLayout: React.FC<Props> = ({ children, title, subtitle }) => (
  <div style={{
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #fff7f5 0%, #fef3f0 50%, #fff0ed 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  }}>
    <div style={{ width: '100%', maxWidth: 440 }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🛒</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--primary)', letterSpacing: -1 }}>ShopVN</h1>
        </Link>
        {subtitle && <p style={{ color: 'var(--gray-500)', marginTop: 6, fontSize: 14 }}>{subtitle}</p>}
      </div>

      {/* Card */}
      <div className="card" style={{ padding: 36 }}>
        <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 24, textAlign: 'center', color: 'var(--gray-900)' }}>
          {title}
        </h2>
        {children}
      </div>

      {/* Footer note */}
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-400)', marginTop: 20 }}>
        © {new Date().getFullYear()} ShopVN. Mua sắm an toàn, giao hàng nhanh chóng.
      </p>
    </div>
  </div>
)

export default AuthLayout
