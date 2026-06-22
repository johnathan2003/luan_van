/**
 * 🚚 Shipper Overview — trang tổng quan của shipper
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { shipmentService } from '../../services/shipmentService'

const C = {
  amber: '#D97706', gold: '#F59E0B', light: '#FEF3C7', tint: '#FFFBEB',
  navy: '#1E3A8A', blue: '#1D4ED8', gray: '#64748B',
  success: '#16A34A', error: '#DC2626',
}

const MOCK_INFO = { rating: '4.8', total_deliveries: 312 }

const MOCK_DELIVERIES = [
  { shipment_id: 1, order_id: 2031, status: 'in_transit',   delivery_location: '12 Lê Lợi, Q1, HCM',         created_at: '2026-06-14T09:30:00' },
  { shipment_id: 2, order_id: 2030, status: 'delivered',    delivery_location: '88 Nguyễn Huệ, Q1, HCM',     created_at: '2026-06-14T08:15:00' },
  { shipment_id: 3, order_id: 2028, status: 'delivered',    delivery_location: '5 Phạm Ngũ Lão, Q1, HCM',    created_at: '2026-06-13T16:00:00' },
  { shipment_id: 4, order_id: 2025, status: 'pending',      delivery_location: '100 Trần Hưng Đạo, Q5, HCM', created_at: '2026-06-13T10:45:00' },
  { shipment_id: 5, order_id: 2022, status: 'delivered',    delivery_location: '32 Võ Thị Sáu, Q3, HCM',     created_at: '2026-06-12T14:20:00' },
]

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Chờ lấy',   color: C.blue,    bg: '#DBEAFE' },
  in_transit: { label: 'Đang giao', color: C.amber,   bg: C.light   },
  delivered:  { label: 'Đã giao',   color: C.success, bg: '#DCFCE7' },
  failed:     { label: 'Thất bại',  color: C.error,   bg: '#FEE2E2' },
}

const ShipperOverviewPage: React.FC = () => {
  const [info, setInfo]             = useState<any>(MOCK_INFO)
  const [deliveries, setDeliveries] = useState<any[]>(MOCK_DELIVERIES)

  useEffect(() => {
    Promise.all([
      shipmentService.getMyRating(),
      shipmentService.getMyDeliveries({ limit: 5 }),
    ]).then(([r, d]) => {
      if (r.data) setInfo(r.data)
      const list = d.data?.deliveries || d.data
      if (Array.isArray(list) && list.length > 0) setDeliveries(list)
    }).catch(() => {/* keep mock */})
  }, [])

  const todayDone    = deliveries.filter(d => d.status === 'delivered').length
  const todayPending = deliveries.filter(d => d.status === 'in_transit' || d.status === 'pending').length
  const todayIncome  = todayDone * 31000

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.amber, margin: 0 }}>🚚 Tổng quan</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 3 }}>Chào mừng bạn quay lại, hãy giao hàng an toàn!</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Đánh giá TB',      value: `⭐ ${info?.rating ?? '—'}`,                    color: C.gold    },
          { label: 'Tổng đã giao',     value: info?.total_deliveries ?? 0,                    color: C.blue    },
          { label: 'Hôm nay đã giao',  value: `${todayDone} đơn`,                             color: C.success },
          { label: 'Thu nhập hôm nay', value: `${todayIncome.toLocaleString('vi-VN')}₫`,     color: C.amber   },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 18px', borderLeft: `3px solid ${s.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
        {[
          { to: '/shipper/deliveries', icon: '📦', label: 'Đơn giao hàng',     desc: `${todayPending} đơn chờ giao`,  color: C.blue    },
          { to: '/shipper/earnings',   icon: '💰', label: 'Thu nhập',           desc: 'Xem chi tiết giao dịch',        color: C.amber   },
          { to: '/shipper/withdrawal', icon: '🏦', label: 'Rút tiền',           desc: 'Số dư: 875.000₫',              color: C.success },
          { to: '/shipper/benefits',   icon: '🎁', label: 'Phúc lợi & Thưởng', desc: 'Cấp độ: Vàng 🥇',              color: C.gold    },
        ].map(item => (
          <Link key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', gap: 14, alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {item.icon}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: item.color, margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{item.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Đơn gần đây */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.tint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: C.navy, margin: 0 }}>📦 Đơn giao gần đây</h3>
          <Link to="/shipper/deliveries" style={{ fontSize: 13, color: C.amber, fontWeight: 600, textDecoration: 'none' }}>Xem tất cả →</Link>
        </div>
        <div>
          {deliveries.map((d: any) => {
            const st = STATUS_STYLE[d.status] ?? STATUS_STYLE.pending
            return (
              <div key={d.shipment_id} style={{ padding: '14px 20px', borderBottom: `1px solid ${C.tint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: C.navy, margin: 0 }}>Đơn #{d.order_id}</p>
                  <p style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>📍 {d.delivery_location} · {d.created_at?.slice(11, 16)}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quy trình */}
      <div style={{ background: C.tint, border: `1px solid ${C.light}`, borderRadius: 14, padding: '18px 20px' }}>
        <h3 style={{ fontWeight: 700, fontSize: 14, color: C.amber, marginBottom: 10 }}>💡 Quy trình giao hàng</h3>
        {[
          ['1', 'Nhận đơn từ hệ thống phân công'],
          ['2', 'Đến shop lấy hàng → Quét QR xác nhận'],
          ['3', 'Giao đến địa chỉ người nhận'],
          ['4', 'Chụp ảnh người nhận → Xác nhận đã giao'],
          ['5', 'Thu tiền COD (nếu có) và chuyển về hệ thống'],
        ].map(([n, t]) => (
          <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.amber, color: 'white', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
            <p style={{ fontSize: 13, color: C.amber, margin: 0, fontWeight: 500 }}>{t}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ShipperOverviewPage
