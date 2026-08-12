import React from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDate, formatOrderId } from '../../utils/formatters'

interface Props { deliveries: any[]; onPickup?: (id: number) => void; onDeliver?: (id: number) => void }

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ nhận', color: 'var(--warning)' },
  assigned: { label: 'Đã giao việc', color: 'var(--info)' },
  picked_up: { label: 'Đã lấy hàng', color: 'var(--primary)' },
  in_transit: { label: 'Đang giao', color: 'var(--secondary)' },
  delivered: { label: 'Đã giao', color: 'var(--success)' },
  failed: { label: 'Thất bại', color: 'var(--error)' },
}

const DeliveryList: React.FC<Props> = ({ deliveries, onPickup, onDeliver }) => {
  const navigate = useNavigate()
  if (!deliveries.length) return <p style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>Không có đơn giao hàng nào</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {deliveries.map(d => {
        const s = STATUS_MAP[d.status] || { label: d.status, color: 'var(--gray-500)' }
        return (
          <div key={d.shipment_id} className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Đơn {formatOrderId(d.order_id)}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: s.color, background: s.color + '18', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>{s.label}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 }}>{formatDate(d.created_at)}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigate(`/shipper/tracking/${d.shipment_id}`)} className="btn btn-outline btn-sm">Xem bản đồ</button>
              {d.status === 'assigned' && onPickup && (
                <button onClick={() => onPickup(d.shipment_id)} className="btn btn-primary btn-sm">Đã lấy hàng</button>
              )}
              {(d.status === 'picked_up' || d.status === 'in_transit') && onDeliver && (
                <button onClick={() => onDeliver(d.shipment_id)} className="btn btn-primary btn-sm">Xác nhận đã giao</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default DeliveryList
