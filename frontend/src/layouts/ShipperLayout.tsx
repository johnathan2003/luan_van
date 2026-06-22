/**
 * ShipperLayout — dùng cho tất cả trang của Shipper
 * Gồm: Navbar + Sidebar shipper + nội dung + status badge
 *
 * Dùng cho:
 *  - /shipper (Dashboard)
 *  - /shipper/deliveries
 *  - /shipper/tracking/:id
 */
import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../store/store'
import Navbar from '../components/common/Navbar'
import { shipmentService } from '../services/shipmentService'

const SHIPPER_NAV = [
  { icon: '🏠', label: 'Tổng quan',       path: '/shipper' },
  { icon: '📦', label: 'Đơn giao hàng',  path: '/shipper/deliveries' },
  { icon: '💰', label: 'Thu nhập',        path: '/shipper/earnings' },
  { icon: '🏦', label: 'Rút tiền',        path: '/shipper/withdrawal' },
  { icon: '⚠️', label: 'Sự cố & Vi phạm',path: '/shipper/incidents' },
  { icon: '🎁', label: 'Phúc lợi',        path: '/shipper/benefits' },
  { icon: '🚩', label: 'Khiếu nại',       path: '/complaints' },
]

const STATUS_COLORS: Record<string, string> = {
  available:   '#22c55e',
  on_delivery: '#f59e0b',
  offline:     '#9ca3af',
}
const STATUS_LABELS: Record<string, string> = {
  available:   '🟢 Sẵn sàng',
  on_delivery: '🟡 Đang giao',
  offline:     '🔴 Offline',
}

const ShipperSidebar: React.FC = () => {
  const [info, setInfo] = useState<any>(null)
  const [status, setStatus] = useState('offline')

  useEffect(() => {
    shipmentService.getMyRating()
      .then(r => { setInfo(r.data); setStatus('available') })
      .catch(() => {})
  }, [])

  const updateStatus = async (s: string) => {
    try { await shipmentService.updateStatus(s); setStatus(s) } catch {}
  }

  return (
    <aside style={{ width: 220, flexShrink: 0 }}>
      <div className="card" style={{ overflow: 'hidden', position: 'sticky', top: 80 }}>
        {/* Shipper header */}
        <div style={{
          background: 'linear-gradient(135deg, #78350F 0%, #D97706 100%)',
          padding: '16px 20px',
        }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🚚</div>
            <div>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>Shipper</p>
              <p style={{ color: STATUS_COLORS[status], fontSize: 11, fontWeight: 600 }}>{STATUS_LABELS[status]}</p>
            </div>
          </div>
        </div>

        {/* Stats mini */}
        {info && (
          <div style={{ display: 'flex', padding: '10px 20px', gap: 16, borderBottom: '1px solid var(--gray-100)' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--warning)' }}>⭐ {info.rating}</p>
              <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>Đánh giá</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>{info.total_deliveries}</p>
              <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>Đã giao</p>
            </div>
          </div>
        )}

        {/* Status toggle */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--gray-100)' }}>
          <p style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 6, fontWeight: 600 }}>TRẠNG THÁI</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {['available', 'offline'].map(s => (
              <button key={s}
                onClick={() => updateStatus(s)}
                style={{
                  flex: 1, padding: '5px 0', border: 'none', borderRadius: 'var(--radius)',
                  cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  background: status === s ? STATUS_COLORS[s] : 'var(--gray-100)',
                  color: status === s ? 'white' : 'var(--gray-500)',
                  transition: 'all 0.15s',
                }}
              >
                {s === 'available' ? 'Sẵn sàng' : 'Offline'}
              </button>
            ))}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px 0' }}>
          {SHIPPER_NAV.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/shipper'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--role-active-color, #D97706)' : 'var(--text-secondary)',
                background: isActive ? 'var(--role-active-bg, rgba(217,119,6,0.1))' : 'transparent',
                borderRight: isActive ? '3px solid var(--role-active-border, #F59E0B)' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              })}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}

const BannedBanner: React.FC = () => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <div style={{
      background: 'white', borderRadius: 20, padding: '40px 48px',
      maxWidth: 480, width: '90%', textAlign: 'center',
      boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🚫</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#DC2626', margin: '0 0 10px' }}>
        Tài khoản bị khóa
      </h2>
      <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: '0 0 24px' }}>
        Tài khoản Shipper của bạn đã bị khóa do vi phạm chính sách dịch vụ.
        Vui lòng liên hệ bộ phận hỗ trợ để biết thêm thông tin.
      </p>
      <div style={{
        background: '#FEF2F2', border: '1px solid #FECACA',
        borderRadius: 10, padding: '12px 16px', marginBottom: 24,
        fontSize: 13, color: '#DC2626', fontWeight: 500,
      }}>
        📧 support@buyzo.vn &nbsp;|&nbsp; 📞 1800-0000
      </div>
      <a href="/" style={{
        display: 'inline-block', padding: '10px 28px',
        background: '#DC2626', color: 'white', borderRadius: 8,
        fontWeight: 600, fontSize: 14, textDecoration: 'none',
      }}>
        Về trang chủ
      </a>
    </div>
  </div>
)

interface Props { children: React.ReactNode }

const ShipperLayout: React.FC<Props> = ({ children }) => {
  const user = useSelector((s: RootState) => s.auth.user)
  const isBanned = user?.status === 'banned'

  useEffect(() => {
    document.documentElement.setAttribute('data-role', 'shipper')
    return () => document.documentElement.removeAttribute('data-role')
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      {isBanned && <BannedBanner />}
      <Navbar />
      <div className="container" style={{ display: 'flex', gap: 24, paddingTop: 24, paddingBottom: 48, flex: 1 }}>
        <ShipperSidebar />
        <main style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default ShipperLayout
