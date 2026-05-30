import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { register } from '../../store/slices/authSlice'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

const RegisterForm: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading } = useAppSelector(s => s.auth)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', confirm: '' })
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Mật khẩu không khớp'); return }
    if (form.password.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự'); return }
    setError('')
    const result = await dispatch(register({ email: form.email, password: form.password, full_name: form.full_name }))
    if (register.fulfilled.match(result)) {
      toast.success('Đăng ký thành công! Vui lòng đăng nhập.')
      navigate('/login')
    } else {
      toast.error(result.payload as string || 'Đăng ký thất bại')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className="input-label">Họ và tên</label>
        <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nguyễn Văn A" required />
      </div>
      <div>
        <label className="input-label">Email</label>
        <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="example@email.com" required />
      </div>
      <div>
        <label className="input-label">Mật khẩu</label>
        <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Tối thiểu 6 ký tự" required />
      </div>
      <div>
        <label className="input-label">Xác nhận mật khẩu</label>
        <input className={`input${error ? ' error' : ''}`} type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Nhập lại mật khẩu" required />
        {error && <p className="input-error">{error}</p>}
      </div>
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: 4 }}>
        {loading ? 'Đang đăng ký...' : 'Tạo tài khoản'}
      </button>
    </form>
  )
}

export default RegisterForm
