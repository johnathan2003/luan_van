import React from 'react'
import { Link } from 'react-router-dom'

const Footer: React.FC = () => (
  <footer style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', padding: '40px 0 24px', borderTop: '1px solid var(--border-subtle)' }}>
    <div className="container">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, marginBottom: 32 }}>
        <div>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 12, fontSize: 18 }}>🛒 BuyZo</h3>
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>Nền tảng thương mại điện tử kết nối người mua, người bán và shipper.</p>
        </div>
        <div>
          <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 12 }}>Mua sắm</h4>
          {[['/', 'Trang chủ'], ['/products', 'Sản phẩm'], ['/cart', 'Giỏ hàng'], ['/orders', 'Đơn hàng']].map(([to, label]) => (
            <Link key={to} to={to} style={{ display: 'block', fontSize: 14, marginBottom: 8, color: 'var(--text-muted)' }}>{label}</Link>
          ))}
        </div>
        <div>
          <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 12 }}>Bán hàng</h4>
          {[['/register-shop', 'Đăng ký shop'], ['/shop', 'Quản lý shop'], ['/register-shipper', 'Trở thành shipper']].map(([to, label]) => (
            <Link key={to} to={to} style={{ display: 'block', fontSize: 14, marginBottom: 8, color: 'var(--text-muted)' }}>{label}</Link>
          ))}
        </div>
        <div>
          <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 12 }}>Hỗ trợ</h4>
          <p style={{ fontSize: 14, marginBottom: 8 }}>📧 support@shopvn.com</p>
          <p style={{ fontSize: 14, marginBottom: 8 }}>☎️ 1800-1234</p>
          <p style={{ fontSize: 14 }}>🕐 8:00 – 22:00 mỗi ngày</p>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        © {new Date().getFullYear()} BuyZo. Bảo lưu mọi quyền.
      </div>
    </div>
  </footer>
)

export default Footer
