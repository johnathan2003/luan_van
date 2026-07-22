/**
 * WarehouseHierarchyPage.tsx — Admin xem cây kho 3 tầng + quản lý transfer + gán manager
 * ---------------------------------------------------------------------------
 * GET  /api/v1/warehouses/hierarchy          — cây tier1→tier2→tier3
 * GET  /api/v1/warehouses/transfers          — danh sách transfer
 * POST /api/v1/warehouses/transfers          — tạo transfer
 * PUT  /api/v1/warehouses/transfers/{id}/status
 * GET  /api/v1/admin/users/search?q=         — tìm user để gán manager
 * POST /api/v1/admin/warehouse-managers/assign
 * DELETE /api/v1/admin/warehouse-managers/{user_id}/unassign
 * GET  /api/v1/admin/warehouse-managers      — danh sách tất cả manager
 */
import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'

// ── Types ─────────────────────────────────────────────────────────────────────
interface WarehouseNode {
  warehouse_id: number
  name: string
  tier: number
  province: string
  address: string | null
  district: string | null
  ward: string | null
  parent_warehouse_id: number | null
  manager_id: number | null
  manager_name: string | null
  is_active: boolean
  shipments_count: number
  children: WarehouseNode[]
}
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
interface UserSearchResult {
  user_id: number
  full_name: string
  email: string
  phone: string | null
}
interface ManagerRecord {
  user_id: number
  full_name: string
  email: string | null
  warehouse_id: number
  warehouse_name: string
  tier: number
  role_name: string
}

