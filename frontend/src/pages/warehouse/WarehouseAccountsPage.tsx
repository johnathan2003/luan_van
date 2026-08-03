/**
 * WarehouseAccountsPage.tsx
 * ─────────────────────────────────────────────────────
 * Trang cho "Quản lý tổng" (role warehouse_manager) tạo tài khoản
 * Kho cấp 1 (Hub) / cấp 2 (District) / cấp 3 (Ward).
 *
 * Mô hình 2 cấp phân quyền, mặc định KHÔNG cascading tiếp:
 *   Admin tạo Quản lý tổng → Quản lý tổng tạo Hub/District/Ward (leaf)
 * Ngoại lệ: Quản lý tổng có thể "mở khoá" cho MỘT Hub (Tier 1) do chính
 * mình tạo được tự tạo tài khoản District/Ward — bật/tắt qua nút bên dưới.
 *
 * Quản lý tổng phụ trách TOÀN BỘ hệ thống kho (không gắn 1 kho cụ thể) —
 * trang này vì vậy hiển thị đầy đủ cây kho thật của BuyZo (không lọc),
 * và khi tạo tài khoản Hub/District/Ward, admin/Tổng kho chọn đúng 1 kho
 * thật (không chỉ chọn cấp trừu tượng) — tài khoản mới được gắn thẳng vào
 * kho đó (WarehouseManager), email tự sinh theo mã kho.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'

interface UserSearchResult {
  user_id: number
  full_name: string
  email: string
  phone: string | null
}

interface WHAccount {
  user_id: number
  email: string | null
  full_name: string
  status: 'active' | 'inactive'
  created_at: string | null
  tier: 'dept' | 'hub' | 'district' | 'ward'
  tier_label: string
  permissions: string[]
  warehouse_id: number | null
  warehouse_name: string | null
}

interface WarehouseRow {
  warehouse_id: number
  name: string
  province: string
  district: string | null
  ward: string | null
  tier: number
  parent_warehouse_id: number | null
  is_active: boolean
  manager_count: number
}

const TIER_COLOR: Record<string, string> = {
  hub:      '#1D4ED8',
  district: '#D97706',
  ward:     '#16A34A',
}
const TIER_BG: Record<string, string> = {
  hub:      '#EFF6FF',
  district: '#FFFBEB',
  ward:     '#F0FDF4',
}
const TIER_ICON: Record<string, string> = { hub: '🏭', district: '🏪', ward: '🏠' }
const TIER_LABEL: Record<string, string> = {
  hub:      'Kho tổng (Tier 1)',
  district: 'Kho quận (Tier 2)',
  ward:     'Kho phường (Tier 3)',
}
const NUM_TO_TIER: Record<number, 'hub' | 'district' | 'ward'> = { 1: 'hub', 2: 'district', 3: 'ward' }

const iStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1',
  fontSize: 13, outline: 'none', background: '#fff', color: '#1E293B',
}

const WarehouseAccountsPage: React.FC = () => {
  const [accounts, setAccounts]     = useState<WHAccount[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [loading,  setLoading]      = useState(true)
  const [username, setUsername]     = useState('')
  const [fullName, setFullName]     = useState('')
  const [warehouseId, setWarehouseId] = useState<number | ''>('')
  const [creating, setCreating]     = useState(false)
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null)
  const [collapsed, setCollapsed]   = useState<Set<number>>(new Set())

  // Gán người dùng có sẵn (thay vì tạo mới)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [query, setQuery]         = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [selectedUser, setSelectedUser]   = useState<UserSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const toggleCollapse = (id: number) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [accRes, whRes] = await Promise.all([
        API.get('/api/v1/warehouse-accounts'),
        API.get('/api/v1/warehouses'),
      ])
      setAccounts(accRes.data)
      setWarehouses(whRes.data)
    } catch {
      toast.error('Không tải được dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const managerByWarehouse = useMemo(() => {
    const m = new Map<number, WHAccount>()
    accounts.forEach(a => { if (a.warehouse_id) m.set(a.warehouse_id, a) })
    return m
  }, [accounts])

  const byId = useMemo(() => {
    const m = new Map<number, WarehouseRow>()
    warehouses.forEach(w => m.set(w.warehouse_id, w))
    return m
  }, [warehouses])

  const pathLabel = (w: WarehouseRow): string => {
    const parts = [w.name]
    let p = w.parent_warehouse_id ? byId.get(w.parent_warehouse_id) : null
    while (p) { parts.push(p.name); p = p.parent_warehouse_id ? byId.get(p.parent_warehouse_id) : null }
    return parts.reverse().join(' › ')
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

  const handleGrantToggle = async (acc: WHAccount) => {
    const currentlyAllowed = acc.permissions.includes('warehouse_create_district')
    try {
      await API.patch(`/api/v1/warehouse-accounts/${acc.user_id}/grant-create`, {
        allow: !currentlyAllowed,
      })
      toast.success(currentlyAllowed ? 'Đã thu hồi quyền tự tạo tài khoản' : 'Đã cấp quyền tự tạo tài khoản District/Ward')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Thao tác thất bại')
    }
  }

  const submit = async () => {
    if (!username.trim() || !fullName.trim() || !warehouseId) {
      toast.error('Điền đầy đủ thông tin và chọn kho phụ trách'); return
    }
    const wh = byId.get(Number(warehouseId))
    if (!wh) { toast.error('Kho không hợp lệ'); return }
    const tier = NUM_TO_TIER[wh.tier]
    setCreating(true)
    try {
      const res = await API.post('/api/v1/warehouse-accounts', {
        username: username.trim(),
        full_name: fullName.trim(),
        tier,
        warehouse_id: wh.warehouse_id,
      })
      toast.success(`Tạo tài khoản ${TIER_LABEL[tier]} thành công!`)
      setLastCreated({ email: res.data.email, password: res.data.password })
      setUsername(''); setFullName(''); setWarehouseId('')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Tạo thất bại')
    } finally {
      setCreating(false)
    }
  }

  const searchUsers = async (q: string) => {
    setQuery(q)
    setSelectedUser(null)
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await API.get('/api/v1/warehouse-accounts/search-users', { params: { q } })
      setSearchResults(res.data.users || [])
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }

  const assignExisting = async () => {
    if (!selectedUser || !warehouseId) {
      toast.error('Chọn người dùng và kho phụ trách'); return
    }
    const wh = byId.get(Number(warehouseId))
    if (!wh) { toast.error('Kho không hợp lệ'); return }
    const tier = NUM_TO_TIER[wh.tier]
    setAssigning(true)
    try {
      await API.post('/api/v1/warehouse-accounts/assign-existing', {
        user_id: selectedUser.user_id,
        tier,
        warehouse_id: wh.warehouse_id,
      })
      toast.success(`Đã gán ${selectedUser.full_name} làm ${TIER_LABEL[tier]}`)
      setSelectedUser(null); setQuery(''); setSearchResults([]); setWarehouseId('')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Gán thất bại')
    } finally {
      setAssigning(false)
    }
  }

  const tier1 = warehouses.filter(w => w.tier === 1)
  const tier2 = warehouses.filter(w => w.tier === 2)
  const tier3 = warehouses.filter(w => w.tier === 3)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', margin: 0 }}>
          👥 Tài khoản Kho cấp 1 / 2 / 3
        </h1>
        <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
          Tạo tài khoản quản lý Kho tổng, Kho quận, Kho phường — gắn thẳng vào 1 kho thật trong hệ thống.
          Mặc định các tài khoản này không tạo thêm được ai — riêng Kho tổng (Tier 1) có thể được bạn
          cấp quyền tự tạo District/Ward (nút bên cạnh mỗi Hub).
        </p>
      </div>

      {/* Create / Assign form */}
      <div style={{
        marginBottom: 24, padding: '16px 18px', background: '#F5F3FF',
        border: '1px solid #7C3AED33', borderRadius: 10,
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setMode('new')} style={{
            flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, background: mode === 'new' ? '#7C3AED' : '#EDE9FE',
            color: mode === 'new' ? '#fff' : '#7C3AED',
          }}>+ Tạo tài khoản mới</button>
          <button onClick={() => setMode('existing')} style={{
            flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, background: mode === 'existing' ? '#7C3AED' : '#EDE9FE',
            color: mode === 'existing' ? '#fff' : '#7C3AED',
          }}>👤 Gán tài khoản có sẵn</button>
        </div>

        {mode === 'new' ? (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Họ tên</div>
                <input value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A" style={iStyle} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Tài khoản</div>
                <input value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="vd: Kho" style={iStyle} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Kho phụ trách</div>
                <select value={warehouseId} onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
                  style={{ ...iStyle, cursor: 'pointer', minWidth: 260 }}>
                  <option value="">-- Chọn kho --</option>
                  {tier1.length > 0 && (
                    <optgroup label="Kho Tổng (Tier 1)">
                      {tier1.map(w => (
                        <option key={w.warehouse_id} value={w.warehouse_id}>
                          {w.name}{managerByWarehouse.has(w.warehouse_id) ? ' — đã có quản lý' : ' — ⚠️ chưa có quản lý'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {tier2.length > 0 && (
                    <optgroup label="Kho Quận (Tier 2)">
                      {tier2.map(w => (
                        <option key={w.warehouse_id} value={w.warehouse_id}>
                          {pathLabel(w)}{managerByWarehouse.has(w.warehouse_id) ? ' — đã có quản lý' : ' — ⚠️ chưa có quản lý'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {tier3.length > 0 && (
                    <optgroup label="Kho Phường (Tier 3)">
                      {tier3.map(w => (
                        <option key={w.warehouse_id} value={w.warehouse_id}>
                          {pathLabel(w)}{managerByWarehouse.has(w.warehouse_id) ? ' — đã có quản lý' : ' — ⚠️ chưa có quản lý'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <button onClick={submit} disabled={creating} style={{
                padding: '8px 18px', borderRadius: 8, background: '#16A34A',
                color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>{creating ? '...' : 'Tạo tài khoản'}</button>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
              📌 Email sẽ tự sinh theo dạng: <b>{username || '...'}</b>cap<b>{warehouseId ? byId.get(Number(warehouseId))?.tier : 'N'}</b><b>MÃKHO</b>@buyzo.com — mật khẩu = toàn bộ phần trước @.
            </div>
            {lastCreated && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 8, fontSize: 12 }}>
                ✅ Vừa tạo — Email: <b>{lastCreated.email}</b> — Mật khẩu: <b>{lastCreated.password}</b>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 220px', minWidth: 220 }}>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Tìm người dùng (tên hoặc email)</div>
                <input value={query} onChange={e => searchUsers(e.target.value)}
                  placeholder="VD: Nguyễn Văn A hoặc a@email.com" style={{ ...iStyle, width: '100%' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Kho phụ trách</div>
                <select value={warehouseId} onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
                  style={{ ...iStyle, cursor: 'pointer', minWidth: 260 }}>
                  <option value="">-- Chọn kho --</option>
                  {tier1.length > 0 && (
                    <optgroup label="Kho Tổng (Tier 1)">
                      {tier1.map(w => (
                        <option key={w.warehouse_id} value={w.warehouse_id}>
                          {w.name}{managerByWarehouse.has(w.warehouse_id) ? ' — đã có quản lý' : ' — ⚠️ chưa có quản lý'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {tier2.length > 0 && (
                    <optgroup label="Kho Quận (Tier 2)">
                      {tier2.map(w => (
                        <option key={w.warehouse_id} value={w.warehouse_id}>
                          {pathLabel(w)}{managerByWarehouse.has(w.warehouse_id) ? ' — đã có quản lý' : ' — ⚠️ chưa có quản lý'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {tier3.length > 0 && (
                    <optgroup label="Kho Phường (Tier 3)">
                      {tier3.map(w => (
                        <option key={w.warehouse_id} value={w.warehouse_id}>
                          {pathLabel(w)}{managerByWarehouse.has(w.warehouse_id) ? ' — đã có quản lý' : ' — ⚠️ chưa có quản lý'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <button onClick={assignExisting} disabled={assigning || !selectedUser} style={{
                padding: '8px 18px', borderRadius: 8, background: !selectedUser || assigning ? '#94A3B8' : '#16A34A',
                color: '#fff', border: 'none', cursor: !selectedUser || assigning ? 'default' : 'pointer', fontSize: 13, fontWeight: 600,
              }}>{assigning ? '...' : 'Gán tài khoản'}</button>
            </div>

            {searching && <p style={{ fontSize: 12, color: '#64748B', margin: '8px 0 0' }}>Đang tìm...</p>}
            {searchResults.length > 0 && !selectedUser && (
              <div style={{ marginTop: 8, border: '1px solid #E2E8F0', borderRadius: 9, overflow: 'hidden', background: '#fff' }}>
                {searchResults.map(u => (
                  <div key={u.user_id}
                    onClick={() => { setSelectedUser(u); setSearchResults([]) }}
                    style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: '#1E3A8A', margin: 0 }}>{u.full_name}</p>
                    <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                  </div>
                ))}
              </div>
            )}
            {selectedUser && (
              <div style={{ marginTop: 8, background: '#EFF6FF', border: '2px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 14, color: '#1E3A8A', margin: 0 }}>✓ {selectedUser.full_name}</p>
                  <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>{selectedUser.email}</p>
                </div>
                <button onClick={() => { setSelectedUser(null); setQuery('') }}
                  style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Danh sách tài khoản đã tạo */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Đang tải...</div>
      ) : accounts.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 40, color: '#94A3B8',
          border: '2px dashed #E2E8F0', borderRadius: 12,
        }}>
          Chưa tạo tài khoản kho nào.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {accounts.map(a => (
            <div key={a.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: 10,
              background: a.status === 'inactive' ? '#F8FAFC' : (TIER_BG[a.tier] || '#F8FAFC'),
              border: `1.5px solid ${(TIER_COLOR[a.tier] || '#94A3B8')}33`,
              opacity: a.status === 'inactive' ? 0.6 : 1,
            }}>
              <span style={{ fontSize: 20 }}>{TIER_ICON[a.tier] || '🏬'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>{a.full_name}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  📧 {a.email}{a.warehouse_name ? ` · 🏭 ${a.warehouse_name}` : ''}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: '#fff', color: TIER_COLOR[a.tier] || '#64748B',
                border: `1px solid ${(TIER_COLOR[a.tier] || '#94A3B8')}44`,
              }}>{a.tier_label}</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 12,
                background: a.status === 'active' ? '#DCFCE7' : '#FEF2F2',
                color: a.status === 'active' ? '#16A34A' : '#DC2626',
                fontWeight: 600,
              }}>{a.status === 'active' ? 'Hoạt động' : 'Vô hiệu'}</span>
              {a.tier === 'hub' && (() => {
                const allowed = a.permissions.includes('warehouse_create_district')
                return (
                  <button onClick={() => handleGrantToggle(a)} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6,
                    background: allowed ? '#FEF2F2' : '#EFF6FF',
                    color: allowed ? '#DC2626' : '#1D4ED8',
                    border: `1px solid ${allowed ? '#DC2626' : '#1D4ED8'}44`,
                    cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                  }}>{allowed ? '🔓 Thu hồi quyền tạo' : '🔒 Cho phép tạo cấp 2/3'}</button>
                )
              })()}
              <button onClick={() => handleResetPassword(a)} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                background: '#FFF7ED', color: '#C2410C', border: '1px solid #C2410C44',
                cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
              }}>🔑 Reset mật khẩu</button>
            </div>
          ))}
        </div>
      )}

      {/* Toàn bộ cây kho BuyZo — Tổng kho quản lý toàn hệ thống nên cần thấy hết */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1E293B', marginBottom: 4 }}>🌲 Toàn bộ kho BuyZo</h2>
        <p style={{ color: '#64748B', fontSize: 12, marginBottom: 12 }}>
          {warehouses.length} kho trong hệ thống — {warehouses.filter(w => !managerByWarehouse.has(w.warehouse_id)).length} kho chưa có quản lý.
        </p>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>Đang tải...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tier1.map(hub => {
              const hubMgr = managerByWarehouse.get(hub.warehouse_id)
              const districts = tier2.filter(d => d.parent_warehouse_id === hub.warehouse_id)
              const hubCollapsed = collapsed.has(hub.warehouse_id)
              return (
                <div key={hub.warehouse_id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 10, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {districts.length > 0 && (
                      <button onClick={() => toggleCollapse(hub.warehouse_id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#64748B', padding: 2,
                      }} title={hubCollapsed ? 'Mở rộng' : 'Thu gọn'}>{hubCollapsed ? '▶' : '▼'}</button>
                    )}
                    <span>🏭</span>
                    <b style={{ fontSize: 13, color: '#1D4ED8' }}>{hub.name}</b>
                    <span style={{ fontSize: 11, color: '#64748B' }}>{hub.province}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: hubMgr ? '#16A34A' : '#DC2626' }}>
                      {hubMgr ? `👤 ${hubMgr.full_name}` : '⚠️ chưa có quản lý'}
                    </span>
                  </div>
                  {!hubCollapsed && districts.length > 0 && (
                    <div style={{ marginLeft: 20, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {districts.map(d => {
                        const dMgr = managerByWarehouse.get(d.warehouse_id)
                        const wards = tier3.filter(w => w.parent_warehouse_id === d.warehouse_id)
                        const dCollapsed = collapsed.has(d.warehouse_id)
                        return (
                          <div key={d.warehouse_id}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                              {wards.length > 0 && (
                                <button onClick={() => toggleCollapse(d.warehouse_id)} style={{
                                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#64748B', padding: 1,
                                }} title={dCollapsed ? 'Mở rộng' : 'Thu gọn'}>{dCollapsed ? '▶' : '▼'}</button>
                              )}
                              <span>🏪</span>
                              <span style={{ color: '#D97706', fontWeight: 600 }}>{d.name}</span>
                              <span style={{ marginLeft: 'auto', color: dMgr ? '#16A34A' : '#DC2626' }}>
                                {dMgr ? `👤 ${dMgr.full_name}` : '⚠️ chưa có quản lý'}
                              </span>
                            </div>
                            {!dCollapsed && wards.length > 0 && (
                              <div style={{ marginLeft: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {wards.map(w => {
                                  const wMgr = managerByWarehouse.get(w.warehouse_id)
                                  return (
                                    <div key={w.warehouse_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                                      <span>🏠</span>
                                      <span style={{ color: '#16A34A' }}>{w.name}</span>
                                      <span style={{ marginLeft: 'auto', color: wMgr ? '#16A34A' : '#DC2626' }}>
                                        {wMgr ? `👤 ${wMgr.full_name}` : '⚠️ chưa có quản lý'}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {warehouses.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: '#94A3B8', border: '2px dashed #E2E8F0', borderRadius: 12 }}>
                Chưa có kho nào trong hệ thống.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default WarehouseAccountsPage
