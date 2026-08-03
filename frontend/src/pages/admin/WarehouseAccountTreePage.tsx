/**
 * WarehouseAccountTreePage.tsx
 * ─────────────────────────────────────────────────────
 * Quản lý tài khoản kho theo cây đa cấp.
 *
 * So sánh với shop (flat 1 cấp):
 *   Shop  : owner → nhân viên (1 cấp, ShopEmployee)
 *   Kho   : admin → NV mảng kho → kho cấp 1 → cấp 2 → cấp 3
 *             └─ mỗi cấp tạo cấp dưới (created_by chain)
 *             └─ admin thấy toàn bộ cây; sub-manager thấy cây con
 *
 * Mô hình 2 cấp phân quyền (KHÔNG cascading tiếp):
 *   dept     (Quản lý tổng) → tím       — chỉ admin tạo, có đủ 3 quyền tạo hub/district/ward
 *   hub      (cấp 1)        → xanh dương — do dept/admin tạo, LEAF (không tạo thêm)
 *   district (cấp 2)        → cam        — do dept/admin tạo, LEAF
 *   ward     (cấp 3)        → xanh lá    — do dept/admin tạo, LEAF
 */
import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store/store'

// ─── Types ────────────────────────────────────────────────────────────────────
interface WHAccount {
  user_id: number
  email: string | null
  full_name: string
  status: 'active' | 'inactive'
  created_by: number | null
  creator_name: string | null
  created_at: string | null
  permissions: string[]
  tier: 'dept' | 'hub' | 'district' | 'ward'
  tier_label: string
}

interface TreeNode extends WHAccount {
  children: TreeNode[]
  depth: number
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TIER_COLOR: Record<string, string> = {
  hub:      '#1D4ED8',   // blue
  district: '#D97706',   // amber
  ward:     '#16A34A',   // green
  dept:     '#7C3AED',   // purple (NV mảng kho — all 3 perms)
}

const TIER_BG: Record<string, string> = {
  hub:      '#EFF6FF',
  district: '#FFFBEB',
  ward:     '#F0FDF4',
  dept:     '#F5F3FF',
}

const TIER_LABEL: Record<string, string> = {
  dept:     'Quản lý tổng',
  hub:      'Kho tổng (T1)',
  district: 'Kho quận (T2)',
  ward:     'Kho phường (T3)',
}

// Mô hình 2 cấp: chỉ "dept" (Quản lý tổng) mới tạo được hub/district/ward.
// hub/district/ward là leaf — TRỪ KHI dept "mở khoá" riêng cho 1 hub cụ thể
// (xem permsToTiers + nút Cấp/Thu hồi quyền bên dưới).
const CAN_CREATE_TIER: Record<string, string[]> = {
  dept:     ['hub', 'district', 'ward'],
  hub:      [],
  district: [],
  ward:     [],
}

const PERM_TO_TIER: Record<string, string> = {
  warehouse_create_hub:      'hub',
  warehouse_create_district: 'district',
  warehouse_create_ward:     'ward',
}

function permsToTiers(perms: string[]): string[] {
  return perms.map(p => PERM_TO_TIER[p]).filter(Boolean) as string[]
}

// ─── Build tree from flat list ────────────────────────────────────────────────
function buildTree(accounts: WHAccount[], rootCreatorId: number | null): TreeNode[] {
  const map = new Map<number, TreeNode>()
  for (const a of accounts) {
    map.set(a.user_id, { ...a, children: [], depth: 0 })
  }
  const roots: TreeNode[] = []
  for (const node of map.values()) {
    if (node.created_by == null || !map.has(node.created_by)) {
      roots.push(node)
    } else {
      const parent = map.get(node.created_by)!
      parent.children.push(node)
    }
  }
  function setDepth(nodes: TreeNode[], d: number) {
    for (const n of nodes) { n.depth = d; setDepth(n.children, d + 1) }
  }
  setDepth(roots, 0)
  return roots
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const TierBadge: React.FC<{ tier: string }> = ({ tier }) => {
  const color = TIER_COLOR[tier] || TIER_COLOR.ward
  const bg    = TIER_BG[tier]   || TIER_BG.ward
  const label = TIER_LABEL[tier] || tier
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
      background: bg, color, border: `1px solid ${color}33`,
    }}>{label}</span>
  )
}

