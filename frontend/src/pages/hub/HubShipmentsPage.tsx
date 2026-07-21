/**
 * HubShipmentsPage — Đơn liên tỉnh đang qua kho tổng
 */
import React, { useEffect, useState } from 'react'
import API from '../../services/api'

const C = { navy: '#0F172A', blue: '#0D9488', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }
const fmt = (n: number) => n?.toLocaleString('vi-VN') + '₫'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: 'Chờ xử lý',  color: C.warning, bg: '#FEF3C7' },
  assigned:         { label: 'Đã gán',      color: C.blue,    bg: '#CCFBF1' },
  in_transit:       { label: 'Đang chuyển', color: '#7C3AED', bg: '#EDE9FE' },
  at_warehouse:     { label: 'Tại kho',     color: C.success, bg: '#DCFCE7' },
  out_for_delivery: { label: 'Đang giao',   color: C.blue,    bg: '#CCFBF1' },
  delivered:        { label: 'Đã giao',     color: C.success, bg: '#DCFCE7' },
  failed:           { label: 'Thất bại',    color: C.error,   bg: '#FEE2E2' },
}

const HubShipmentsPage: React.FC = () => {
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')

  const load = (p = 1) => {
    setLoading(true)
    const params: any = { page: p, limit: 20 }
    if (statusFilter) params.shipment_status = statusFilter
    API.get('/api/v1/warehouses/hub/shipments', { params })
      .then(r => {
        setShipments(r.data.shipments || [])
        setTotal(r.data.total || 0)
        setPages(r.data.pages || 1)
        setPage(p)
      })
      .catch(() => setShipments([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [statusFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🚛 Đơn liên tỉnh</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Hàng vào/ra kho tổng · {total} đơn</p>
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: 'white', cursor: 'pointer' }}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F0FDFA' }}>
              {['Mã vận chuyển', 'Đơn #', 'Nguồn → Đích', 'Người nhận', 'Trị giá', 'Shipper', 'Trạng thái'].map(h => (
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
              return (
                <tr key={s.shipment_id} style={{ borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: C.blue }}>#{s.shipment_id}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: C.gray }}>#{s.order_id}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12 }}>
                    <div style={{ color: C.gray }}>{s.src_warehouse || s.pickup_location || '—'}</div>
                    <div style={{ color: '#7C3AED', fontWeight: 600 }}>→ {s.dest_warehouse || s.delivery_location || '—'}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: C.navy }}>{s.recipient || '—'}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>{s.phone || ''}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: C.navy }}>
                    {s.amount ? fmt(s.amount) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: C.gray }}>{s.shipper_name || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
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
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', cursor: 'pointer', fontWeight: page === p ? 700 : 400, background: page === p ? C.blue : 'white', color: page === p ? 'white' : C.gray }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default HubShipmentsPage
