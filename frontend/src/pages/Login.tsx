import React from 'react'
import { Link } from 'react-router-dom'
import LoginForm from '../components/auth/LoginForm'

const Login: React.FC = () => (
  <div style={{ minHeight: '100vh', background: 'var(--gray-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🛒</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>ShopVN</h1>
        <p style={{ color: 'var(--gray-500)', marginTop: 4 }}>Chào mừng bạn quay trở lại!</p>
      </div>
      <div className="card" style={{ padding: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 24, textAlign: 'center' }}>Đăng nhập</h2>
        <LoginForm />
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--gray-500)' }}>
          Chưa có tài khoản?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Đăng ký ngay</Link>
        </div>
      </div>
    </div>
  </div>
)

export default Login