interface CreateFormProps {
  creatorId: number
  allowedTiers: string[]
  onSuccess: () => void
}

interface WarehouseRow {
  warehouse_id: number
  name: string
  province: string
  tier: number
  parent_warehouse_id: number | null
}
const NUM_TO_TIER: Record<number, string> = { 1: 'hub', 2: 'district', 3: 'ward' }

const CreateForm: React.FC<CreateFormProps> = ({ allowedTiers, onSuccess }) => {
  const [open,     setOpen]     = useState(false)
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [tier,     setTier]     = useState(allowedTiers[0] || '')
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [warehouseId, setWarehouseId] = useState<number | ''>('')
  const [loading,  setLoading]  = useState(false)
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null)

  useEffect(() => {
    if (open && warehouses.length === 0) {
      API.get('/api/v1/warehouses').then(r => setWarehouses(r.data)).catch(() => {})
    }
  }, [open, warehouses.length])

  if (allowedTiers.length === 0) return null

  const byId = new Map(warehouses.map(w => [w.warehouse_id, w]))
  const pathLabel = (w: WarehouseRow): string => {
    const parts = [w.name]
    let p = w.parent_warehouse_id ? byId.get(w.parent_warehouse_id) : null
    while (p) { parts.push(p.name); p = p.parent_warehouse_id ? byId.get(p.parent_warehouse_id) : null }
    return parts.reverse().join(' › ')
  }
  const needsWarehouse = tier !== 'dept'
  const warehouseOptions = warehouses.filter(w => NUM_TO_TIER[w.tier] === tier)

  const submit = async () => {
    if (!username.trim() || !fullName.trim() || !tier) {
      toast.error('Điền đầy đủ thông tin'); return
    }
    if (needsWarehouse && !warehouseId) {
      toast.error('Vui lòng chọn kho phụ trách'); return
    }
    setLoading(true)
    try {
      const res = await API.post('/api/v1/warehouse-accounts', {
        username: username.trim(),
        full_name: fullName.trim(),
        tier,
        warehouse_id: needsWarehouse ? warehouseId : undefined,
      })
      toast.success(`Tạo tài khoản ${TIER_LABEL[tier] || tier} thành công!`)
      setLastCreated({ email: res.data.email, password: res.data.password })
      setUsername(''); setFullName(''); setTier(allowedTiers[0]); setWarehouseId('')
      onSuccess()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Tạo thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{
          fontSize: 12, padding: '4px 12px', borderRadius: 6,
          background: '#1D4ED8', color: '#fff', border: 'none', cursor: 'pointer',
        }}>+ Tạo tài khoản cấp dưới</button>
      ) : (
        <div style={{
          marginTop: 8, padding: '12px 14px', background: '#F8FAFC',
          border: '1px solid #CBD5E1', borderRadius: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1E3A8A', marginBottom: 8 }}>
            Tạo tài khoản kho mới
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Họ tên</div>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A" style={iStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Tài khoản</div>
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder={tier === 'dept' ? 'vd: khoadmin (tối thiểu 6 ký tự)' : 'vd: Kho'} style={iStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Cấp kho</div>
              <select value={tier} onChange={e => { setTier(e.target.value); setWarehouseId('') }}
                style={{ ...iStyle, cursor: 'pointer' }}>
                {allowedTiers.map(t => (
                  <option key={t} value={t}>{TIER_LABEL[t] || t}</option>
                ))}
              </select>
            </div>
            {needsWarehouse && (
              <div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Kho phụ trách</div>
                <select value={warehouseId} onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
                  style={{ ...iStyle, cursor: 'pointer', minWidth: 200 }}>
                  <option value="">-- Chọn kho --</option>
                  {warehouseOptions.map(w => (
                    <option key={w.warehouse_id} value={w.warehouse_id}>{pathLabel(w)}</option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={submit} disabled={loading} style={{
              padding: '7px 16px', borderRadius: 6, background: '#16A34A',
              color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>{loading ? '...' : 'Tạo'}</button>
            <button onClick={() => setOpen(false)} style={{
              padding: '7px 12px', borderRadius: 6, background: '#E2E8F0',
              color: '#64748B', border: 'none', cursor: 'pointer', fontSize: 13,
            }}>Huỷ</button>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
            {tier === 'dept'
              ? <>📌 Email: <b>{username || '...'}</b>@buyzo.com — Mật khẩu: <b>{username || '...'}</b></>
              : <>📌 Email sẽ tự sinh dạng: <b>{username || '...'}</b>cap{warehouseId ? byId.get(Number(warehouseId))?.tier : 'N'}<b>MÃKHO</b>@buyzo.com</>}
          </div>
          {lastCreated && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 6, fontSize: 11 }}>
              ✅ Email: <b>{lastCreated.email}</b> — Mật khẩu: <b>{lastCreated.password}</b>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const iStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1',
  fontSize: 13, outline: 'none', background: '#fff', color: '#1E293B',
}

interface NodeCardProps {
  node: TreeNode
  currentUserId: number
  isAdmin: boolean
  onRefresh: () => void
  onToggle: (userId: number) => void
  onGrantToggle: (node: WHAccount) => void
  onResetPassword: (node: WHAccount) => void
}

const NodeCard: React.FC<NodeCardProps> = ({ node, currentUserId, isAdmin, onRefresh, onToggle, onGrantToggle, onResetPassword }) => {
  const displayTier = node.tier
  const color = TIER_COLOR[displayTier]
  const bg    = TIER_BG[displayTier]
  const unlockedTiers = Array.from(new Set([...(CAN_CREATE_TIER[node.tier] || []), ...permsToTiers(node.permissions)]))
  const canCreate = isAdmin
    ? unlockedTiers
    : (node.user_id === currentUserId ? unlockedTiers : [])
  // Ai được cấp/thu hồi quyền tự tạo cho 1 hub: admin, hoặc chính người đã tạo ra hub đó
  const canManageGrant = displayTier === 'hub' && (isAdmin || node.created_by === currentUserId)
  const hasGrant = node.permissions.includes('warehouse_create_district')
  const hasChildren = node.children.length > 0
  const [collapsed, setCollapsed] = useState(false)

  const indent = node.depth * 28

  return (
    <div style={{ marginLeft: indent, marginBottom: 8 }}>
      {/* Connector line */}
      {node.depth > 0 && (
        <div style={{
          marginLeft: -16, marginBottom: -4,
          borderLeft: `2px dashed ${color}44`, height: 16,
          display: 'inline-block',
        }} />
      )}
      <div style={{
        border: `1.5px solid ${color}33`, borderRadius: 10,
        background: node.status === 'inactive' ? '#F8FAFC' : bg,
        padding: '10px 14px',
        opacity: node.status === 'inactive' ? 0.6 : 1,
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {hasChildren && (
            <button onClick={() => setCollapsed(v => !v)} title={collapsed ? 'Mở rộng cấp dưới' : 'Ẩn cấp dưới'} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#64748B', padding: '2px 4px',
            }}>{collapsed ? '▶' : '▼'}</button>
          )}
          <span style={{ fontSize: 20 }}>
            {displayTier === 'dept' ? '🏢' : displayTier === 'hub' ? '🏭' : displayTier === 'district' ? '🏪' : '🏠'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>
              {node.full_name}
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              📧 {node.email}
            </div>
          </div>
          <TierBadge tier={displayTier} />
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 12,
            background: node.status === 'active' ? '#DCFCE7' : '#FEF2F2',
            color: node.status === 'active' ? '#16A34A' : '#DC2626',
            fontWeight: 600,
          }}>{node.status === 'active' ? 'Hoạt động' : 'Vô hiệu'}</span>
          {canManageGrant && (
            <button onClick={() => onGrantToggle(node)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 6,
              background: hasGrant ? '#FEF2F2' : '#EFF6FF',
              color: hasGrant ? '#DC2626' : '#1D4ED8',
              border: `1px solid ${hasGrant ? '#DC2626' : '#1D4ED8'}44`,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{hasGrant ? '🔓 Thu hồi quyền tạo' : '🔒 Cho phép tạo cấp 2/3'}</button>
          )}
          {(isAdmin || node.created_by === currentUserId) && (
            <button onClick={() => onResetPassword(node)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 6,
              background: '#FFF7ED', color: '#C2410C', border: '1px solid #C2410C44',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>🔑 Reset mật khẩu</button>
          )}
          {isAdmin && (
            <button onClick={() => onToggle(node.user_id)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 6,
              background: node.status === 'active' ? '#FEF2F2' : '#F0FDF4',
              color: node.status === 'active' ? '#DC2626' : '#16A34A',
              border: `1px solid ${node.status === 'active' ? '#DC2626' : '#16A34A'}44`,
              cursor: 'pointer',
            }}>{node.status === 'active' ? 'Vô hiệu' : 'Kích hoạt'}</button>
          )}
        </div>

        {/* Meta */}
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6, display: 'flex', gap: 16 }}>
          {node.creator_name && <span>👤 Tạo bởi: <b style={{ color: '#475569' }}>{node.creator_name}</b></span>}
          {node.created_at  && <span>📅 {new Date(node.created_at).toLocaleDateString('vi-VN')}</span>}
          {node.permissions.length > 0 && (
            <span>🔐 {node.permissions.map(p => p.replace('warehouse_', '')).join(', ')}</span>
          )}
        </div>

        {/* Create sub-account form */}
        <CreateForm
          creatorId={node.user_id}
          allowedTiers={canCreate}
          onSuccess={onRefresh}
        />
      </div>

      {/* Render children */}
      {hasChildren && !collapsed && (
        <div style={{ marginLeft: 14, marginTop: 4, borderLeft: `2px solid ${color}33`, paddingLeft: 12 }}>
          {node.children.map(child => (
            <NodeCard key={child.user_id} node={child} currentUserId={currentUserId}
              isAdmin={isAdmin} onRefresh={onRefresh} onToggle={onToggle} onGrantToggle={onGrantToggle}
              onResetPassword={onResetPassword} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const WarehouseAccountTreePage: React.FC = () => {
  const currentUser = useSelector((s: RootState) => s.auth.user)
  const [accounts, setAccounts] = useState<WHAccount[]>([])
  const [loading,  setLoading]  = useState(true)
  const [tree,     setTree]     = useState<TreeNode[]>([])

  const isAdmin = currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('superadmin') || false

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await API.get('/api/v1/warehouse-accounts')
      setAccounts(res.data)
    } catch {
      toast.error('Không tải được danh sách tài khoản kho')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = buildTree(accounts, currentUser?.user_id ?? null)
    setTree(t)
  }, [accounts, currentUser])

  const handleToggle = async (userId: number) => {
    try {
      const res = await API.patch(`/api/v1/warehouse-accounts/${userId}/status`)
      toast.success(`Đã ${res.data.status === 'active' ? 'kích hoạt' : 'vô hiệu hoá'} tài khoản`)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Thao tác thất bại')
    }
  }

  const handleGrantToggle = async (acc: WHAccount) => {
    const currentlyAllowed = acc.permissions.includes('warehouse_create_district')
    try {
      await API.patch(`/api/v1/warehouse-accounts/${acc.user_id}/grant-create`, { allow: !currentlyAllowed })
      toast.success(currentlyAllowed ? 'Đã thu hồi quyền tự tạo tài khoản' : 'Đã cấp quyền tự tạo tài khoản District/Ward')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Thao tác thất bại')
    }
  }

  const handleResetPassword = async (acc: WHAccount) => {
    if (!window.confirm(`Đặt lại mật khẩu về mặc định cho ${acc.full_name}?`)) return
    try {
      const res = await API.post(`/api/v1/warehouse-accounts/${acc.user_id}/reset-password`)
      toast.success(`Mật khẩu mới: ${res.data.password}`, { autoClose: 10000 })
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Đặt lại mật khẩu thất bại')
    }
  }

  // Admin tạo được mọi tier, kể cả "dept" (Quản lý tổng)
  const adminCanCreate = isAdmin ? ['dept', 'hub', 'district', 'ward'] : []

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', margin: 0 }}>
          🏭 Cây Tài Khoản Kho
        </h1>
        <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
          Mô hình 2 cấp phân quyền — Admin thấy toàn bộ; Quản lý tổng thấy tài khoản do mình tạo.
        </p>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { key: 'dept', label: 'Quản lý tổng (được tạo T1/T2/T3)' },
            { key: 'hub',  label: 'Kho tổng (T1) — Leaf' },
            { key: 'district', label: 'Kho quận (T2) — Leaf' },
            { key: 'ward', label: 'Kho phường (T3) — Leaf' },
          ].map(({ key, label }) => (
            <span key={key} style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 20,
              background: TIER_BG[key], color: TIER_COLOR[key],
              border: `1px solid ${TIER_COLOR[key]}33`, fontWeight: 600,
            }}>{label}</span>
          ))}
        </div>

        {/* Explanation box */}
        <div style={{
          marginTop: 14, padding: '10px 14px', background: '#F0F9FF',
          border: '1px solid #BAE6FD', borderRadius: 8, fontSize: 13, color: '#0369A1',
        }}>
          <b>Cách hoạt động:</b> Khác với Shop (owner → nhân viên, 1 cấp),
          hệ thống kho có <b>2 cấp uỷ quyền, không cascading tiếp</b>:
          Admin tạo <b>Quản lý tổng</b> → Quản lý tổng (hoặc admin) tạo tài khoản Kho cấp 1/2/3 →
          các tài khoản cấp 1/2/3 này KHÔNG tạo thêm được ai khác (leaf), trừ khi được
          cấp riêng quyền tự tạo. Email tự động sinh theo dạng <b>tài khoản@buyzo.com</b>,
          mật khẩu mặc định trùng với tên tài khoản.
        </div>
      </div>

      {/* Admin root create form */}
      {isAdmin && (
        <div style={{
          marginBottom: 24, padding: '14px 16px', background: '#F5F3FF',
          border: '1px solid #7C3AED33', borderRadius: 10,
        }}>
          <div style={{ fontWeight: 700, color: '#7C3AED', fontSize: 14, marginBottom: 4 }}>
            👑 Admin — Tạo tài khoản kho cấp đầu tiên
          </div>
          <CreateForm creatorId={currentUser?.user_id ?? 0} allowedTiers={adminCanCreate} onSuccess={load} />
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['dept', 'hub', 'district', 'ward'] as const).map(tier => {
          const count = accounts.filter(a => a.tier === tier).length
          return (
            <div key={tier} style={{
              padding: '10px 16px', borderRadius: 8, background: TIER_BG[tier],
              border: `1px solid ${TIER_COLOR[tier]}33`, minWidth: 100,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: TIER_COLOR[tier] }}>{count}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                {TIER_LABEL[tier]}
              </div>
            </div>
          )
        })}
        <div style={{
          padding: '10px 16px', borderRadius: 8, background: '#F8FAFC',
          border: '1px solid #CBD5E1', minWidth: 100,
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#64748B' }}>{accounts.length}</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>Tổng cộng</div>
        </div>
      </div>

      {/* Tree */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Đang tải...</div>
      ) : tree.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 40, color: '#94A3B8',
          border: '2px dashed #E2E8F0', borderRadius: 12,
        }}>
          Chưa có tài khoản kho nào. Nhấn "Tạo tài khoản" để bắt đầu.
        </div>
      ) : (
        <div>
          {tree.map(node => (
            <NodeCard
              key={node.user_id}
              node={node}
              currentUserId={currentUser?.user_id ?? 0}
              isAdmin={isAdmin}
              onRefresh={load}
              onToggle={handleToggle}
              onGrantToggle={handleGrantToggle}
              onResetPassword={handleResetPassword}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default WarehouseAccountTreePage
