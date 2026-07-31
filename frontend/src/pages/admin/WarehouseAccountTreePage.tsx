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
 * Tier & màu:
 *   hub      (cấp 1) → xanh dương  — có 3 quyền tạo
 *   district (cấp 2) → cam         — có 2 quyền tạo
 *   ward     (cấp 3) → xanh lá     — leaf, không tạo thêm
 *   dept     (NV mảng kho)→ tím    — có đủ 3 quyền, do admin tạo
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
  tier: 'hub' | 'district' | 'ward'
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
  hub:      'Kho tổng (T1)',
  district: 'Kho quận (T2)',
  ward:     'Kho phường (T3)',
}

const CAN_CREATE_TIER: Record<string, string[]> = {
  hub:      ['hub', 'district', 'ward'],
  district: ['district', 'ward'],
  ward:     [],
}

function inferDisplayTier(perms: string[]): string {
  const hasHub  = perms.includes('warehouse_create_hub')
  const hasDist = perms.includes('warehouse_create_district')
  const hasWard = perms.includes('warehouse_create_ward')
  if (hasHub && hasDist && hasWard) return 'dept'  // NV mảng kho (full perms)
  if (hasHub)  return 'hub'
  if (hasDist) return 'district'
  if (hasWard) return 'ward'
  return 'ward'
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
  const dt = inferDisplayTier(['warehouse_create_' + tier]) === 'dept' ? 'dept' : tier
  const color = TIER_COLOR[dt] || TIER_COLOR.ward
  const bg    = TIER_BG[dt]   || TIER_BG.ward
  const label = tier === 'dept' ? 'NV Mảng kho' : (TIER_LABEL[tier] || tier)
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

const CreateForm: React.FC<CreateFormProps> = ({ allowedTiers, onSuccess }) => {
  const [open,     setOpen]     = useState(false)
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [tier,     setTier]     = useState(allowedTiers[0] || '')
  const [loading,  setLoading]  = useState(false)

  if (allowedTiers.length === 0) return null

  const submit = async () => {
    if (!username.trim() || !fullName.trim() || !tier) {
      toast.error('Điền đầy đủ thông tin'); return
    }
    setLoading(true)
    try {
      await API.post('/admin/warehouse-accounts', {
        username: username.trim(),
        full_name: fullName.trim(),
        tier,
      })
      toast.success(`Tạo tài khoản ${TIER_LABEL[tier] || tier} thành công!`)
      setUsername(''); setFullName(''); setTier(allowedTiers[0])
      setOpen(false)
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
            Tạo tài khoản kho mới (username = password)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Username</div>
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder="vd: khoq1" style={iStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Họ tên</div>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A" style={iStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Cấp kho</div>
              <select value={tier} onChange={e => setTier(e.target.value)}
                style={{ ...iStyle, cursor: 'pointer' }}>
                {allowedTiers.map(t => (
                  <option key={t} value={t}>{TIER_LABEL[t] || t}</option>
                ))}
              </select>
            </div>
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
            📌 Email: <b>{username || '...'}</b>@kho.test — Mật khẩu: <b>{username || '...'}</b>
          </div>
        </div>
      )}
    </div>
  )
}

const iStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1',
  fontSize: 13, outline: 'none', background: '#fff',
}

interface NodeCardProps {
  node: TreeNode
  currentUserId: number
  isAdmin: boolean
  onRefresh: () => void
  onToggle: (userId: number) => void
}

const NodeCard: React.FC<NodeCardProps> = ({ node, currentUserId, isAdmin, onRefresh, onToggle }) => {
  const displayTier = inferDisplayTier(node.permissions)
  const color = TIER_COLOR[displayTier]
  const bg    = TIER_BG[displayTier]
  const canCreate = isAdmin
    ? CAN_CREATE_TIER[node.tier] || []
    : (node.user_id === currentUserId ? CAN_CREATE_TIER[node.tier] || [] : [])

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
          <span style={{ fontSize: 20 }}>
            {displayTier === 'dept' ? '🏢' : displayTier === 'hub' ? '🏭' : displayTier === 'district' ? '🏪' : '🏠'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>
              {node.full_name}
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              📧 {node.email} &nbsp;|&nbsp; 🔑 password: <b>{node.email?.split('@')[0]}</b>
            </div>
          </div>
          <TierBadge tier={displayTier} />
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 12,
            background: node.status === 'active' ? '#DCFCE7' : '#FEF2F2',
            color: node.status === 'active' ? '#16A34A' : '#DC2626',
            fontWeight: 600,
          }}>{node.status === 'active' ? 'Hoạt động' : 'Vô hiệu'}</span>
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
      {node.children.length > 0 && (
        <div style={{ marginLeft: 14, marginTop: 4, borderLeft: `2px solid ${color}33`, paddingLeft: 12 }}>
          {node.children.map(child => (
            <NodeCard key={child.user_id} node={child} currentUserId={currentUserId}
              isAdmin={isAdmin} onRefresh={onRefresh} onToggle={onToggle} />
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
      const res = await API.get('/admin/warehouse-accounts')
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
      const res = await API.patch(`/admin/warehouse-accounts/${userId}/status`)
      toast.success(`Đã ${res.data.status === 'active' ? 'kích hoạt' : 'vô hiệu hoá'} tài khoản`)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Thao tác thất bại')
    }
  }

  // Determine what admin themselves can create (all 3 tiers)
  const adminCanCreate = isAdmin ? ['hub', 'district', 'ward'] : []

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', margin: 0 }}>
          🏭 Cây Tài Khoản Kho
        </h1>
        <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
          Hệ thống tài khoản kho đa cấp — Admin thấy toàn bộ cây; mỗi cấp chỉ thấy cây con do mình tạo.
        </p>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { key: 'dept', label: 'NV Mảng kho (tất cả quyền)' },
            { key: 'hub',  label: 'Kho tổng (T1)' },
            { key: 'district', label: 'Kho quận (T2)' },
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
          hệ thống kho cho phép <b>uỷ quyền theo chuỗi</b>:
          Admin tạo NV quản lý mảng kho → NV tạo quản lý kho cấp 1/2/3 → cấp 1 tạo thêm cấp 2/3 → ...
          Mỗi tài khoản dùng <b>username = password</b> để dễ nhớ.
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
          const count = accounts.filter(a => inferDisplayTier(a.permissions) === tier).length
          return (
            <div key={tier} style={{
              padding: '10px 16px', borderRadius: 8, background: TIER_BG[tier],
              border: `1px solid ${TIER_COLOR[tier]}33`, minWidth: 100,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: TIER_COLOR[tier] }}>{count}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                {tier === 'dept' ? 'NV mảng kho' : TIER_LABEL[tier]}
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
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default WarehouseAccountTreePage
