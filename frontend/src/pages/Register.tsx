import React from 'react'
import { Link } from 'react-router-dom'
import RegisterForm from '../components/auth/RegisterForm'

const Register: React.FC = () => (
  <>
    <RegisterForm />
    <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--gray-500)' }}>
      Đã có tài khoản?{' '}
      <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Đăng nhập</Link>
    </div>
  </>
)

export default Register
