/**
 * WardShippersPage — Quản lý shipper của kho phường
 */
import React, { useEffect, useState } from 'react'
import API from '../../services/api'

const C = { navy: '#0F172A', orange: '#EA580C', light: '#FED7AA', tint: '#FFF7ED', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const STATUS_SHIPPER: Record<string, { label: string; color: string; bg: string }> = {
  active:     { label: 'Đang làm việc', color: C.success, bg: '#DCFCE7' },
  off_duty:   { label: 'Nghỉ ca',       color: C.warning, bg: '#FEF3C7' },
  suspended:  { label: 'Tạm đình chỉ', color: C.error,   bg: '#FEE2E2' },
}

const WardShippersPage: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [allShippers, setAllShippers] = useState<any[]>([])
  const [searchShipper, setSearchShipper] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    API.get('/api/v1/warehouses/ward/shippers')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  const loadAllShippers = () => {
    API.get('/api/v1/admin/shippers', { params: { limit: 100 } })
      .then(r => setAllShippers(r.data?.shippers || r.data || []))
      .catch(() => setAllShippers([]))
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (shipperId: number) => {
    setAdding(true)
    try {
      await API.post('/api/v1/warehouses/ward/shippers', { shipper_id: shipperId })
      setShowAdd(false)
      load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Lỗi thêm shipper')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (shipperId: number) => {
    if (!confirm('Xác nhận xóa shipper khỏi kho này?')) return
    setRemoving(shipperId)
    try {
      await API.delete(`/api/v1/warehouses/ward/shippers/${shipperId}`)
      load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Lỗi xóa shipper')
    } finally {
      setRemoving(null)
    }
  }

  const handleUpdateStatus = async (shipperId: number, status: string) => {
    setUpdatingStatus(shipperId)
    try {
      await API.patch(`/api/v1/warehouses/ward/shippers/${shipperId}/status`, { status })
      load()
    } catch {
      alert('Lỗi cập nhật trạng thái')
    } finally {
      setUpdatingStatus(null)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>

  const { warehouse, shippers = [] } = data || {}

  // Lọc allShippers chưa có trong kho
  const existingIds = new Set(shippers.map((s: any) => s.shipper_id))
  const filteredAll = allShippers.filter((s: any) =>
    !existingIds.has(s.shipper_id) &&
    (s.full_name || '').toLowerCase().includes(searchShipper.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🛵 Quản lý Shipper</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
            Kho {warehouse?.name} · {shippers.length} shipper
            {shippers.length === 0 && <span style={{ color: C.error, fontWeight: 700 }}> ⚠️ Cần ít nhất 1 shipper!</span>}
          </p>
        </div>
        <button onClick={() => { setShowAdd(true); loadAllShippers() }}
          style={{ padding: '8px 16px', background: C.orange, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Thêm shipper
        </button>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 440, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '80vh', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: C.navy, margin: 0 }}>🛵 Thêm shipper vào kho</h3>
              <button onClick={() => setShowAdd(false)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <input
              value={searchShipper}
              onChange={e => setSearchShipper(e.target.value)}
              placeholder="🔍 Tìm theo tên..."
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14 }}
            />
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredAll.length === 0 ? (
                <p style={{ textAlign: 'center', color: C.gray, padding: 20 }}>Không có shipper phù hợp</p>
              ) : filteredAll.map((s: any) => (
                <div key={s.shipper_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>{s.full_name || s.user?.full_name || 'Shipper'}</div>
                    <div style={{ fontSize: 12, color: C.gray }}>{s.phone || s.user?.phone || ''}</div>
                  </div>
                  <button onClick={() => handleAdd(s.shipper_id)} disabled={adding}
                    style={{ padding: '6px 14px', background: C.orange, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: adding ? 0.5 : 1 }}>
                    Thêm
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shipper list */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['#', 'Shipper', 'SĐT', 'Phương tiện', 'Đã giao', 'Đánh giá', 'Trạng thái ca', 'Thao tác'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shippers.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: C.gray }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🛵</div>
                <div>Chưa có shipper. Nhấn "Thêm shipper" để bắt đầu.</div>
              </td></tr>
            ) : shippers.map((s: any, idx: number) => {
              const st = STATUS_SHIPPER[s.status] ?? { label: s.status, color: C.gray, bg: '#F1F5F9' }
              return (
                <tr key={s.shipper_id} style={{ borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FFF7ED')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 14px', color: C.gray, fontSize: 13 }}>#{idx + 1}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{s.full_name}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>ID: {s.shipper_id}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: C.gray }}>{s.phone || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: C.gray }}>{s.vehicle_type || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: C.navy }}>{s.total_deliveries}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>
                    <span style={{ color: '#F59E0B', fontWeight: 700 }}>★ {s.rating}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <select
                      value={s.status}
                      disabled={updatingStatus === s.shipper_id}
                      onChange={e => handleUpdateStatus(s.shipper_id, e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid ${st.color}`, background: st.bg, color: st.color, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                      {Object.entries(STATUS_SHIPPER).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => handleRemove(s.shipper_id)} disabled={removing === s.shipper_id}
                      style={{ padding: '5px 12px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: removing === s.shipper_id ? 0.5 : 1 }}>
                      {removing === s.shipper_id ? '...' : 'Xóa'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default WardShippersPage
