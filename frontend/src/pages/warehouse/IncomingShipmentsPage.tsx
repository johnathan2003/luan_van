import React, { useEffect, useState, useCallback } from 'react'
import { warehouseService } from '../../services/warehouseService'

const C = { navy: '#1E3A5F', teal: '#0D9488', amber: '#D97706', purple: '#7C3AED', green: '#16A34A', red: '#DC2626', gray: '#64748B' }

const formatCurrency = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v)

const MOCK_INCOMING = [
  { shipment_id: 2001, order_id: 6001, shipment_type: 'inter_province', status: 'in_transit', src_warehouse: 'Kho HCM', dest_warehouse: 'Kho Hà Nội', shipper_name: 'Nguyễn Văn Tải', pickup_location: 'TP.HCM - 45 Nguyễn Trãi', delivery_location: 'Kho Hà Nội', amount: 850000, recipient: 'Lê Thị Bình', phone: '0912345678', created_at: new Date(Date.now() - 7200000).toISOString() },
  { shipment_id: 2002, order_id: 6002, shipment_type: 'inter_province', status: 'assigned',   src_warehouse: 'Kho Đà Nẵng', dest_warehouse: 'Kho Hà Nội', shipper_name: 'Trần Văn Xe', pickup_location: 'Đà Nẵng - 77 Phan Chu Trinh', delivery_location: 'Kho Hà Nội', amount: 1200000, recipient: 'Phạm Văn Dũng', phone: '0987654321', created_at: new Date(Date.now() - 14400000).toISOString() },
  { shipment_id: 2003, order_id: 6003, shipment_type: 'inter_province', status: 'at_warehouse', src_warehouse: 'Kho Cần Thơ', dest_warehouse: 'Kho Hà Nội', shipper_name: 'Hoàng Tài Xế', pickup_location: 'Cần Thơ - 12 Hòa Bình', delivery_location: 'Kho Hà Nội', amount: 560000, recipient: 'Võ Thị Hoa', phone: '0901234567', created_at: new Date(Date.now() - 21600000).toISOString() },
  { shipment_id: 2004, order_id: 6004, shipment_type: 'inter_province', status: 'in_transit', src_warehouse: 'Kho HCM', dest_warehouse: 'Kho Hà Nội', shipper_name: 'Lý Văn Chở', pickup_location: 'TP.HCM - 99 Lê Văn Việt', delivery_location: 'Kho Hà Nội', amount: 2100000, recipient: 'Đặng Minh Quân', phone: '0969123456', created_at: new Date(Date.now() - 28800000).toISOString() },
]

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  assigned:     { label: '📌 Đã giao xe', color: '#1D4ED8', bg: '#DBEAFE' },
  in_transit:   { label: '🚛 Đang trên đường', color: C.amber,  bg: '#FEF3C7' },
  at_warehouse: { label: '🏭 Đã đến kho',     color: C.teal,   bg: '#CCFBF1' },
}

