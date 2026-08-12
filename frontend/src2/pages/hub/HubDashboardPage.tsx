/**
 * HubDashboardPage — Tổng quan kho tổng cấp 1
 */
import React, { useEffect, useState } from 'react'
import API from '../../services/api'

const C = { navy: '#0F172A', blue: '#0D9488', light: '#CCFBF1', tint: '#F0FDFA', gray: '#64748B', success: '#16A34A', warning: '#D97706' }
const fmt = (n: number) => n.toLocaleString('vi-VN')

const HubDashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get('/api/v1/warehouses/hub/dashboard')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>
  if (!data?.warehouse) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>
      <p style={{ fontSize: 32, marginBottom: 8 }}>⚠️</p>
      <p>Tài khoản chưa được gán kho. Liên hệ Admin.</p>
    </div>
  )

  const { warehouse: wh, stats } = data

  const KPIs = [
    { label: 'Kho quận hoạt động',   value: `${stats.active_districts}/${stats.total_districts}`, icon: '🏘️', color: C.blue },
    { label: 'Hàng liên tỉnh đến',   value: fmt(stats.incoming_inter_province), icon: '📥', color: '#7C3AED' },
    { label: 'Hàng liên tỉnh đi',    value: fmt(stats.outgoing_inter_province), icon: '📤', color: C.warning },
    { label: 'Tỷ lệ kho hoạt động',  value: stats.total_districts > 0 ? `${Math.round(stats.active_districts / stats.total_districts * 100)}%` : '—', icon: '📊', color: C.success },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>📊 Tổng quan — Kho Tổng</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
          🏢 {wh.name} · 📍 {wh.province} · Cấp 1 (City Hub)
        </p>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {KPIs.map(k => (
          <div key={k.label} className="card" style={{ padding: '16px 18px', borderLeft: `3px solid ${k.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{k.label}</p>
            <p style={{ fontSize: 28, margin: '6px 0 2px', fontWeight: 800 }}>{k.icon}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Thông tin kho */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>🏢 Thông tin kho tổng</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Tên kho',    value: wh.name },
            { label: 'Tỉnh/thành',value: wh.province },
            { label: 'Thành phố', value: wh.city === 'hanoi' ? 'Hà Nội' : 'TP. Hồ Chí Minh' },
            { label: 'Địa chỉ',   value: wh.address || '—' },
            { label: 'Cấp kho',   value: 'Cấp 1 · City Hub' },
            { label: 'Trạng thái',value: wh.is_active ? '✅ Đang hoạt động' : '⛔ Tạm dừng' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hướng dẫn */}
      <div className="card" style={{ padding: 20, background: C.tint, border: `1px solid ${C.light}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12 }}>📋 Trách nhiệm kho tổng (Cấp 1)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: C.gray }}>
          {[
            '🚛 Nhận hàng liên tỉnh từ các tỉnh/thành khác',
            '📦 Phân loại đơn theo quận/huyện → đẩy xuống kho cấp 2',
            '🏘️ Giám sát & kích hoạt/tạm dừng kho quận bên dưới',
            '📤 Gom hàng liên tỉnh từ nội thành → chuyển đi tỉnh khác',
            '📊 Xem báo cáo tổng hợp toàn thành phố',
            '👤 Bổ nhiệm quản lý kho cấp 2',
          ].map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HubDashboardPage
