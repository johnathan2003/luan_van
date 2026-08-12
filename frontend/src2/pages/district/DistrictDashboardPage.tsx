/**
 * DistrictDashboardPage — Tổng quan kho quận cấp 2
 */
import React, { useEffect, useState } from 'react'
import API from '../../services/api'

const C = { navy: '#0F172A', purple: '#7C3AED', light: '#EDE9FE', tint: '#F5F3FF', gray: '#64748B', success: '#16A34A', warning: '#D97706' }

const DistrictDashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get('/api/v1/warehouses/district/dashboard')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>
  if (!data?.warehouse) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>
      <p style={{ fontSize: 32, marginBottom: 8 }}>⚠️</p>
      <p>Tài khoản chưa được gán kho. Liên hệ quản lý kho tổng.</p>
    </div>
  )

  const { warehouse: wh, stats } = data

  const KPIs = [
    { label: 'Kho phường hoạt động',   value: `${stats.active_wards}/${stats.total_wards}`, icon: '🏠', color: C.purple },
    { label: 'Đơn chờ phân xuống phường', value: stats.pending_dispatch, icon: '📦', color: C.warning },
    { label: 'Tỷ lệ kho hoạt động', value: stats.total_wards > 0 ? `${Math.round(stats.active_wards / stats.total_wards * 100)}%` : '—', icon: '📊', color: C.success },
    { label: 'Quận/huyện', value: wh.district || '—', icon: '📍', color: '#0D9488' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>📊 Tổng quan — Kho Quận</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
          🏘️ {wh.name} · 📍 {wh.district || wh.province} · Cấp 2 (District Hub)
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {KPIs.map(k => (
          <div key={k.label} className="card" style={{ padding: '16px 18px', borderLeft: `3px solid ${k.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{k.label}</p>
            <p style={{ fontSize: 28, margin: '6px 0 2px', fontWeight: 800 }}>{k.icon}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>🏘️ Thông tin kho quận</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Tên kho',        value: wh.name },
            { label: 'Quận/huyện',     value: wh.district || '—' },
            { label: 'Tỉnh/thành phố', value: wh.province },
            { label: 'Địa chỉ',        value: wh.address || '—' },
            { label: 'Cấp kho',        value: 'Cấp 2 · District Hub' },
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
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12 }}>📋 Trách nhiệm kho quận (Cấp 2)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: C.gray }}>
          {[
            '📥 Nhận lô hàng từ kho tổng đã phân loại theo quận',
            '🏠 Chia nhỏ theo phường → đẩy xuống kho cấp 3',
            '🔄 Gom đơn hoàn trả từ kho phường → trả lên kho tổng',
            '⚡ Điều phối khi kho phường quá tải',
            '👤 Bổ nhiệm quản lý kho cấp 3',
            '📊 Xem báo cáo giao hàng theo từng phường',
          ].map(item => (
            <div key={item}>{item}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DistrictDashboardPage
