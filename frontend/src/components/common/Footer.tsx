import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const PURPLE = '#6D28D9'
const roleGradient: Record<string, string> = {
  admin:   `linear-gradient(to right, ${PURPLE} 0%, #1D4ED8 100%)`,
  shop:    `linear-gradient(to right, ${PURPLE} 0%, #16A34A 100%)`,
  shipper: `linear-gradient(to right, ${PURPLE} 0%, #D97706 100%)`,
}

const Footer: React.FC = () => {
  const { isAuthenticated, currentRole } = useAuth()
  const [open, setOpen] = useState(false)

  const bg = (isAuthenticated && currentRole && roleGradient[currentRole])
    ? roleGradient[currentRole]
    : 'var(--topbar-gradient, var(--bg-topbar))'

  return (
    <footer style={{ background: bg, color: 'rgba(255,255,255,0.85)', transition: 'background 0.25s ease' }}>
      {/* Toggle bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 0',
          cursor: 'pointer',
          gap: 8,
          fontSize: 13,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.75)',
          userSelect: 'none',
        }}
        onClick={() => setOpen(o => !o)}
      >
        <span>🛒 BuyZo</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>{open ? 'Ẩn thông tin' : 'Thông tin'}</span>
        <span style={{
          display: 'inline-block',
          transition: 'transform 0.3s cubic-bezier(0.76,0,0.24,1)',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          fontSize: 12,
        }}>▲</span>
      </div>

      {/* Collapsible content */}
      <div style={{
        maxHeight: open ? 400 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.4s cubic-bezier(0.76,0,0.24,1)',
      }}>
        <div className="container" style={{ paddingTop: 8, paddingBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 28, marginBottom: 24 }}>
            <div>
              <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 10, fontSize: 16 }}>🛒 BuyZo</h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.7)' }}>
                Nền tảng thương mại điện tử kết nối người mua, người bán và shipper.
              </p>
            </div>
            <div>
              <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: 10, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mua sắm</h4>
              {([['/', 'Trang chủ'], ['/products', 'Sản phẩm'], ['/cart', 'Giỏ hàng'], ['/orders', 'Đơn hàng']] as [string, string][]).map(([to, label]) => (
                <Link key={to} to={to} style={{ display: 'block', fontSize: 13, marginBottom: 7, color: 'rgba(255,255,255,0.7)' }}>{label}</Link>
              ))}
            </div>
            <div>
              <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: 10, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bán hàng</h4>
              {([[ '/register-shop', 'Đăng ký shop'], ['/shop', 'Quản lý shop'], ['/register-shipper', 'Trở thành shipper']] as [string, string][]).map(([to, label]) => (
                <Link key={to} to={to} style={{ display: 'block', fontSize: 13, marginBottom: 7, color: 'rgba(255,255,255,0.7)' }}>{label}</Link>
              ))}
            </div>
            <div>
              <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: 10, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hỗ trợ</h4>
              <p style={{ fontSize: 13, marginBottom: 7, color: 'rgba(255,255,255,0.7)' }}>📧 support@buyzo.com</p>
              <p style={{ fontSize: 13, marginBottom: 7, color: 'rgba(255,255,255,0.7)' }}>☎️ 1800-1234</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>🕐 8:00 – 22:00 mỗi ngày</p>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 16, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            © {new Date().getFullYear()} BuyZo. Bảo lưu mọi quyền.
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
