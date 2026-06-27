import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { login } from '../../store/slices/authSlice'
import { useNavigate, Link } from 'react-router-dom'
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

const LoginForm: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading } = useAppSelector(s => s.auth)
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [validErr, setValidErr] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidErr('')

    if (DANGEROUS.test(form.email) || DANGEROUS.test(form.password)) {
      setValidErr('Không được dùng ký tự: < > ? / : ; " \' | \\')
      return
    }

    const result = await dispatch(login(form))
    if (login.fulfilled.match(result)) {
      const user: any = result.payload?.user
      const roles: string[] = (user?.roles ?? []).map((r: any) => r.role_name)
      const primary = user?.current_role ?? roles[0]

      toast.success('Đăng nhập thành công!')

      if (primary === 'superadmin' || primary === 'admin') navigate('/admin')
      else if (primary === 'shop')     navigate('/shop')
      else if (primary === 'shipper')  navigate('/shipper')
      else if (primary === 'employee') navigate('/employee')
      else navigate('/')
    } else {
      const errMsg = result.payload as string || 'Đăng nhập thất bại'
      setValidErr(errMsg)
      console.error('[LOGIN ERROR]', result)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label className="input-label">Email / Tên đăng nhập</label>
        <input
          className="input"
          type="text"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="email@example.com hoặc admin"
          required
          autoComplete="username"
        />
      </div>

      <div>
        <label className="input-label">Mật khẩu</label>
        <div style={{ position: 'relative' }}>
          <input
            className="input"
            type={showPw ? 'text' : 'password'}
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="••••••"
            required
            autoComplete="current-password"
            style={{ paddingRight: 40 }}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--gray-400)', padding: 0, display: 'flex', alignItems: 'center',
            }}
            tabIndex={-1}
            title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            <EyeIcon open={showPw} />
          </button>
        </div>
      </div>

      {validErr && <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{validErr}</p>}

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