// ── Colors ─────────────────────────────────────────────────────────────────────
const TIER_STYLE: Record<number, { bg: string; color: string; label: string; indent: number }> = {
  1: { bg: '#1E3A5F', color: 'white',   label: 'Tier 1 — Liên vùng',  indent: 0  },
  2: { bg: '#0D9488', color: 'white',   label: 'Tier 2 — Phân phối',  indent: 24 },
  3: { bg: '#f0fdf4', color: '#15803d', label: 'Tier 3 — Tập kết',    indent: 48 },
}
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: '⏳ Chờ',            color: '#D97706', bg: 'rgba(217,119,6,0.1)'   },
  in_transit: { label: '🚚 Đang vận chuyển', color: '#2563EB', bg: 'rgba(37,99,235,0.1)'  },
  arrived:    { label: '📦 Đã đến',         color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  completed:  { label: '✅ Hoàn thành',     color: '#16A34A', bg: 'rgba(22,163,74,0.1)'  },
  cancelled:  { label: '❌ Huỷ',            color: '#DC2626', bg: 'rgba(220,38,38,0.1)'  },
}
const NEXT_STATUS: Record<string, string> = {
  pending: 'in_transit', in_transit: 'arrived', arrived: 'completed',
}
const C = { gray: 'var(--text-secondary)', border: 'var(--border-subtle)', card: 'var(--bg-card)' }
const btn = (bg: string, color = 'white', extra?: React.CSSProperties): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 7, padding: '6px 13px',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', ...extra,
})
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Assign Manager Modal ───────────────────────────────────────────────────────
const AssignManagerModal: React.FC<{
  warehouse: WarehouseNode
  onClose: () => void
  onAssigned: (wId: number, userId: number, userName: string) => void
}> = ({ warehouse, onClose, onAssigned }) => {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<UserSearchResult[]>([])
  const [selected, setSelected] = useState<UserSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving]     = useState(false)

  const TIER_ROLE: Record<number, string> = {
    1: 'warehouse_hub_manager',
    2: 'warehouse_district_manager',
    3: 'warehouse_ward_manager',
  }

  const search = async (q: string) => {
    setQuery(q)
    setSelected(null)
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const r: any = await API.get('/api/v1/admin/users/search', { params: { q } })
      setResults(r.data?.users ?? [])
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }

  const assign = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await API.post('/api/v1/admin/warehouse-managers/assign', {
        user_id: selected.user_id,
        warehouse_id: warehouse.warehouse_id,
      })
      toast.success(`Đã gán ${selected.full_name} làm quản lý ${warehouse.name}`)
      onAssigned(warehouse.warehouse_id, selected.user_id, selected.full_name)
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi gán manager')
    } finally { setSaving(false) }
  }

  const tierStyle = TIER_STYLE[warehouse.tier] ?? TIER_STYLE[3]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 28, maxWidth: 460, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontWeight: 800, color: '#1E3A5F', margin: 0 }}>👤 Gán quản lý kho</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <div style={{ background: tierStyle.bg, color: tierStyle.color, borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              Tier {warehouse.tier}
            </div>
            <span style={{ fontWeight: 700, color: '#1E3A5F', fontSize: 15 }}>{warehouse.name}</span>
          </div>
          {warehouse.manager_name && (
            <p style={{ fontSize: 12, color: '#64748B', margin: '6px 0 0' }}>
              Manager hiện tại: <strong>{warehouse.manager_name}</strong> (sẽ bị thay thế)
            </p>
          )}
          <p style={{ fontSize: 11, color: '#64748B', margin: '4px 0 0' }}>
            Role sẽ gán: <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{TIER_ROLE[warehouse.tier]}</code>
          </p>
        </div>

        {/* Search */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>
          Tìm người dùng (tên hoặc email)
        </label>
        <input
          value={query}
          onChange={e => search(e.target.value)}
          placeholder="VD: Nguyễn Văn A hoặc a@email.com"
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
        />

        {/* Results */}
        {searching && <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 8px' }}>Đang tìm...</p>}
        {results.length > 0 && !selected && (
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 9, overflow: 'hidden', marginBottom: 12 }}>
            {results.map(u => (
              <div key={u.user_id}
                onClick={() => { setSelected(u); setResults([]) }}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#1E3A8A', margin: 0 }}>{u.full_name}</p>
                <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
              </div>
            ))}
          </div>
        )}

        {/* Selected user */}
        {selected && (
          <div style={{ background: '#EFF6FF', border: '2px solid #BFDBFE', borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: 14, color: '#1E3A8A', margin: 0 }}>✓ {selected.full_name}</p>
              <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>{selected.email}</p>
            </div>
            <button onClick={() => { setSelected(null); setQuery('') }}
              style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>
            Hủy
          </button>
          <button onClick={assign} disabled={!selected || saving}
            style={{ flex: 2, padding: '10px', background: !selected || saving ? '#94A3B8' : '#0D9488', color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, cursor: selected && !saving ? 'pointer' : 'default' }}>
            {saving ? '⏳ Đang gán...' : '✓ Xác nhận gán'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Warehouse node (recursive) ────────────────────────────────────────────────
const WarehouseCard: React.FC<{
  node: WarehouseNode
  onSelectTransfer: (w: WarehouseNode) => void
  onSelectManager: (w: WarehouseNode) => void
}> = ({ node, onSelectTransfer, onSelectManager }) => {
  const [expanded, setExpanded] = useState(node.tier < 3)
  const style = TIER_STYLE[node.tier] ?? TIER_STYLE[3]
  const hasChildren = node.children.length > 0
  const noManager = !node.manager_name

  return (
    <div style={{ marginLeft: style.indent, marginBottom: 6 }}>
      <div
        style={{
          background: style.bg, color: style.color, borderRadius: 10, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10, cursor: hasChildren ? 'pointer' : 'default',
          border: node.tier === 3 ? '1px solid #bbf7d0' : 'none',
        }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && <span style={{ fontSize: 12, opacity: 0.7 }}>{expanded ? '▼' : '▶'}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            {node.name}
            {noManager && (
              <span title="Chưa có manager" style={{ fontSize: 14 }}>⚠️</span>
            )}
          </div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>
            {node.province}{node.district ? ` · ${node.district}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {node.shipments_count > 0 && (
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
              {node.shipments_count} đơn
            </span>
          )}
          {node.manager_name ? (
            <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>👤 {node.manager_name}</div>
          ) : (
            <div style={{ fontSize: 10, color: '#FCA5A5', marginTop: 2 }}>Chưa có manager</div>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onSelectManager(node) }}
          style={{ background: 'rgba(255,255,255,0.15)', color: style.color, border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          👤 Gán manager
        </button>
        <button
          onClick={e => { e.stopPropagation(); onSelectTransfer(node) }}
          style={{ background: 'rgba(255,255,255,0.12)', color: style.color, border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer' }}>
          🚚 Transfer
        </button>
      </div>
      {expanded && node.children.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {node.children.map(c => (
            <WarehouseCard key={c.warehouse_id} node={c} onSelectTransfer={onSelectTransfer} onSelectManager={onSelectManager} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Create transfer modal ─────────────────────────────────────────────────────
const CreateTransferModal: React.FC<{
  fromWarehouse: WarehouseNode
  allWarehouses: WarehouseNode[]
  onClose: () => void
  onCreated: () => void
}> = ({ fromWarehouse, allWarehouses, onClose, onCreated }) => {
  const [toId,   setToId]   = useState<number>(0)
  const [type,   setType]   = useState('forward')
  const [note,   setNote]   = useState('')
  const [saving, setSaving] = useState(false)

  const flatAll: { id: number; name: string; tier: number }[] = []
  const flatten = (nodes: WarehouseNode[]) => nodes.forEach(n => { flatAll.push({ id: n.warehouse_id, name: n.name, tier: n.tier }); flatten(n.children) })
  flatten(allWarehouses)
  const options = flatAll.filter(w => w.id !== fromWarehouse.warehouse_id)

  const save = async () => {
    if (!toId) { toast.error('Chọn kho đích'); return }
    setSaving(true)
    try {
      await API.post('/api/v1/warehouses/transfers', {
        from_warehouse_id: fromWarehouse.warehouse_id,
        to_warehouse_id: toId,
        transfer_type: type,
        note: note || null,
      })
      toast.success('✅ Đã tạo chuyến vận chuyển')
      onCreated(); onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Lỗi tạo transfer')
    } finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 11px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, maxWidth: 420, width: '90%' }}>
        <h3 style={{ margin: '0 0 16px' }}>🚚 Tạo Transfer từ {fromWarehouse.name}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Kho đích *</label>
            <select style={inp} value={toId} onChange={e => setToId(Number(e.target.value))}>
              <option value={0}>-- Chọn kho --</option>
              {options.map(w => <option key={w.id} value={w.id}>[T{w.tier}] {w.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Loại vận chuyển</label>
            <select style={inp} value={type} onChange={e => setType(e.target.value)}>
              <option value="forward">Forward (thuận chiều)</option>
              <option value="return">Return (hoàn hàng)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Ghi chú</label>
            <input style={inp} value={note} onChange={e => setNote(e.target.value)} placeholder="Tuỳ chọn..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('transparent', C.gray)}>Hủy</button>
          <button onClick={save} disabled={saving || !toId} style={btn(saving || !toId ? '#9CA3AF' : '#0D9488')}>
            {saving ? 'Đang tạo...' : '✅ Tạo transfer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Manager List Tab ───────────────────────────────────────────────────────────
const ManagerListTab: React.FC = () => {
  const [managers, setManagers] = useState<ManagerRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [removing, setRemoving] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    API.get('/api/v1/admin/warehouse-managers')
      .then((r: any) => setManagers(r.data?.managers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const unassign = async (m: ManagerRecord) => {
    if (!window.confirm(`Gỡ ${m.full_name} khỏi kho ${m.warehouse_name}?`)) return
    setRemoving(m.user_id)
    try {
      await API.delete(`/api/v1/admin/warehouse-managers/${m.user_id}/unassign`)
      toast.success(`Đã gỡ ${m.full_name}`)
      setManagers(ms => ms.filter(x => x.user_id !== m.user_id))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi gỡ manager')
    } finally { setRemoving(null) }
  }

  if (loading) return <p style={{ color: C.gray, textAlign: 'center', padding: 40 }}>Đang tải...</p>

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F8FAFC' }}>
            {['Người quản lý', 'Email', 'Kho phụ trách', 'Tier', 'Role', 'Hành động'].map(h => (
              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {managers.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Chưa có manager nào được gán</td></tr>
          ) : managers.map(m => {
            const tierStyle = TIER_STYLE[m.tier] ?? TIER_STYLE[3]
            return (
              <tr key={m.user_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, color: '#1E3A8A' }}>{m.full_name}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748B' }}>{m.email ?? '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#0D9488', fontWeight: 600 }}>🏭 {m.warehouse_name}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: tierStyle.bg, color: tierStyle.color, borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                    Tier {m.tier}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748B' }}>
                  <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{m.role_name}</code>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => unassign(m)}
                    disabled={removing === m.user_id}
                    style={{ padding: '5px 12px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {removing === m.user_id ? '⏳...' : 'Gỡ quyền'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const WarehouseHierarchyPage: React.FC = () => {
  const [tab, setTab] = useState<'tree' | 'transfers' | 'managers'>('tree')
  const [tree,      setTree]      = useState<WarehouseNode[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [treeTotal,  setTreeTotal]  = useState(0)
  const [transTotal, setTransTotal] = useState(0)
  const [tLoading,  setTLoading]  = useState(false)
  const [trLoading, setTrLoading] = useState(false)
  const [transFilter, setTransFilter] = useState('')
  const [selectedTransfer, setSelectedTransfer] = useState<WarehouseNode | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [selectedManager, setSelectedManager]   = useState<WarehouseNode | null>(null)
  const [showManagerModal, setShowManagerModal]  = useState(false)
  const [advancing, setAdvancing] = useState<number | null>(null)

  const loadTree = useCallback(async () => {
    setTLoading(true)
    try {
      const r = await API.get('/api/v1/warehouses/hierarchy')
      setTree(r.data.warehouses)
      setTreeTotal(r.data.total)
    } catch { /* ignore */ }
    finally { setTLoading(false) }
  }, [])

  const loadTransfers = useCallback(async () => {
    setTrLoading(true)
    try {
      const params: any = { limit: 30 }
      if (transFilter) params.status = transFilter
      const r = await API.get('/api/v1/warehouses/transfers', { params })
      setTransfers(r.data.transfers)
      setTransTotal(r.data.total)
    } catch { /* ignore */ }
    finally { setTrLoading(false) }
  }, [transFilter])

  useEffect(() => { loadTree() }, [])
  useEffect(() => { if (tab === 'transfers') loadTransfers() }, [tab, loadTransfers])

  const advance = async (t: Transfer) => {
    const next = NEXT_STATUS[t.status]
    if (!next) return
    setAdvancing(t.transfer_id)
    try {
      await API.put(`/api/v1/warehouses/transfers/${t.transfer_id}/status`, { status: next })
      toast.success(`Chuyển sang: ${STATUS_META[next]?.label ?? next}`)
      loadTransfers()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Lỗi cập nhật status')
    } finally { setAdvancing(null) }
  }

  // Update tree in-memory after assigning a manager
  const patchManagerInTree = (nodes: WarehouseNode[], wId: number, userId: number, userName: string): WarehouseNode[] =>
    nodes.map(n => n.warehouse_id === wId
      ? { ...n, manager_id: userId, manager_name: userName }
      : { ...n, children: patchManagerInTree(n.children, wId, userId, userName) }
    )

  const handleManagerAssigned = (wId: number, userId: number, userName: string) => {
    setTree(prev => patchManagerInTree(prev, wId, userId, userName))
  }

  const tabBtn = (t: typeof tab): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', background: tab === t ? '#1E3A5F' : 'transparent', color: tab === t ? 'white' : C.gray,
  })

  const flatWarehouse: WarehouseNode[] = []
  const flatAll = (nodes: WarehouseNode[]) => nodes.forEach(n => { flatWarehouse.push(n); flatAll(n.children) })
  flatAll(tree)

  // Count unmanaged warehouses
  const unmanagedCount = flatWarehouse.filter(w => !w.manager_id).length

  return (
    <div style={{ maxWidth: 1000 }}>
      <h2 style={{ marginBottom: 4 }}>🏭 Kho hàng 3 tầng</h2>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>
        Xem phân cấp kho, gán manager và quản lý chuyến vận chuyển nội kho.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={tabBtn('tree')} onClick={() => setTab('tree')}>
          🌲 Cây kho ({treeTotal})
          {unmanagedCount > 0 && (
            <span style={{ marginLeft: 6, background: '#FCA5A5', color: '#DC2626', borderRadius: 999, padding: '1px 6px', fontSize: 11, fontWeight: 800 }}>
              ⚠️{unmanagedCount}
            </span>
          )}
        </button>
        <button style={tabBtn('transfers')} onClick={() => setTab('transfers')}>🚚 Chuyến vận chuyển ({transTotal})</button>
        <button style={tabBtn('managers')} onClick={() => setTab('managers')}>👤 Danh sách Manager</button>
      </div>

      {/* ── TREE TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'tree' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {[1, 2, 3].map(tier => {
              const s = TIER_STYLE[tier]
              return (
                <div key={tier} style={{ background: s.bg, color: s.color, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, border: tier === 3 ? '1px solid #bbf7d0' : 'none' }}>
                  {s.label}
                </div>
              )
            })}
            {unmanagedCount > 0 && (
              <div style={{ background: '#FEF3C7', color: '#D97706', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>
                ⚠️ {unmanagedCount} kho chưa có manager
              </div>
            )}
            <button onClick={loadTree} style={{ ...btn('#E2E8F0', '#475569'), marginLeft: 'auto' }}>🔄 Làm mới</button>
          </div>

          {tLoading ? (
            <p style={{ color: C.gray, textAlign: 'center', padding: 40 }}>Đang tải...</p>
          ) : tree.length === 0 ? (
            <p style={{ color: C.gray, textAlign: 'center', padding: 40 }}>Chưa có kho nào.</p>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              {tree.map(node => (
                <WarehouseCard
                  key={node.warehouse_id}
                  node={node}
                  onSelectTransfer={w => { setSelectedTransfer(w); setShowTransferModal(true) }}
                  onSelectManager={w => { setSelectedManager(w); setShowManagerModal(true) }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TRANSFERS TAB ────────────────────────────────────────────────────── */}
      {tab === 'transfers' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {['', 'pending', 'in_transit', 'arrived', 'completed'].map(s => (
              <button key={s} onClick={() => setTransFilter(s)}
                style={{ ...btn(transFilter === s ? '#1E3A5F' : 'transparent', transFilter === s ? 'white' : C.gray), border: `1px solid ${transFilter === s ? '#1E3A5F' : C.border}` }}>
                {s === '' ? '📋 Tất cả' : (STATUS_META[s]?.label ?? s)}
              </button>
            ))}
            <button onClick={loadTransfers} style={{ ...btn('#E2E8F0', '#475569'), marginLeft: 'auto' }}>🔄</button>
          </div>

          {trLoading ? (
            <p style={{ color: C.gray, textAlign: 'center', padding: 30 }}>Đang tải...</p>
          ) : transfers.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
              <p style={{ color: C.gray }}>Chưa có chuyến vận chuyển nào.</p>
              <p style={{ color: C.gray, fontSize: 12 }}>Vào tab Cây kho, click "Transfer" trên một kho để tạo chuyến.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {transfers.map(t => {
                const meta = STATUS_META[t.status] ?? STATUS_META['pending']
                const next = NEXT_STATUS[t.status]
                return (
                  <div key={t.transfer_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <b style={{ fontSize: 13 }}>#{t.transfer_id}</b>
                        <span style={{ background: meta.bg, color: meta.color, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{meta.label}</span>
                        <span style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 999, padding: '2px 7px', fontSize: 11, color: C.gray }}>
                          {t.transfer_type === 'forward' ? '→ Thuận' : '← Hoàn'}
                        </span>
                        <span style={{ fontSize: 11, color: C.gray }}>{t.package_count} kiện</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.gray }}>
                        <b style={{ color: '#1E3A5F' }}>{t.from_warehouse}</b> → <b style={{ color: '#0D9488' }}>{t.to_warehouse}</b>
                        {t.note && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>— {t.note}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                        Tạo: {fmtDate(t.created_at)}
                        {t.departed_at && <> · Xuất phát: {fmtDate(t.departed_at)}</>}
                        {t.arrived_at && <> · Đến nơi: {fmtDate(t.arrived_at)}</>}
                      </div>
                    </div>
                    {next && (
                      <button
                        onClick={() => advance(t)}
                        disabled={advancing === t.transfer_id}
                        style={btn(advancing === t.transfer_id ? '#9CA3AF' : (STATUS_META[next]?.color ?? '#1E3A5F'))}>
                        {advancing === t.transfer_id ? '...' : `→ ${STATUS_META[next]?.label?.replace(/[🚚📦✅⏳❌]\s/, '') ?? next}`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MANAGERS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'managers' && <ManagerListTab />}

      {/* Transfer modal */}
      {showTransferModal && selectedTransfer && (
        <CreateTransferModal
          fromWarehouse={selectedTransfer}
          allWarehouses={flatWarehouse}
          onClose={() => setShowTransferModal(false)}
          onCreated={() => { loadTransfers(); setTab('transfers') }}
        />
      )}

      {/* Assign Manager modal */}
      {showManagerModal && selectedManager && (
        <AssignManagerModal
          warehouse={selectedManager}
          onClose={() => setShowManagerModal(false)}
          onAssigned={handleManagerAssigned}
        />
      )}
    </div>
  )
}

export default WarehouseHierarchyPage
