/**
 * WardOrdersPage — Đơn hàng cần giao trong phường + gán shipper
 */
import React, { useEffect, useState } from 'react'
import API from '../../services/api'

const C = { navy: '#0F172A', orange: '#EA580C', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }
const fmt = (n: number) => n?.toLocaleString('vi-VN') + '₫'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: 'Chờ xử lý',  color: C.warning, bg: '#FEF3C7' },
  at_warehouse:     { label: 'Tại kho',     color: C.orange,  bg: '#FED7AA' },
  assigned:         { label: 'Đã gán',      color: '#0D9488', bg: '#CCFBF1' },
  out_for_delivery: { label: 'Đang giao',   color: '#7C3AED', bg: '#EDE9FE' },
  delivered:        { label: 'Đã giao',     color: C.success, bg: '#DCFCE7' },
  failed:           { label: 'Thất bại',    color: C.error,   bg: '#FEE2E2' },
}

const WardOrdersPage: React.FC = () => {
  const [shipments, setShipments] = useState<any[]>([])
  const [shippers, setShippers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [assigning, setAssigning] = useState<number | null>(null)
  const [selectedShipper, setSelectedShipper] = useState<Record<number, number>>({})

  const load = (p = 1) => {
    setLoading(true)
    const params: any = { page: p, limit: 20 }
    if (statusFilter) params.shipment_status = statusFilter
    API.get('/api/v1/warehouses/ward/orders', { params })
      .then(r => {
        setShipments(r.data.shipments || [])
        setTotal(r.data.total || 0)
        setPages(r.data.pages || 1)
        setPage(p)
      })
      .catch(() => setShipments([]))
      .finally(() => setLoading(false))
  }

  const loadShippers = () => {
    API.get('/api/v1/warehouses/ward/shippers')
      .then(r => setShippers(r.data.shippers?.filter((s: any) => s.status === 'active') || []))
      .catch(() => setShippers([]))
  }

  useEffect(() => { load(1); loadShippers() }, [statusFilter])

  const handleAssign = async (shipmentId: number) => {
    const shipperId = selectedShipper[shipmentId]
    if (!shipperId) { alert('Chọn shipper trước'); return }
    setAssigning(shipmentId)
    try {
      await API.post(`/api/v1/warehouses/ward/orders/${shipmentId}/assign-shipper`, { shipper_id: shipperId })
      load(page)
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Lỗi gán shipper')
    } finally {
      setAssigning(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>📦 Đơn hàng cần giao</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Đơn về kho phường · {total} đơn</p>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: 'white', cursor: 'pointer' }}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {shippers.length === 0 && (
        <div style={{ padding: 12, background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, fontSize: 13, color: '#991B1B', fontWeight: 600 }}>
          ⚠️ Kho chưa có shipper đang hoạt động. Vào "Quản lý Shipper" để thêm trước.
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FFF7ED' }}>
              {['Mã VĐ', 'Đơn #', 'Người nhận', 'Địa chỉ giao', 'Trị giá', 'Trạng thái', 'Gán shipper'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Đang tải...</td></tr>
            ) : shipments.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Không có đơn hàng nào</td></tr>
            ) : shipments.map((s: any) => {
              const st = STATUS_MAP[s.status] ?? { label: s.status, color: C.gray, bg: '#F1F5F9' }
              const canAssign = s.status === 'at_warehouse' || s.status === 'pending'
              return (
                <tr key={s.shipment_id} style={{ borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FFF7ED')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: C.orange }}>#{s.shipment_id}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: C.gray }}>#{s.order_id}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: C.navy }}>{s.recipient || '—'}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>{s.phone || ''}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: C.gray, maxWidth: 180 }}>
                    {s.delivery_location || '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700 }}>{s.amount ? fmt(s.amount) : '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                    {s.shipper_name && <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>🛵 {s.shipper_name}</div>}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {canAssign ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          value={selectedShipper[s.shipment_id] || ''}
                          onChange={e => setSelectedShipper(p => ({ ...p, [s.shipment_id]: Number(e.target.value) }))}
                          style={{ flex: 1, padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }}>
                          <option value="">Chọn...</option>
                          {shippers.map((sh: any) => (
                            <option key={sh.shipper_id} value={sh.shipper_id}>{sh.full_name}</option>
                          ))}
                        </select>
                        <button onClick={() => handleAssign(s.shipment_id)} disabled={assigning === s.shipment_id}
                          style={{ padding: '5px 10px', background: C.orange, color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', opacity: assigning === s.shipment_id ? 0.5 : 1 }}>
                          {assigning === s.shipment_id ? '...' : 'Gán'}
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: C.gray }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => load(p)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', cursor: 'pointer', fontWeight: page === p ? 700 : 400, background: page === p ? C.orange : 'white', color: page === p ? 'white' : C.gray }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default WardOrdersPage
