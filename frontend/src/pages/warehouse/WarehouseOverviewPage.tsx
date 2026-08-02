import React, { useEffect, useState } from 'react'
import { warehouseService } from '../../services/warehouseService'

const C = { navy: '#1E3A5F', teal: '#0D9488', amber: '#D97706', purple: '#7C3AED', green: '#16A34A', red: '#DC2626', gray: '#64748B' }

const StatCard: React.FC<{ icon: string; label: string; value: number | string; color: string; bg: string }> = ({ icon, label, value, color, bg }) => (
  <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 52, height: 52, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{icon}</div>
    <div>
      <p style={{ color: C.gray, fontSize: 13, margin: 0 }}>{label}</p>
      <p style={{ color, fontWeight: 800, fontSize: 28, margin: '2px 0 0' }}>{value}</p>
    </div>
  </div>
)

const WarehouseOverviewPage: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    warehouseService.getDashboard()
      .then((r: any) => setData(r.data))
      .catch(() => {
        // Quản lý tổng không gắn 1 kho cụ thể — không có dữ liệu mẫu giả định 1 kho nào
        setData({ warehouse: null, stats: {} })
      })
      .finally(() => setLoading(false))
  }, [])

  const stats = data?.stats ?? {}
  const warehouse = data?.warehouse

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 32 }}>🏭</span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>
              {warehouse ? warehouse.name : 'Tổng quan Kho'}
            </h1>
            {warehouse && <p style={{ color: C.gray, fontSize: 13, margin: 0 }}>📍 {warehouse.province}</p>}
          </div>
        </div>
        <p style={{ color: C.gray, fontSize: 14, margin: 0 }}>Quản lý tất cả đơn hàng và luồng vận chuyển qua kho</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.gray }}>⏳ Đang tải...</div>
      ) : (
        <>
          {/* Stat Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <StatCard icon="📦" label="Tổng đơn"     value={stats.total ?? 0}        color={C.navy}   bg="#EFF6FF" />
            <StatCard icon="⏳" label="Chờ xử lý"   value={stats.pending ?? 0}       color={C.amber}  bg="#FEF3C7" />
            <StatCard icon="🚛" label="Đang vận chuyển" value={stats.in_transit ?? 0} color={C.purple} bg="#EDE9FE" />
            <StatCard icon="🏭" label="Tại kho"      value={stats.at_warehouse ?? 0} color={C.teal}   bg="#CCFBF1" />
            <StatCard icon="✅" label="Đã giao"      value={stats.delivered ?? 0}    color={C.green}  bg="#DCFCE7" />
            <StatCard icon="❌" label="Thất bại"     value={stats.failed ?? 0}       color={C.red}    bg="#FEE2E2" />
          </div>

          {/* Đơn đến kho highlight */}
          {(stats.incoming_to_my_warehouse ?? 0) > 0 && (
            <div style={{ background: 'linear-gradient(135deg,#0D9488,#0F766E)', borderRadius: 16, padding: '20px 24px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 36 }}>🚛</span>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>{stats.incoming_to_my_warehouse} đơn liên tỉnh đang đến kho</p>
                  <p style={{ fontSize: 13, opacity: 0.85, margin: '4px 0 0' }}>Cần xác nhận hàng đến để shipper khu vực có thể nhận</p>
                </div>
              </div>
              <a href="/warehouse/incoming" style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '10px 20px', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                Xem ngay →
              </a>
            </div>
          )}

          {/* Mô tả luồng vận chuyển */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontWeight: 800, color: C.navy, marginBottom: 20, fontSize: 16 }}>🗺️ Luồng vận chuyển</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {[
                { icon: '🏍️', title: 'Ship Khu Vực', color: '#0D9488', bg: '#CCFBF1',
                  desc: 'Thuộc kho cố định theo tỉnh/thành. Nhận đơn từ kho và giao đến tay khách trong khu vực.' },
                { icon: '🚚', title: 'Ship Liên Tỉnh', color: '#D97706', bg: '#FEF3C7',
                  desc: 'Xe tải vận chuyển hàng loạt giữa các kho tỉnh thành. Không giao đến khách trực tiếp.' },
              ].map(item => (
                <div key={item.title} style={{ background: item.bg, borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 28 }}>{item.icon}</span>
                    <span style={{ fontWeight: 800, color: item.color, fontSize: 15 }}>{item.title}</span>
                  </div>
                  <p style={{ color: '#374151', fontSize: 13, margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Flow arrow */}
            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['🏪 Shop', '→', '🚚 Liên tỉnh', '→', '🏭 Kho tỉnh', '→', '🏍️ Khu vực', '→', '🏠 Khách'].map((s, i) => (
                <span key={i} style={{ fontSize: s === '→' ? 20 : 14, color: s === '→' ? '#94A3B8' : C.navy, fontWeight: s !== '→' ? 600 : 400 }}>{s}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default WarehouseOverviewPage
