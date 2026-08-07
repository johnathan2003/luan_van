/**
 * AuthLayout — dùng cho trang Login, Register, ForgotPassword
 * Centered card, không có Navbar/Footer
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  children: React.ReactNode
  title: string
  subtitle?: string
  maxWidth?: number
  bgImage?: string
  align?: 'left' | 'center'
  backTo?: string
  backColor?: string
}

const AuthLayout: React.FC<Props> = ({ children, title, maxWidth = 420, bgImage = '/background.png', align = 'left', backTo, backColor = '#15803D' }) => {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  return (
    <>
      <style>{`
        @keyframes authFadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes authFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .auth-bg {
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: 16px 6vw;
          animation: authFadeIn 0.6s ease both;
        }
      `}</style>

      <div className="auth-bg" style={{
        background: `url(${bgImage}) center/cover no-repeat #2D1B8E`,
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        position: 'relative',
      }}>
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            style={{
              position: 'absolute', top: 20, left: 20,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10,
              background: backColor,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${backColor}`,
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.18s',
              zIndex: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            ← Trang chủ
          </button>
        )}
        <div style={{
          width: '100%',
          maxWidth,
          animation: visible ? 'authFadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both' : 'none',
        }}>
          {/* Card — glassmorphism */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            padding: 36,
            borderRadius: 20,
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.5)',
            transition: 'box-shadow 0.3s ease',
          }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.22)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)')}
          >
            <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 24, textAlign: 'center', color: 'var(--gray-900)' }}>
              {title}
            </h2>
            {children}
          </div>

          {/* Footer note */}
          <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 20, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
            © {new Date().getFullYear()} ShopVN. Mua sắm an toàn, giao hàng nhanh chóng.
          </p>
        </div>
      </div>
    </>
  )
}

export default AuthLayout
