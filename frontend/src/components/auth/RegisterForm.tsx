import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { register } from '../../store/slices/authSlice'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

const DANGEROUS = /[<>?/:;"'|\\]/

const EyeIcon = ({ open }: { open: boolean }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

const PasswordInput = ({
  value, onChange, placeholder, autoComplete
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) => {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        autoComplete={autoComplete}
        style={{ paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--gray-400)', padding: 0, display: 'flex', alignItems: 'center',
        }}
        tabIndex={-1}
        title={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  )
}

const RegisterForm: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading } = useAppSelector(s => s.auth)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', confirm: '' })
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (DANGEROUS.test(form.email) || DANGEROUS.test(form.password) || DANGEROUS.test(form.full_name)) {
      setError('Không được dùng ký tự: < > ? / : ; " \' | \\')
      return
    }
    if (form.password !== form.confirm) { setError('Mật khẩu không khớp'); return }
    if (form.password.length < 3) { setError('Mật khẩu tối thiểu 3 ký tự'); return }

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
        <input
          className="input"
          type="text"
          value={form.full_name}
          onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
          placeholder="Nguyễn Văn A"
          required
        />
      </div>

      <div>
        <label className="input-label">Email / Tên đăng nhập</label>
        <input
          className="input"
          type="text"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="email@example.com hoặc tên tùy chọn"
          required
          autoComplete="username"
        />
      </div>

      <div>
        <label className="input-label">Mật khẩu</label>
        <PasswordInput
          value={form.password}
          onChange={v => setForm(f => ({ ...f, password: v }))}
          placeholder="Tối thiểu 3 ký tự"
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="input-label">Xác nhận mật khẩu</label>
        <PasswordInput
          value={form.confirm}
          onChange={v => setForm(f => ({ ...f, confirm: v }))}
          placeholder="Nhập lại mật khẩu"
          autoComplete="new-password"
        />
        {error && <p className="input-error" style={{ marginTop: 4 }}>{error}</p>}
      </div>

      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: 4 }}>
        {loading ? 'Đang đăng ký...' : 'Tạo tài khoản'}
      </button>
    </form>
  )
}

export default RegisterForm
