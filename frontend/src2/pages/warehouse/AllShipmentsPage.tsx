/**
 * AllShipmentsPage — Warehouse Manager
 * Hiển thị đơn hàng có địa chỉ giao thuộc tỉnh/thành của kho này.
 * Địa chỉ giao gồm: Số nhà → Phường/Xã → Quận/Huyện → Tỉnh/Thành phố
 */
import React, { useEffect, useState, useCallback } from 'react'
import { warehouseService } from '../../services/warehouseService'

const C = { navy: '#1E3A5F', teal: '#0D9488', amber: '#D97706', purple: '#7C3AED', green: '#16A34A', red: '#DC2626', gray: '#64748B', blue: '#1D4ED8' }

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: '⏳ Chờ xử lý',   color: C.amber,  bg: '#FEF3C7' },
  assigned:         { label: '📌 Đã gán',       color: C.blue,   bg: '#DBEAFE' },
  in_transit:       { label: '🚛 Đang vận',     color: C.purple, bg: '#EDE9FE' },
  at_warehouse:     { label: '🏭 Tại kho',      color: C.teal,   bg: '#CCFBF1' },
  out_for_delivery: { label: '🏍️ Đang giao',    color: C.amber,  bg: '#FEF9C3' },
  delivered:        { label: '✅ Đã giao',      color: C.green,  bg: '#DCFCE7' },
  failed:           { label: '❌ Thất bại',     color: C.red,    bg: '#FEE2E2' },
}

const TYPE_MAP: Record<string, { label: string; icon: string; color: string }> = {
  zone:           { label: 'Khu vực',   icon: '🏍️', color: C.teal },
  inter_province: { label: 'Liên tỉnh', icon: '🚚', color: C.amber },
}

interface Address {
  street: string      // Số nhà, tên đường
  ward: string        // Phường / Xã
  district: string    // Quận / Huyện
  province: string    // Tỉnh / Thành phố
}

interface Shipment {
  shipment_id: number
  order_id: number
  shipment_type: string
  status: string
  pickup_address: Address
  delivery_address: Address
  src_warehouse: string | null
  dest_warehouse: string | null
  shipper_id: number | null
  shipper_name: string | null
  shipper_type: string | null
  recipient_name: string
  recipient_phone: string
  amount: number
  created_at: string
  notes: string | null
}

interface ZoneShipper {
  shipper_id: number
  full_name: string
  phone: string
  status: string
}

const formatCurrency = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v)
const formatAddr = (a: Address) => `${a.street}, ${a.ward}, ${a.district}, ${a.province}`
const formatAddrShort = (a: Address) => `${a.district}, ${a.province}`

// ── Mock data ──────────────────────────────────────────────────────────────────
const MOCK_ZONE_SHIPPERS: ZoneShipper[] = [
  { shipper_id: 11, full_name: 'Trần Thị B',   phone: '0902222222', status: 'available' },
  { shipper_id: 14, full_name: 'Lê Văn G',     phone: '0905555555', status: 'available' },
  { shipper_id: 16, full_name: 'Phạm Ngọc H',  phone: '0907777777', status: 'on_delivery' },
]

const MOCK_SHIPMENTS: Shipment[] = Array.from({ length: 20 }, (_, i) => {
  const provinces = ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ']
  const wards = ['Phường Bến Nghé', 'Phường Tân Phú', 'Phường 12', 'Xã Phước Lộc']
  const districts = ['Quận 1', 'Quận Bình Thạnh', 'Huyện Bình Chánh', 'Quận Tân Bình']
  const streets = ['123 Nguyễn Huệ', '45 Lê Lợi', '78 Trần Hưng Đạo', '200 Cộng Hòa']
  return {
    shipment_id: 1000 + i,
    order_id: 5000 + i,
    shipment_type: i % 3 === 2 ? 'inter_province' : 'zone',
    status: ['pending', 'assigned', 'in_transit', 'at_warehouse', 'out_for_delivery', 'delivered', 'failed'][i % 7],
    pickup_address: {
      street: streets[(i + 2) % 4],
      ward: wards[(i + 1) % 4],
      district: districts[(i + 1) % 4],
      province: provinces[(i + 2) % 4],
    },
    delivery_address: {
      street: streets[i % 4],
      ward: wards[i % 4],
      district: districts[i % 4],
      province: 'TP. Hồ Chí Minh', // tất cả giao về HCM (kho hiện tại)
    },
    src_warehouse: i % 3 === 2 ? 'Kho Hà Nội' : null,
    dest_warehouse: i % 3 === 2 ? 'Kho HCM' : null,
    shipper_id: i % 4 === 0 ? null : 11,
    shipper_name: i % 4 === 0 ? null : 'Trần Thị B',
    shipper_type: i % 4 === 0 ? null : 'zone',
    recipient_name: `Khách hàng ${i + 1}`,
    recipient_phone: `090${String(i * 7 + 1000000).padStart(7, '0')}`,
    amount: 150000 + i * 25000,
    created_at: new Date(Date.now() - i * 3600000 * 6).toISOString(),
    notes: i % 5 === 0 ? 'Giao giờ hành chính' : null,
  }
})

