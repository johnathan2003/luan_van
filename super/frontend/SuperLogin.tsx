/**
 * super/frontend/SuperLogin.tsx
 * ------------------------------
 * Trang đăng nhập superadmin.
 * Gọi POST /super/auth/login — so sánh plaintext, KHÔNG dùng bcrypt.
 * Token lưu riêng ở 'super_token', không ảnh hưởng session người dùng thường.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import superApi from './superApi'

const SuperLogin: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await superApi.post('/auth/login', { username, password })
      localStorage.setItem('super_token', res.data.access_token)
      navigate('/super')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        width: 380,
        background: '#13131a',
        border: '1px solid #2a1a1a',
        borderRadius: 16,
        padding: '40px 36px',
        boxShadow: '0 0 60px rgba(220,38,38,0.08)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #7f1d1d, #dc2626)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 24,
          }}>⚡</div>
          <h1 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 800, margin: 0 }}>
            Superadmin Access
          </h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 6 }}>
            Nằm ngoài khuôn khổ hệ thống · Không ghi log
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              USERNAME
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="off"
              style={{
                width: '100%', padding: '11px 14px', boxSizing: 'border-box',
                background: '#1e1e2e', border: '1px solid #2d2d3d', borderRadius: 8,
                color: '#f1f5f9', fontSize: 14, outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="off"
              style={{
                width: '100%', padding: '11px 14px', boxSizing: 'border-box',
                background: '#1e1e2e', border: '1px solid #2d2d3d', borderRadius: 8,
                color: '#f1f5f9', fontSize: 14, outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', background: '#2d1010', border: '1px solid #7f1d1d',
              borderRadius: 8, color: '#fca5a5', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: '12px',
              background: loading ? '#4b1414' : 'linear-gradient(135deg, #991b1b, #dc2626)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
            }}
          >
            {loading ? 'Đang xác thực...' : '⚡ Truy cập'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#334155', fontSize: 11, marginTop: 24, marginBottom: 0 }}>
          Phiên làm việc không được ghi nhận vào hệ thống
        </p>
      </div>
    </div>
  )
}

export default SuperLogin
