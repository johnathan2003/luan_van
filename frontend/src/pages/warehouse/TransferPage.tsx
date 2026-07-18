/**
 * TransferPage.tsx — Warehouse Manager: Chuyến vận chuyển của kho mình
 * -----------------------------------------------------------------------
 * GET /api/v1/warehouses/transfers?warehouse_id={myId}
 * POST /api/v1/warehouses/transfers
 * PUT  /api/v1/warehouses/transfers/{id}/status
 */
import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'

interface Transfer {
  transfer_id: number
  from_warehouse_id: number
  from_warehouse: string | null
  to_warehouse_id: number
  to_warehouse: string | null
  transfer_type: string
  status: string
  note: string | null
  created_at: string
  departed_at: string | null
  arrived_at: string | null
  package_count: number
}
interface WarehouseInfo {
  warehouse_id: number
  name: string
  province: string
  tier?: number
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: '⏳ Chờ xuất phát',  color: '#D97706', bg: 'rgba(217,119,6,0.1)' },
  in_transit: { label: '🚚 Đang vận chuyển', color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  arrived:    { label: '📦 Đã đến kho đích', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  completed:  { label: '✅ Hoàn thành',      color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
  cancelled:  { label: '❌ Huỷ',             color: '#DC2626', bg: 'rgba(220,38,38,0.1)' },
}
const NEXT_STATUS: Record<string, string> = {
  pending: 'in_transit', in_transit: 'arrived', arrived: 'completed',
}
const C = {
  navy: '#1E3A5F', teal: '#0D9488',
  gray: '#64748B', border: '#E2E8F0', card: '#fff',
}
const btn = (bg: string, color = 'white', extra?: React.CSSProperties): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', ...extra,
})
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const TransferPage: React.FC = () => {
  const [myWarehouse,  setMyWarehouse]  = useState<WarehouseInfo | null>(null)
  const [allWarehouses, setAllWarehouses] = useState<WarehouseInfo[]>([])
  const [transfers,    setTransfers]    = useState<Transfer[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('')
  const [direction,    setDirection]    = useState<'all' | 'out' | 'in'>('all')
  const [advancing,    setAdvancing]    = useState<number | null>(null)

  // Create form
  const [showForm,  setShowForm]  = useState(false)
  const [toId,      setToId]      = useState<number>(0)
  const [transType, setTransType] = useState('forward')
  const [note,      setNote]      = useState('')
  const [saving,    setSaving]    = useState(false)

  const loadMyInfo = useCallback(async () => {
    try {
      const r = await API.get('/api/v1/warehouses/manager/dashboard')
      if (r.data.warehouse) setMyWarehouse(r.data.warehouse)
    } catch { /* ignore */ }
  }, [])

  const loadAllWarehouses = useCallback(async () => {
    try {
      const r = await API.get('/api/v1/warehouses')
      setAllWarehouses(r.data)
    } catch { /* ignore */ }
  }, [])

  const loadTransfers = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { limit: 50 }
      if (filter)          params.status = filter
      if (myWarehouse)     params.warehouse_id = myWarehouse.warehouse_id
      const r = await API.get('/api/v1/warehouses/transfers', { params })
      let items: Transfer[] = r.data.transfers
      // Client-side direction filter
      if (direction === 'out' && myWarehouse) items = items.filter(t => t.from_warehouse_id === myWarehouse.warehouse_id)
      if (direction === 'in'  && myWarehouse) items = items.filter(t => t.to_warehouse_id   === myWarehouse.warehouse_id)
      setTransfers(items)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [filter, direction, myWarehouse])

  useEffect(() => { loadMyInfo(); loadAllWarehouses() }, [])
  useEffect(() => { if (myWarehouse) loadTransfers() }, [myWarehouse, filter, direction])

  const advance = async (t: Transfer) => {
    const next = NEXT_STATUS[t.status]
    if (!next) return
    setAdvancing(t.transfer_id)
    try {
      await API.put(`/api/v1/warehouses/transfers/${t.transfer_id}/status`, { status: next })
      toast.success(`✅ Chuyển sang: ${STATUS_META[next]?.label ?? next}`)
      loadTransfers()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Lỗi cập nhật')
    } finally { setAdvancing(null) }
  }

  const createTransfer = async () => {
    if (!toId || !myWarehouse) { toast.error('Chọn kho đích'); return }
    setSaving(true)
    try {
      await API.post('/api/v1/warehouses/transfers', {
        from_warehouse_id: myWarehouse.warehouse_id,
        to_warehouse_id: toId,
        transfer_type: transType,
        note: note || null,
      })
      toast.success('✅ Đã tạo chuyến vận chuyển')
      setShowForm(false); setToId(0); setNote(''); loadTransfers()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Lỗi tạo transfer')
    } finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 11px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px', color: C.navy }}>🚚 Chuyến vận chuyển</h2>
        {myWarehouse && (
          <p style={{ color: C.gray, fontSize: 13, margin: 0 }}>
            Kho của bạn: <b style={{ color: C.navy }}>{myWarehouse.name}</b> — {myWarehouse.province}
          </p>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Direction */}
        {(['all', 'out', 'in'] as const).map(d => (
          <button key={d} onClick={() => setDirection(d)}
            style={{ ...btn(direction === d ? C.navy : 'transparent', direction === d ? 'white' : C.gray), border: `1px solid ${direction === d ? C.navy : C.border}` }}>
            {d === 'all' ? '🔁 Tất cả' : d === 'out' ? '📤 Xuất đi' : '📥 Nhận vào'}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: C.border }} />
        {/* Status filter */}
        {['', 'pending', 'in_transit', 'arrived', 'completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ ...btn(filter === s ? C.teal : 'transparent', filter === s ? 'white' : C.gray), border: `1px solid ${filter === s ? C.teal : C.border}` }}>
            {s === '' ? 'Tất cả' : (STATUS_META[s]?.label?.replace(/[🚚📦✅⏳❌]\s/, '') ?? s)}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={loadTransfers} style={btn('#E2E8F0', '#475569')}>🔄</button>
          <button onClick={() => setShowForm(!showForm)} style={btn(C.teal)}>➕ Tạo chuyến</button>
        </div>
      </div>

      {/* Create form */}
      {showForm && myWarehouse && (
        <div style={{ background: '#f0fdf4', border: `1px solid #bbf7d0`, borderRadius: 12, padding: 18, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Kho đích *</label>
            <select style={inp} value={toId} onChange={e => setToId(Number(e.target.value))}>
              <option value={0}>-- Chọn kho --</option>
              {allWarehouses.filter(w => w.warehouse_id !== myWarehouse.warehouse_id).map(w => (
                <option key={w.warehouse_id} value={w.warehouse_id}>{w.name} — {w.province}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Loại · Ghi chú</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select style={{ ...inp, width: 'auto' }} value={transType} onChange={e => setTransType(e.target.value)}>
                <option value="forward">Forward</option>
                <option value="return">Hoàn hàng</option>
              </select>
              <input style={inp} placeholder="Ghi chú..." value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowForm(false)} style={btn('#E2E8F0', '#475569')}>Hủy</button>
            <button onClick={createTransfer} disabled={saving || !toId} style={btn(saving || !toId ? '#9CA3AF' : C.teal)}>
              {saving ? '...' : '✅ Tạo'}
            </button>
          </div>
        </div>
      )}

      {/* Transfer list */}
      {loading ? (
        <p style={{ color: C.gray, textAlign: 'center', padding: 40 }}>Đang tải...</p>
      ) : transfers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <p style={{ color: C.gray }}>Chưa có chuyến vận chuyển nào phù hợp.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {transfers.map(t => {
            const meta = STATUS_META[t.status] ?? STATUS_META['pending']
            const next = NEXT_STATUS[t.status]
            const isOutgoing = myWarehouse && t.from_warehouse_id === myWarehouse.warehouse_id
            return (
              <div key={t.transfer_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                {/* Direction indicator */}
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  background: isOutgoing ? 'rgba(234,88,12,0.1)' : 'rgba(22,163,74,0.1)',
                }}>
                  {isOutgoing ? '📤' : '📥'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 13 }}>Chuyến #{t.transfer_id}</b>
                    <span style={{ background: meta.bg, color: meta.color, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{meta.label}</span>
                    <span style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 999, padding: '2px 7px', fontSize: 11, color: C.gray }}>
                      {t.transfer_type === 'forward' ? 'Forward' : 'Hoàn hàng'} · {t.package_count} kiện
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.gray }}>
                    <b style={{ color: C.navy }}>{t.from_warehouse}</b> → <b style={{ color: C.teal }}>{t.to_warehouse}</b>
                    {t.note && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>— {t.note}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    Tạo: {fmtDate(t.created_at)}
                    {t.departed_at && <> · Xuất phát: {fmtDate(t.departed_at)}</>}
                    {t.arrived_at  && <> · Đến nơi: {fmtDate(t.arrived_at)}</>}
                  </div>
                </div>

                {next && (
                  <button
                    onClick={() => advance(t)}
                    disabled={advancing === t.transfer_id}
                    style={btn(advancing === t.transfer_id ? '#9CA3AF' : C.teal)}>
                    {advancing === t.transfer_id ? '...' : `→ ${STATUS_META[next]?.label?.replace(/[🚚📦✅⏳❌]\s/, '')}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TransferPage