// ─────────────────────────────────────────────────────────────────────────────

const AllShipmentsPage: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter]     = useState('')
  const [page, setPage]   = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected]       = useState<Shipment | null>(null)
  const [assignTarget, setAssignTarget] = useState<Shipment | null>(null)
  const [zoneShippers, setZoneShippers] = useState<ZoneShipper[]>([])
  const [pickedShipper, setPickedShipper] = useState<number | ''>('')
  const [assigning, setAssigning]     = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    warehouseService.getAllShipments({ page, limit: 20, shipment_status: statusFilter || undefined, shipment_type: typeFilter || undefined })
      .then((r: any) => {
        setShipments(r.data?.shipments ?? [])
        setTotal(r.data?.total ?? 0)
        setPages(r.data?.pages ?? 1)
      })
      .catch(() => {
        let filtered = MOCK_SHIPMENTS
        if (statusFilter) filtered = filtered.filter(s => s.status === statusFilter)
        if (typeFilter)   filtered = filtered.filter(s => s.shipment_type === typeFilter)
        const slice = filtered.slice((page - 1) * 20, page * 20)
        setShipments(slice)
        setTotal(filtered.length)
        setPages(Math.ceil(filtered.length / 20))
      })
      .finally(() => setLoading(false))
  }, [page, statusFilter, typeFilter])

  useEffect(() => { load() }, [load])

  const openAssign = (s: Shipment) => {
    setAssignTarget(s)
    setPickedShipper('')
    // Lấy danh sách shipper khu vực của kho này
    warehouseService.getZoneShippers()
      .then((r: any) => setZoneShippers(r.data?.shippers ?? []))
      .catch(() => setZoneShippers(MOCK_ZONE_SHIPPERS))
  }

  const handleAssign = async () => {
    if (!assignTarget || !pickedShipper) return
    setAssigning(true)
    try {
      await warehouseService.assignShipper(assignTarget.shipment_id, Number(pickedShipper))
      const shipper = zoneShippers.find(z => z.shipper_id === pickedShipper)
      setShipments(ss => ss.map(s =>
        s.shipment_id === assignTarget.shipment_id
          ? { ...s, status: 'assigned', shipper_id: Number(pickedShipper), shipper_name: shipper?.full_name ?? null, shipper_type: 'zone' }
          : s
      ))
      setAssignTarget(null)
    } catch {
      // Fallback mock
      const shipper = zoneShippers.find(z => z.shipper_id === pickedShipper)
      setShipments(ss => ss.map(s =>
        s.shipment_id === assignTarget.shipment_id
          ? { ...s, status: 'assigned', shipper_id: Number(pickedShipper), shipper_name: shipper?.full_name ?? null, shipper_type: 'zone' }
          : s
      ))
      setAssignTarget(null)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.navy, margin: 0 }}>📋 Đơn hàng về kho</h1>
          <p style={{ color: C.gray, fontSize: 13, margin: '4px 0 0' }}>
            Tổng cộng <strong>{total}</strong> đơn — địa chỉ giao thuộc tỉnh/thành phố kho này
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, cursor: 'pointer' }}>
            <option value="">Tất cả loại</option>
            <option value="zone">🏍️ Khu vực</option>
            <option value="inter_province">🚚 Liên tỉnh</option>
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, cursor: 'pointer' }}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={load} style={{ padding: '8px 16px', borderRadius: 8, background: C.teal, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            🔄 Làm mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                {['Đơn #', 'Loại', 'Trạng thái', 'Lấy tại', 'Địa chỉ giao', 'Shipper', 'Tiền COD', 'Hành động'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: C.gray, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: C.gray }}>⏳ Đang tải...</td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: C.gray }}>Không có đơn nào</td></tr>
              ) : shipments.map(s => {
                const st = STATUS_MAP[s.status] ?? { label: s.status, color: C.gray, bg: '#F1F5F9' }
                const tp = TYPE_MAP[s.shipment_type] ?? { label: s.shipment_type, icon: '📦', color: C.gray }
                const canAssign = ['pending', 'at_warehouse'].includes(s.status) && !s.shipper_id && s.shipment_type === 'zone'
                return (
                  <tr key={s.shipment_id}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px' }} onClick={() => setSelected(s)}>
                      <p style={{ fontWeight: 700, color: C.navy, margin: 0 }}>#{s.shipment_id}</p>
                      <p style={{ color: C.gray, fontSize: 11, margin: 0 }}>ĐH #{s.order_id}</p>
                    </td>
                    <td style={{ padding: '12px 14px' }} onClick={() => setSelected(s)}>
                      <span style={{ background: '#EDE9FE', borderRadius: 6, padding: '3px 8px', fontSize: 12, color: tp.color, fontWeight: 600 }}>
                        {tp.icon} {tp.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }} onClick={() => setSelected(s)}>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', maxWidth: 140 }} onClick={() => setSelected(s)}>
                      {s.src_warehouse ? (
                        <span style={{ color: C.teal, fontWeight: 600 }}>🏭 {s.src_warehouse}</span>
                      ) : (
                        <div>
                          <p style={{ margin: 0, fontSize: 12, color: C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.pickup_address.street}</p>
                          <p style={{ margin: 0, fontSize: 11, color: C.gray }}>{formatAddrShort(s.pickup_address)}</p>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', maxWidth: 180 }} onClick={() => setSelected(s)}>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, color: C.navy }}>{s.delivery_address.street}</p>
                        <p style={{ margin: 0, fontSize: 11, color: C.gray }}>{s.delivery_address.ward}, {s.delivery_address.district}</p>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.teal }}>📍 {s.delivery_address.province}</p>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }} onClick={() => setSelected(s)}>
                      {s.shipper_name ? (
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, color: C.navy, fontSize: 13 }}>{s.shipper_name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: C.gray }}>{TYPE_MAP[s.shipper_type ?? '']?.icon} {TYPE_MAP[s.shipper_type ?? '']?.label ?? '—'}</p>
                        </div>
                      ) : <span style={{ color: '#94A3B8', fontSize: 12 }}>Chưa có</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: C.teal, whiteSpace: 'nowrap' }} onClick={() => setSelected(s)}>
                      {s.amount ? formatCurrency(s.amount) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {canAssign ? (
                        <button onClick={() => openAssign(s)}
                          style={{ padding: '6px 12px', background: '#DCFCE7', color: C.green, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          🏍️ Gán shipper
                        </button>
                      ) : (
                        <button onClick={() => setSelected(s)}
                          style={{ padding: '6px 12px', background: '#F1F5F9', color: C.gray, border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                          Chi tiết
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              ← Trước
            </button>
            <span style={{ fontSize: 13, color: C.gray }}>Trang {page}/{pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              Tiếp →
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSelected(null)}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 540, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, color: C.navy, margin: 0 }}>Đơn #{selected.shipment_id}</h3>
              <button onClick={() => setSelected(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: C.gray }}>✕</button>
            </div>

            {/* Địa chỉ giao - highlight */}
            <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '16px 20px', marginBottom: 16, border: '1px solid #BBF7D0' }}>
              <p style={{ fontWeight: 700, color: C.green, margin: '0 0 10px', fontSize: 14 }}>📦 Địa chỉ giao hàng</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                {[
                  ['Số nhà / Đường', selected.delivery_address.street],
                  ['Phường / Xã', selected.delivery_address.ward],
                  ['Quận / Huyện', selected.delivery_address.district],
                  ['Tỉnh / Thành phố', selected.delivery_address.province],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p style={{ color: C.gray, fontSize: 11, margin: '0 0 2px' }}>{k}</p>
                    <p style={{ color: C.navy, fontWeight: 600, margin: 0 }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pickup */}
            <div style={{ background: '#FFF7ED', borderRadius: 12, padding: '14px 20px', marginBottom: 16, border: '1px solid #FED7AA' }}>
              <p style={{ fontWeight: 700, color: C.amber, margin: '0 0 8px', fontSize: 14 }}>🏪 Địa chỉ lấy hàng</p>
              <p style={{ fontSize: 13, color: C.navy, margin: 0 }}>
                {selected.src_warehouse ? `🏭 ${selected.src_warehouse}` : formatAddr(selected.pickup_address)}
              </p>
            </div>

            {[
              ['Loại vận chuyển', (TYPE_MAP[selected.shipment_type]?.icon ?? '') + ' ' + (TYPE_MAP[selected.shipment_type]?.label ?? selected.shipment_type)],
              ['Trạng thái', STATUS_MAP[selected.status]?.label ?? selected.status],
              ['Người nhận', selected.recipient_name],
              ['SĐT người nhận', selected.recipient_phone],
              ['Tiền COD', selected.amount ? formatCurrency(selected.amount) : '—'],
              ['Shipper', selected.shipper_name ? `${selected.shipper_name} (${TYPE_MAP[selected.shipper_type ?? '']?.label ?? '—'})` : 'Chưa gán'],
              ['Ghi chú', selected.notes || '—'],
              ['Ngày tạo', new Date(selected.created_at).toLocaleString('vi-VN')],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: C.gray, fontSize: 13 }}>{k as string}</span>
                <span style={{ color: C.navy, fontWeight: 600, fontSize: 13, textAlign: 'right', maxWidth: 280 }}>{v as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign Shipper Modal */}
      {assignTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setAssignTarget(null)}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 440, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 800, color: C.navy, marginBottom: 4 }}>🏍️ Gán shipper giao đơn</h3>
            <p style={{ color: C.gray, fontSize: 13, marginBottom: 6 }}>Đơn #{assignTarget.shipment_id}</p>
            <p style={{ color: C.teal, fontWeight: 600, fontSize: 13, marginBottom: 20 }}>
              📍 {assignTarget.delivery_address.district}, {assignTarget.delivery_address.province}
            </p>

            <label style={{ fontSize: 13, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 8 }}>Chọn shipper khu vực</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {zoneShippers.map(z => (
                <label key={z.shipper_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10,
                  border: `2px solid ${pickedShipper === z.shipper_id ? C.teal : '#E2E8F0'}`,
                  background: pickedShipper === z.shipper_id ? '#F0FDFA' : '#fff',
                  cursor: z.status === 'available' ? 'pointer' : 'default',
                  opacity: z.status === 'available' ? 1 : 0.5,
                }}>
                  <input type="radio" name="shipper" value={z.shipper_id}
                    checked={pickedShipper === z.shipper_id}
                    disabled={z.status !== 'available'}
                    onChange={() => setPickedShipper(z.shipper_id)}
                    style={{ accentColor: C.teal }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, color: C.navy, margin: 0, fontSize: 14 }}>{z.full_name}</p>
                    <p style={{ color: C.gray, fontSize: 12, margin: 0 }}>{z.phone}</p>
                  </div>
                  <span style={{
                    background: z.status === 'available' ? '#DCFCE7' : '#FEE2E2',
                    color: z.status === 'available' ? C.green : C.red,
                    borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700
                  }}>
                    {z.status === 'available' ? '✓ Sẵn sàng' : '🚚 Đang giao'}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAssignTarget(null)}
                style={{ flex: 1, padding: '10px 0', background: '#F1F5F9', color: C.gray, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                Hủy
              </button>
              <button onClick={handleAssign} disabled={!pickedShipper || assigning}
                style={{ flex: 2, padding: '10px 0', background: pickedShipper ? C.teal : '#94A3B8', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: pickedShipper ? 'pointer' : 'default' }}>
                {assigning ? '⏳ Đang gán...' : '✓ Xác nhận gán'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AllShipmentsPage
