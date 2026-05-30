/**
 * 🚚 Shipper Overview — trang tổng quan của shipper
 * Layout: ShipperLayout (do Router bọc ngoài)
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../../components/common/Loading'
import { shipmentService } from '../../services/shipmentService'

const ShipperOverviewPage: React.FC = () => {
  const [info, setInfo]         = useState<any>(null)
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      shipmentService.getMyRating(),
      shipmentService.getMyDeliveries({ limit: 5 }),
    ]).then(([r, d]) => {
      setInfo(r.data)
      setDeliveries(d.data.deliveries || [])
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 28 }}>Tổng quan giao hàng</h1>

      {/* Stats */}
      {info && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Đánh giá trung bình', value: `⭐ ${info.rating}`, color: 'var(--warning)' },
            { label: 'Tổng đơn đã giao',    value: info.total_deliveries, color: '#1e40af' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: 24, textAlign: 'center', borderTop: `4px solid ${s.color}` }}>
              <p style={{ fontSize: 36, fontWeight: 800, color: s.color, marginBottom: 6 }}>{s.value}</p>
              <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Đơn gần đây */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>📦 Đơn giao hàng gần đây</h3>
          <Link to="/shipper/deliveries" style={{ fontSize: 13, color: '#1e40af' }}>Xem tất cả</Link>
        </div>
        {deliveries.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>Chưa có đơn nào</p>
        ) : deliveries.map((d: any) => (
          <div key={d.shipment_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500 }}>Đơn #{d.order_id}</p>
              <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>{d.created_at?.slice(0, 16)}</p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: d.status === 'delivered' ? '#dcfce7' : '#fef9c3', color: d.status === 'delivered' ? '#16a34a' : '#ca8a04' }}>
              {d.status}
            </span>
          </div>
        ))}
      </div>

      {/* Hướng dẫn nhanh */}
      <div className="card" style={{ padding: 20, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e40af', marginBottom: 10 }}>💡 Quy trình giao hàng</h3>
        {[
          '1. Nhận đơn hàng từ hệ thống phân công',
          '2. Đến lấy hàng tại địa chỉ shop',
          '3. Nhấn "Đã lấy hàng" để bắt đầu giao',
          '4. Giao đến địa chỉ người nhận',
          '5. Nhấn "Xác nhận đã giao" để hoàn thành',
        ].map(s => <p key={s} style={{ fontSize: 13, color: '#1e40af', marginBottom: 4 }}>{s}</p>)}
      </div>
    </div>
  )
}

export default ShipperOverviewPage
