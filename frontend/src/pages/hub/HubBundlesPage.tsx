/**
 * HubBundlesPage — Quản lý bundle liên tỉnh (kho tổng)
 * Tạo mã LT, thêm đơn SD vào bundle, seal, xác nhận arrival
 */
import React, { useEffect, useState } from 'react'
import API from '../../services/api'

const C = {
  navy: '#0F172A', teal: '#0F766E', tealLight: '#CCFBF1', tealBg: '#F0FDFA',
  gray: '#64748B', border: '#E2E8F0', success: '#16A34A', warning: '#D97706',
  error: '#DC2626', orange: '#EA580C',
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: '⏳ Đang gom hàng', color: C.warning, bg: '#FEF3C7' },
  in_transit:  { label: '🚚 Đang vận chuyển', color: '#7C3AED', bg: '#EDE9FE' },
  arrived:     { label: '📦 Đã đến nơi', color: C.success, bg: '#DCFCE7' },
  distributed: { label: '✅ Đã phân phối', color: C.gray, bg: '#F1F5F9' },
}

const fmt = (n: number) => n?.toLocaleString('vi-VN') + '₫'

const HubBundlesPage: React.FC = () => {
  const [bundles, setBundles]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setFilter] = useState('')
  const [selected, setSelected]   = useState<any | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Create form
  const [destHubs, setDestHubs]   = useState<any[]>([])
  const [destHubId, setDestHubId] = useState('')
  const [creating, setCreating]   = useState(false)

  // Add shipment form
  const [addCode, setAddCode]     = useState('')
  const [adding, setAdding]       = useState(false)

  // Actions
  const [sealing, setSealing]     = useState(false)
  const [arriving, setArriving]   = useState(false)

  const load = async () => {
    setLoading(true)
    const params: any = { limit: 50 }
    if (statusFilter) params.status = statusFilter
    API.get('/api/v1/warehouses/hub/bundles', { params })
      .then(r => setBundles(r.data.bundles || []))
      .catch(() => setBundles([]))
      .finally(() => setLoading(false))
  }

  const loadDetail = (bundleId: number) => {
    API.get(`/api/v1/warehouses/hub/bundles/${bundleId}`)
      .then(r => setSelected(r.data))
      .catch(() => alert('Không tải được chi tiết bundle'))
  }

  const loadDestHubs = () => {
    API.get('/api/v1/warehouses', { params: { tier: 1 } })
      .then(r => setDestHubs(r.data || []))
      .catch(() => setDestHubs([]))
  }

  useEffect(() => { load() }, [statusFilter])

  const handleCreate = async () => {
    if (!destHubId) { alert('Chọn kho tổng đích'); return }
    setCreating(true)
    try {
      const r = await API.post('/api/v1/warehouses/hub/bundles', { dest_hub_id: Number(destHubId) })
      alert(`✅ Tạo bundle thành công: ${r.data.bundle_code}`)
      setShowCreate(false)
      setDestHubId('')
      load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Lỗi tạo bundle')
    } finally { setCreating(false) }
  }

  const handleAddShipment = async () => {
    if (!addCode.trim() || !selected) return
    setAdding(true)
    try {
      const r = await API.post(`/api/v1/warehouses/hub/bundles/${selected.bundle_id}/add-shipment`, {
        delivery_code: addCode.trim(),
      })
      alert(r.data.message)
      setAddCode('')
      loadDetail(selected.bundle_id)
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Lỗi thêm đơn')
    } finally { setAdding(false) }
  }

  const handleSeal = async () => {
    if (!selected) return
    if (!confirm(`Niêm phong bundle ${selected.bundle_code}? Sau khi seal không thể thêm/bớt đơn.`)) return
    setSealing(true)
    try {
      const r = await API.post(`/api/v1/warehouses/hub/bundles/${selected.bundle_id}/seal`)
      alert(r.data.message)
      loadDetail(selected.bundle_id)
      load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Lỗi seal bundle')
    } finally { setSealing(false) }
  }

  const handleConfirmArrival = async () => {
    if (!selected) return
    if (!confirm(`Xác nhận bundle ${selected.bundle_code} đã đến kho tổng của bạn?`)) return
    setArriving(true)
    try {
      const r = await API.post(`/api/v1/warehouses/hub/bundles/${selected.bundle_id}/confirm-arrival`)
      alert(r.data.message)
      loadDetail(selected.bundle_id)
      load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Lỗi xác nhận arrival')
    } finally { setArriving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🚚 Bundle Liên Tỉnh</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Quản lý mã LT gom đơn vận chuyển liên tỉnh</p>
        </div>
        <button onClick={() => { setShowCreate(true); loadDestHubs() }}
          style={{ padding: '9px 18px', background: C.teal, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Tạo Bundle
        </button>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['', 'Tất cả'], ['pending', '⏳ Đang gom'], ['in_transit', '🚚 Đang vận chuyển'], ['arrived', '📦 Đã đến'], ['distributed', '✅ Đã phân phối']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${statusFilter === v ? C.teal : C.border}`, background: statusFilter === v ? C.teal : '#fff', color: statusFilter === v ? '#fff' : C.gray, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Bundle list */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tealBg }}>
              {['Mã Bundle', 'Kho đi', 'Kho đến', 'Trạng thái', 'Số đơn', 'Tổng COD', 'Seal lúc', 'Đến lúc', 'Thao tác'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Đang tải...</td></tr>
            ) : bundles.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Chưa có bundle nào</td></tr>
            ) : bundles.map((b: any) => {
              const st = STATUS_MAP[b.status] ?? { label: b.status, color: C.gray, bg: '#F1F5F9' }
              return (
                <tr key={b.bundle_id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.tealBg)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 14px', fontWeight: 800, fontSize: 13, color: C.teal }}>{b.bundle_code}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>{b.src_hub || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>{b.dest_hub || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: 13 }}>{b.total_shipments}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: 13 }}>{fmt(b.total_cod)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: C.gray }}>{b.sealed_at ? new Date(b.sealed_at).toLocaleString('vi-VN') : '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: C.gray }}>{b.arrived_at ? new Date(b.arrived_at).toLocaleString('vi-VN') : '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => loadDetail(b.bundle_id)}
                      style={{ padding: '5px 12px', background: C.tealLight, color: C.teal, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      Chi tiết
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── CREATE MODAL ── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: C.navy, margin: 0 }}>🚚 Tạo Bundle Liên Tỉnh</h3>
              <button onClick={() => setShowCreate(false)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6 }}>Kho tổng đích (điểm nhận hàng)</label>
              <select value={destHubId} onChange={e => setDestHubId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }}>
                <option value="">— Chọn kho tổng đích —</option>
                {destHubs.map((h: any) => (
                  <option key={h.warehouse_id} value={h.warehouse_id}>{h.name} ({h.city})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)}
                style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                Hủy
              </button>
              <button onClick={handleCreate} disabled={creating}
                style={{ padding: '8px 18px', background: C.teal, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: creating ? 0.6 : 1 }}>
                {creating ? '...' : 'Tạo Bundle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 680, maxWidth: '96vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17, color: C.teal }}>{selected.bundle_code}</div>
                <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
                  {selected.src_hub} → {selected.dest_hub} · {selected.total_shipments} đơn · {fmt(selected.total_cod)} COD
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(() => { const st = STATUS_MAP[selected.status]; return st ? (
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                ) : null })()}
                <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
              </div>
            </div>

            {/* Add shipment — only when pending */}
            {selected.status === 'pending' && (
              <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
                <input
                  value={addCode}
                  onChange={e => setAddCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddShipment()}
                  placeholder="Nhập mã SD hoặc scan QR..."
                  style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }}
                />
                <button onClick={handleAddShipment} disabled={adding || !addCode.trim()}
                  style={{ padding: '8px 16px', background: C.teal, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: adding ? 0.6 : 1 }}>
                  {adding ? '...' : '+ Thêm đơn'}
                </button>
              </div>
            )}

            {/* Shipment list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.tealBg, position: 'sticky', top: 0 }}>
                    {['Mã SD', 'Trạng thái', 'Người nhận', 'Địa chỉ giao', 'COD'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(selected.shipments || []).length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: C.gray }}>Chưa có đơn nào trong bundle</td></tr>
                  ) : (selected.shipments || []).map((s: any) => (
                    <tr key={s.shipment_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: C.teal, fontSize: 13 }}>{s.delivery_code || `#${s.shipment_id}`}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>
                        <span style={{ padding: '3px 8px', borderRadius: 12, background: '#F1F5F9', color: C.gray, fontWeight: 600 }}>{s.status}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{s.recipient || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: C.gray, maxWidth: 160 }}>{s.delivery_addr || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>{s.cod_amount > 0 ? fmt(s.cod_amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer actions */}
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {selected.status === 'pending' && (
                <button onClick={handleSeal} disabled={sealing || selected.total_shipments === 0}
                  style={{ padding: '9px 18px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: sealing ? 0.6 : 1 }}>
                  {sealing ? '...' : '🔒 Niêm phong & Xuất phát'}
                </button>
              )}
              {selected.status === 'in_transit' && (
                <button onClick={handleConfirmArrival} disabled={arriving}
                  style={{ padding: '9px 18px', background: C.success, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: arriving ? 0.6 : 1 }}>
                  {arriving ? '...' : '✅ Xác nhận đã đến kho'}
                </button>
              )}
              <button onClick={() => setSelected(null)}
                style={{ padding: '9px 16px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HubBundlesPage
