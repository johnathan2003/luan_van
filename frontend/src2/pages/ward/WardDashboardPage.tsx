/**
 * WardDashboardPage — Tổng quan kho phường cấp 3
 */
import React, { useEffect, useState } from 'react'
import API from '../../services/api'

const C = { navy: '#0F172A', orange: '#EA580C', light: '#FED7AA', tint: '#FFF7ED', gray: '#64748B', success: '#16A34A', warning: '#D97706' }

const WardDashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get('/api/v1/warehouses/ward/dashboard')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>
  if (!data?.warehouse) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>
      <p style={{ fontSize: 32, marginBottom: 8 }}>⚠️</p>
      <p>Tài khoản chưa được gán kho phường. Liên hệ quản lý kho quận.</p>
    </div>
  )

  const { warehouse: wh, stats } = data

  const KPIs = [
    { label: 'Tổng shipper', value: stats.total_shippers, icon: '🛵', color: C.orange },
    { label: 'Shipper đang hoạt động', value: stats.active_shippers, icon: '✅', color: C.success },
    { label: 'Đơn chờ giao', value: stats.pending_orders, icon: '📦', color: C.warning },
    { label: 'Shipper / đơn', value: stats.active_shippers > 0 && stats.pending_orders > 0
      ? (stats.pending_orders / stats.active_shippers).toFixed(1) : '—', icon: '⚡', color: '#7C3AED' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>📊 Tổng quan — Kho Phường</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
          🏠 {wh.name} · 📍 {wh.ward || wh.district || wh.province} · Cấp 3 (Last Mile)
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {KPIs.map(k => (
          <div key={k.label} className="card" style={{ padding: '16px 18px', borderLeft: `3px solid ${k.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{k.label}</p>
            <p style={{ fontSize: 28, margin: '6px 0 2px' }}>{k.icon}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Cảnh báo khi chưa có shipper */}
      {stats.total_shippers === 0 && (
        <div style={{ padding: 16, background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <p style={{ fontWeight: 700, color: '#991B1B', fontSize: 14, margin: 0 }}>Kho chưa có shipper!</p>
            <p style={{ color: '#B91C1C', fontSize: 13, margin: '4px 0 0' }}>
              Mỗi kho phường cần ít nhất 1 shipper để giao hàng. Vào <strong>Quản lý Shipper</strong> để thêm.
            </p>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>🏠 Thông tin kho phường</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Tên kho',        value: wh.name },
            { label: 'Phường/xã',      value: wh.ward || '—' },
            { label: 'Quận/huyện',     value: wh.district || '—' },
            { label: 'Tỉnh/thành phố', value: wh.province },
            { label: 'Cấp kho',        value: 'Cấp 3 · Last Mile' },
            { label: 'Trạng thái',     value: wh.is_active ? '✅ Đang hoạt động' : '⛔ Tạm dừng' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 20, background: C.tint, border: `1px solid ${C.light}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12 }}>📋 Trách nhiệm kho phường (Cấp 3)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: C.gray }}>
          {[
            '📥 Nhận kiện hàng từ kho quận theo địa chỉ phường',
            '🛵 Là nơi shipper lấy hàng mỗi ca giao',
            '📦 Gán đơn hàng cho shipper phù hợp',
            '🔄 Xử lý đơn giao thất bại / hoàn trả',
            '👥 Thêm/xóa/điều chỉnh trạng thái shipper',
            '📊 Theo dõi hiệu suất giao hàng',
          ].map(item => (
            <div key={item}>{item}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default WardDashboardPage
