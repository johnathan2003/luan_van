import React, { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../../components/common/Navbar'
import Sidebar from '../../components/common/Sidebar'
import { shipmentService } from '../../services/shipmentService'
import { toast } from 'react-toastify'

const SHIPPER_MENU = [
  { icon: '📊', label: 'Tổng quan', path: '/shipper' },
  { icon: '📦', label: 'Đơn giao hàng', path: '/shipper/deliveries' },
]

const ShipperOverview: React.FC = () => {
  const [rating, setRating] = useState<any>(null)
  const [status, setStatus] = useState('offline')

  useEffect(() => {
    shipmentService.getMyRating().then(r => { setRating(r.data); setStatus('available') }).catch(() => {})
  }, [])

  const handleStatus = async (s: string) => {
    try { await shipmentService.updateStatus(s); setStatus(s); toast.success('Đã cập nhật trạng thái') }
    catch { toast.error('Lỗi') }
  }

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 24 }}>Tổng quan shipper</h2>
      {rating && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Đánh giá', value: `⭐ ${rating.rating}`, color: 'var(--warning)' },
            { label: 'Đã giao', value: rating.total_deliveries, color: 'var(--primary)' },
            { label: 'Trạng thái', value: status === 'available' ? '🟢 Sẵn sàng' : status === 'on_delivery' ? '🟡 Đang giao' : '🔴 Offline', color: 'var(--gray-700)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 8 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 14, fontSize: 15 }}>Cập nhật trạng thái</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          {[['available', '🟢 Sẵn sàng nhận đơn'], ['offline', '🔴 Offline']].map(([s, label]) => (
            <button key={s} onClick={() => handleStatus(s)} className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-outline'}`}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

const ShipperDashboard: React.FC = () => {
  const location = useLocation()
  const isRoot = location.pathname === '/shipper'

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="container" style={{ paddingTop: 28, paddingBottom: 40, display: 'flex', gap: 24 }}>
        <Sidebar items={SHIPPER_MENU} title="Shipper" />
        <main style={{ flex: 1, minWidth: 0 }}>
          {isRoot ? <ShipperOverview /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}

export default ShipperDashboard
