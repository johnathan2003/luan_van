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
  const [success, setSuccess] = useState(false)

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
      setSuccess(true)
    } else {
      toast.error(result.payload as string || 'Đăng ký thất bại')
    }
  }

  return (
    <>
      <style>{`
        @keyframes fieldIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes successPop {
          0%   { opacity: 0; transform: scale(0.6); }
          70%  { transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes successFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .auth-field {
          animation: fieldIn 0.4s cubic-bezier(0.22,1,0.36,1) both;
        }
        .auth-submit {
          transition: transform 0.15s, box-shadow 0.15s !important;
        }
        .auth-submit:hover:not(:disabled) {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(124,58,237,0.35) !important;
        }
        .auth-submit:active:not(:disabled) {
          transform: scale(0.98) !important;
        }
        .success-check {
          animation: successPop 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        .success-text {
          animation: successFadeUp 0.4s ease both;
          animation-delay: 0.2s;
        }
        .success-btn {
          animation: successFadeUp 0.4s ease both;
          animation-delay: 0.35s;
          transition: transform 0.15s, box-shadow 0.15s !important;
        }
        .success-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(124,58,237,0.35) !important;
        }
      `}</style>

      {success ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0 4px' }}>
          {/* Tick icon */}
          <div className="success-check" style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #7C3AED, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>

          {/* Message */}
          <div className="success-text" style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: 18, color: 'var(--gray-900)', marginBottom: 6 }}>
              Đăng ký thành công! 🎉
            </p>
            <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              Tài khoản đã được tạo. Đăng nhập để bắt đầu mua sắm.
            </p>
          </div>

          {/* Login button */}
          <button
            type="button"
            className="btn btn-primary btn-lg w-full success-btn"
            onClick={() => navigate('/login')}
            style={{ marginTop: 4 }}
          >
            Đăng nhập ngay
          </button>
        </div>
      ) : (
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div className="auth-field" style={{ animationDelay: '0.05s' }}>
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

        <div className="auth-field" style={{ animationDelay: '0.11s' }}>
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

        <div className="auth-field" style={{ animationDelay: '0.17s' }}>
          <label className="input-label">Mật khẩu</label>
          <PasswordInput
            value={form.password}
            onChange={v => setForm(f => ({ ...f, password: v }))}
            placeholder="Tối thiểu 3 ký tự"
            autoComplete="new-password"
          />
        </div>

        <div className="auth-field" style={{ animationDelay: '0.23s' }}>
          <label className="input-label">Xác nhận mật khẩu</label>
          <PasswordInput
            value={form.confirm}
            onChange={v => setForm(f => ({ ...f, confirm: v }))}
            placeholder="Nhập lại mật khẩu"
            autoComplete="new-password"
          />
          {error && <p className="input-error" style={{ marginTop: 4 }}>{error}</p>}
        </div>

        <div className="auth-field" style={{ animationDelay: '0.29s', marginTop: 4 }}>
          <button
            type="submit"
            className="btn btn-primary btn-lg w-full auth-submit"
            disabled={loading}
          >
            {loading ? 'Đang đăng ký...' : 'Tạo tài khoản'}
          </button>
        </div>

      </form>
      )}
    </>
  )
}

export default RegisterForm
