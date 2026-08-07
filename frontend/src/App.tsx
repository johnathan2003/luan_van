import React, { useEffect, useState, createContext, useContext } from 'react'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import Router from './Router.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import ThemeProvider from './components/common/ThemeProvider'
import ThemeToggle from './components/common/ThemeToggle'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { checkAuth } from './store/slices/authSlice'
import { setEventsEmail } from './utils/eventsStore'
import { setBannerDraftEmail, clearBase64Drafts } from './utils/bannerDraftStore'
import { shopService } from './services/shopService'
import { getToken } from './utils/localStorage'

/* ─── Context trạng thái đình chỉ ──────────────────────────────────────────── */
export interface ShopStatusCtx { isSuspended: boolean; suspendedReason: string }
export const ShopStatusContext = createContext<ShopStatusCtx>({ isSuspended: false, suspendedReason: '' })
export const useShopStatus = () => useContext(ShopStatusContext)

/* ─── Modal đình chỉ shop ──────────────────────────────────────────────────── */
const SuspendedModal: React.FC<{ reason: string; onClose: () => void; onContact: () => void }> = ({ reason, onClose, onContact }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 99999,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(6px)',
  }}>
    <style>{`
      @keyframes suspendPop {
        from { opacity: 0; transform: scale(0.82) translateY(24px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
    `}</style>
    <div style={{
      background: 'white', borderRadius: 22, padding: '44px 40px',
      maxWidth: 480, width: '90%', textAlign: 'center',
      boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
      animation: 'suspendPop 0.45s cubic-bezier(0.22,1,0.36,1) both',
    }}>
      {/* Icon */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'linear-gradient(135deg, #DC2626, #ef4444)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 22px', fontSize: 36,
        boxShadow: '0 10px 28px rgba(220,38,38,0.4)',
      }}>
        ⛔
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
        Cửa hàng đã bị đình chỉ
      </h2>
      <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 22, lineHeight: 1.6 }}>
        Tài khoản shop của bạn đã bị Admin đình chỉ hoạt động.<br />
        Bạn không thể thực hiện giao dịch trong thời gian này.
      </p>

      {/* Reason box */}
      <div style={{
        background: '#FEF2F2', border: '1.5px solid #FECACA',
        borderRadius: 12, padding: '14px 18px',
        marginBottom: 26, textAlign: 'left',
      }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          📋 Lý do đình chỉ
        </p>
        <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.7 }}>
          {reason || 'Không có lý do cụ thể được cung cấp.'}
        </p>
      </div>

      <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 22 }}>
        Vui lòng liên hệ bộ phận hỗ trợ để được giải quyết khiếu nại.
      </p>

      <button
        onClick={onContact}
        style={{
          display: 'block', width: '100%', padding: '13px',
          background: 'linear-gradient(135deg, #7C3AED, #a855f7)',
          color: 'white', borderRadius: 12, fontWeight: 700,
          fontSize: 15, border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 18px rgba(124,58,237,0.38)',
          marginBottom: 10,
        }}
      >
        📋 Gửi khiếu nại
      </button>

      <button
        onClick={onClose}
        style={{
          width: '100%', padding: '12px',
          background: 'transparent', border: '1.5px solid #E5E7EB',
          borderRadius: 12, fontWeight: 600, fontSize: 14,
          color: '#6B7280', cursor: 'pointer',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#D1D5DB' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E7EB' }}
      >
        Đã rõ
      </button>
    </div>
  </div>
)

/* ─── App content ───────────────────────────────────────────────────────────── */
const AppContent: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector(s => s.auth.user)
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated)
  const [suspendedReason, setSuspendedReason] = useState<string | null>(null)
  const [modalDismissed, setModalDismissed] = useState(false)

  useEffect(() => {
    // Chỉ gọi /users/me nếu thực sự có token — gọi vô điều kiện khi không có
    // token sẽ luôn bị backend trả 403 "Not authenticated", và nếu interceptor
    // vì đó mà redirect về /login (window.location.href = full reload) thì App
    // mount lại → useEffect này chạy lại → lặp vô hạn, gây cảm giác
    // "hệ thống load liên tục" khi chưa đăng nhập / token đã mất.
    if (getToken()) dispatch(checkAuth())
    clearBase64Drafts()
  }, [dispatch])

  useEffect(() => {
    const email = user?.email ?? ''
    setEventsEmail(email)
    setBannerDraftEmail(email)
  }, [user?.email])

  // Kiểm tra trạng thái đình chỉ ngay khi đăng nhập (chỉ với role shop/employee)
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSuspendedReason(null)
      return
    }
    const roles: string[] = (user.roles ?? []).map((r: any) => r.role_name ?? r)
    const role = user.current_role ?? roles[0]
    if (role === 'shop' || role === 'employee') {
      shopService.getMyShop()
        .then(r => {
          if (r.data?.status === 'suspended') {
            setSuspendedReason(r.data.suspended_reason ?? '')
            setModalDismissed(false)
          } else {
            setSuspendedReason(null)
          }
        })
        .catch(() => setSuspendedReason(null))
    } else {
      setSuspendedReason(null)
    }
  }, [isAuthenticated, user?.user_id])

  const shopStatus: ShopStatusCtx = {
    isSuspended: suspendedReason !== null,
    suspendedReason: suspendedReason ?? '',
  }

  return (
    <ShopStatusContext.Provider value={shopStatus}>
      {suspendedReason !== null && !modalDismissed && (
        <SuspendedModal
          reason={suspendedReason}
          onClose={() => setModalDismissed(true)}
          onContact={() => { setModalDismissed(true); navigate('/shop/complaints') }}
        />
      )}
      <Router />
      <ThemeToggle />
    </ShopStatusContext.Provider>
  )
}

/* ─── Root ──────────────────────────────────────────────────────────────────── */
const App: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  </ErrorBoundary>
)

export default App