const IncomingShipmentsPage: React.FC = () => {
  const [items, setItems]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [markingId, setMarkingId] = useState<number | null>(null)
  const [page, setPage]   = useState(1)
  const [pages, setPages] = useState(1)
  const [toast, setToast] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    warehouseService.getIncoming({ page, limit: 20 })
      .then((r: any) => {
        setItems(r.data?.shipments ?? [])
        setPages(r.data?.pages ?? 1)
      })
      .catch(() => {
        setItems(MOCK_INCOMING)
        setPages(1)
      })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  const handleMarkArrived = async (shipmentId: number) => {
    setMarkingId(shipmentId)
    try {
      await warehouseService.markArrived(shipmentId)
      setToast('✅ Đã đánh dấu hàng đến kho!')
      load()
    } catch {
      // update local mock
      setItems(prev => prev.map(s => s.shipment_id === shipmentId ? { ...s, status: 'at_warehouse' } : s))
      setToast('✅ Đã đánh dấu hàng đến kho!')
    } finally {
      setMarkingId(null)
      setTimeout(() => setToast(''), 3000)
    }
  }

  const inTransit = items.filter(s => s.status === 'in_transit' || s.status === 'assigned')
  const arrived   = items.filter(s => s.status === 'at_warehouse')

  return (
    <div style={{ padding: 28 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: C.green, color: '#fff', borderRadius: 12, padding: '12px 20px', fontWeight: 700, fontSize: 14, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.navy, margin: 0 }}>🚛 Đơn liên tỉnh đến kho</h1>
        <p style={{ color: C.gray, fontSize: 13, margin: '4px 0 0' }}>
          Đơn hàng đang vận chuyển từ kho khác đến kho của bạn. Khi hàng đến nơi, hãy xác nhận để shipper khu vực có thể nhận và giao khách.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.gray }}>⏳ Đang tải...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.gray, background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0' }}>
          <p style={{ fontSize: 48, margin: 0 }}>🏭</p>
          <p style={{ fontWeight: 700, fontSize: 16, color: C.navy, margin: '12px 0 4px' }}>Không có đơn liên tỉnh nào đang đến</p>
          <p style={{ color: C.gray, fontSize: 13 }}>Kho hiện tại không có đơn liên tỉnh đang trên đường đến</p>
        </div>
      ) : (
        <>
          {/* In-transit section */}
          {inTransit.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.amber, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                🚛 Đang trên đường ({inTransit.length})
              </h2>
              <div style={{ display: 'grid', gap: 14 }}>
                {inTransit.map(s => (
                  <ShipmentCard key={s.shipment_id} shipment={s} onMarkArrived={handleMarkArrived} markingId={markingId} />
                ))}
              </div>
            </div>
          )}

          {/* Arrived section */}
          {arrived.length > 0 && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.teal, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                🏭 Đã đến kho — chờ shipper khu vực nhận ({arrived.length})
              </h2>
              <div style={{ display: 'grid', gap: 14 }}>
                {arrived.map(s => (
                  <ShipmentCard key={s.shipment_id} shipment={s} onMarkArrived={handleMarkArrived} markingId={markingId} />
                ))}
              </div>
            </div>
          )}

          {pages > 1 && (
            <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                ← Trước
              </button>
              <span style={{ padding: '8px 0', fontSize: 13, color: C.gray }}>Trang {page}/{pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                Tiếp →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const ShipmentCard: React.FC<{ shipment: any; onMarkArrived: (id: number) => void; markingId: number | null }> = ({ shipment: s, onMarkArrived, markingId }) => {
  const C = { navy: '#1E3A5F', teal: '#0D9488', amber: '#D97706', gray: '#64748B', green: '#16A34A' }
  const st = { assigned: { label: '📌 Đã giao xe', color: '#1D4ED8', bg: '#DBEAFE' }, in_transit: { label: '🚛 Đang trên đường', color: C.amber, bg: '#FEF3C7' }, at_warehouse: { label: '🏭 Đã đến kho', color: C.teal, bg: '#CCFBF1' } }[s.status] ?? { label: s.status, color: C.gray, bg: '#F1F5F9' }
  const isMarking = markingId === s.shipment_id
  const arrived = s.status === 'at_warehouse'

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '2px solid ' + (arrived ? '#99F6E4' : '#E2E8F0'), padding: 20, display: 'grid', gridTemplateColumns: '1fr auto', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontWeight: 800, color: C.navy, fontSize: 15 }}>🚚 Đơn #{s.shipment_id}</span>
          <span style={{ background: st.bg, color: st.color, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>{st.label}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: '#FEF9C3', borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, color: '#92400E', fontWeight: 700, margin: '0 0 4px' }}>📤 XUẤT PHÁT</p>
            <p style={{ fontSize: 13, color: C.navy, margin: 0, fontWeight: 600 }}>{s.src_warehouse ?? s.pickup_location}</p>
          </div>
          <div style={{ background: '#CCFBF1', borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, color: '#0F766E', fontWeight: 700, margin: '0 0 4px' }}>📥 ĐẾN KHO</p>
            <p style={{ fontSize: 13, color: C.navy, margin: 0, fontWeight: 600 }}>{s.dest_warehouse ?? s.delivery_location}</p>
          </div>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: C.gray }}>🚛 {s.shipper_name ?? 'Chưa có tài xế'}</span>
          <span style={{ fontSize: 13, color: C.gray }}>👤 {s.recipient} · {s.phone}</span>
          <span style={{ fontSize: 13, color: C.gray }}>⏰ {new Date(s.created_at).toLocaleString('vi-VN')}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        {s.amount && <span style={{ fontWeight: 800, color: C.teal, fontSize: 16 }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(s.amount)}
        </span>}
        {!arrived && (
          <button onClick={() => onMarkArrived(s.shipment_id)} disabled={isMarking}
            style={{ background: isMarking ? '#94A3B8' : C.teal, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', cursor: isMarking ? 'default' : 'pointer', fontWeight: 700, fontSize: 13, marginTop: 'auto' }}>
            {isMarking ? '⏳ Đang xử lý...' : '✅ Xác nhận đến kho'}
          </button>
        )}
        {arrived && (
          <div style={{ background: '#CCFBF1', color: C.teal, borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
            ✅ Đã xác nhận<br/><span style={{ fontSize: 11, fontWeight: 400 }}>Shipper khu vực có thể nhận</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default IncomingShipmentsPage
