import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { login } from '../../store/slices/authSlice'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-toastify'

const LoginForm: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading } = useAppSelector(s => s.auth)
  const [form, setForm] = useState({ email: '', password: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await dispatch(login(form))
    if (login.fulfilled.match(result)) {
      toast.success('Đăng nhập thành công!')
      navigate('/')
    } else {
      toast.error(result.payload as string || 'Đăng nhập thất bại')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label className="input-label">Email</label>
        <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="example@email.com" required />
      </div>
      <div>
        <label className="input-label">Mật khẩu</label>
        <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••" required />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--primary)' }}>Quên mật khẩu?</Link>
      </div>
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
    </form>
  )
}

export default LoginForm
