import React, { useEffect, useState, useCallback } from 'react'
import { warehouseService } from '../../services/warehouseService'

const C = { navy: '#1E3A5F', teal: '#0D9488', amber: '#D97706', purple: '#7C3AED', green: '#16A34A', red: '#DC2626', gray: '#64748B', blue: '#1D4ED8' }

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: '⏳ Chờ',        color: C.amber,  bg: '#FEF3C7' },
  assigned:         { label: '📌 Đã giao',    color: C.blue,   bg: '#DBEAFE' },
  in_transit:       { label: '🚛 Đang vận',  color: C.purple, bg: '#EDE9FE' },
  at_warehouse:     { label: '🏭 Tại kho',   color: C.teal,   bg: '#CCFBF1' },
  out_for_delivery: { label: '🏍️ Đi giao',   color: C.amber,  bg: '#FEF9C3' },
  delivered:        { label: '✅ Đã giao',   color: C.green,  bg: '#DCFCE7' },
  failed:           { label: '❌ Thất bại',  color: C.red,    bg: '#FEE2E2' },
}

const TYPE_MAP: Record<string, { label: string; icon: string; color: string }> = {
  local:          { label: 'Tự do',     icon: '🛵', color: C.purple },
  zone:           { label: 'Khu vực',   icon: '🏍️', color: C.teal },
  inter_province: { label: 'Liên tỉnh', icon: '🚚', color: C.amber },
}

const formatCurrency = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v)

const MOCK_SHIPMENTS = Array.from({ length: 24 }, (_, i) => ({
  shipment_id: 1000 + i,
  order_id: 5000 + i,
  shipment_type: ['local', 'zone', 'inter_province'][i % 3],
  status: ['pending', 'assigned', 'in_transit', 'at_warehouse', 'delivered', 'failed'][i % 6],
  pickup_location: `${['TP.HCM', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ'][i % 4]} - ${100 + i} đường ABC`,
  delivery_location: `${['Bình Dương', 'Long An', 'Đồng Nai', 'Hải Phòng'][i % 4]} - ${200 + i} đường XYZ`,
  src_warehouse: i % 3 === 2 ? 'Kho HCM' : null,
  dest_warehouse: i % 3 === 2 ? 'Kho Hà Nội' : null,
  shipper_name: i % 4 === 0 ? null : `Shipper ${String.fromCharCode(65 + (i % 5))}`,
  shipper_type: ['free', 'zone', 'inter_province'][i % 3],
  created_at: new Date(Date.now() - i * 3600000 * 8).toISOString(),
  recipient: `Khách hàng ${i + 1}`,
  phone: `09${String(i * 7 + 10000000).padStart(8, '0')}`,
  amount: 150000 + i * 25000,
}))

const AllShipmentsPage: React.FC = () => {
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter]     = useState('')
  const [page, setPage]   = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<any>(null)

  const load = useCallback(() => {
    setLoading(true)
    warehouseService.getAllShipments({ page, limit: 20, shipment_status: statusFilter || undefined, shipment_type: typeFilter || undefined })
      .then((r: any) => {
        setShipments(r.data?.shipments ?? [])
        setTotal(r.data?.total ?? 0)
        setPages(r.data?.pages ?? 1)
      })
      .catch(() => {
        // Fallback mock
        let filtered = MOCK_SHIPMENTS
        if (statusFilter) filtered = filtered.filter(s => s.status === statusFilter)
        if (typeFilter) filtered = filtered.filter(s => s.shipment_type === typeFilter)
        setShipments(filtered.slice((page - 1) * 20, page * 20))
        setTotal(filtered.length)
        setPages(Math.ceil(filtered.length / 20))
      })
      .finally(() => setLoading(false))
  }, [page, statusFilter, typeFilter])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.navy, margin: 0 }}>📋 Tất cả đơn hàng</h1>
          <p style={{ color: C.gray, fontSize: 13, margin: '4px 0 0' }}>Tổng cộng {total} đơn</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, cursor: 'pointer' }}>
            <option value="">Tất cả loại</option>
            <option value="local">🛵 Tự do</option>
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
                {['Đơn #', 'Loại', 'Trạng thái', 'Lấy hàng', 'Giao đến', 'Shipper', 'Số tiền', 'Thời gian'].map(h => (
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
                return (
                  <tr key={s.shipment_id} onClick={() => setSelected(s)}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: C.navy }}>#{s.shipment_id}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: '#EDE9FE', borderRadius: 6, padding: '3px 8px', fontSize: 12, color: tp.color, fontWeight: 600 }}>
                        {tp.icon} {tp.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: C.gray, maxWidth: 160 }}>
                      <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.src_warehouse ? '🏭 ' + s.src_warehouse : s.pickup_location}
                      </p>
                    </td>
                    <td style={{ padding: '12px 14px', color: C.gray, maxWidth: 160 }}>
                      <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.dest_warehouse ? '🏭 ' + s.dest_warehouse : s.delivery_location}
                      </p>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {s.shipper_name ? (
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, color: C.navy }}>{s.shipper_name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: C.gray }}>{TYPE_MAP[s.shipper_type]?.icon} {TYPE_MAP[s.shipper_type]?.label}</p>
                        </div>
                      ) : <span style={{ color: '#94A3B8', fontSize: 12 }}>Chưa có</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: C.teal, whiteSpace: 'nowrap' }}>
                      {s.amount ? formatCurrency(s.amount) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', color: C.gray, fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(s.created_at).toLocaleString('vi-VN')}
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
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: page === 1 ? '#F8FAFC' : '#fff', cursor: page === 1 ? 'default' : 'pointer', fontSize: 13 }}>
              ← Trước
            </button>
            <span style={{ fontSize: 13, color: C.gray }}>Trang {page}/{pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: page === pages ? '#F8FAFC' : '#fff', cursor: page === pages ? 'default' : 'pointer', fontSize: 13 }}>
              Tiếp →
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSelected(null)}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, color: C.navy, margin: 0 }}>Đơn #{selected.shipment_id}</h3>
              <button onClick={() => setSelected(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, color: C.gray }}>✕</button>
            </div>
            {[
              ['Loại vận chuyển', (TYPE_MAP[selected.shipment_type]?.icon ?? '') + ' ' + (TYPE_MAP[selected.shipment_type]?.label ?? selected.shipment_type)],
              ['Trạng thái', (STATUS_MAP[selected.status]?.label ?? selected.status)],
              ['Người nhận', selected.recipient],
              ['SĐT', selected.phone],
              ['Số tiền', selected.amount ? formatCurrency(selected.amount) : '—'],
              ['Lấy hàng tại', selected.src_warehouse ? '🏭 ' + selected.src_warehouse : selected.pickup_location],
              ['Giao đến', selected.dest_warehouse ? '🏭 ' + selected.dest_warehouse : selected.delivery_location],
              ['Shipper', selected.shipper_name ?? 'Chưa có'],
              ['Thời gian', new Date(selected.created_at).toLocaleString('vi-VN')],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: C.gray, fontSize: 14 }}>{k as string}</span>
                <span style={{ color: C.navy, fontWeight: 600, fontSize: 14, textAlign: 'right', maxWidth: 260 }}>{v as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AllShipmentsPage
