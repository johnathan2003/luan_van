import React from 'react'
import { Link } from 'react-router-dom'
import LoginForm from '../components/auth/LoginForm'

const Login: React.FC = () => (
  <>
    <LoginForm />
    <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--gray-500)' }}>
      Chưa có tài khoản?{' '}
      <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Đăng ký ngay</Link>
    </div>
  </>
)

export default Login
