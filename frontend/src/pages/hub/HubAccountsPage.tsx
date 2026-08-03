/**
 * HubAccountsPage.tsx
 * ─────────────────────────────────────────────────────
 * Trang cho Kho tổng (Hub, Tier 1) tạo tài khoản District (T2) / Ward (T3) —
 * CHỈ hoạt động nếu Quản lý tổng (dept) đã cấp quyền qua nút
 * "Cho phép tạo cấp 2/3" ở trang /warehouse/accounts.
 *
 * Tài khoản mới được gắn thẳng vào 1 kho thật (Quận/Phường) nằm trong
 * phạm vi thành phố của Hub — không chọn cấp trừu tượng nữa.
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
  tier: 'dept' | 'hub' | 'district' | 'ward'
  tier_label: string
  warehouse_id: number | null
  warehouse_name: string | null
}

interface WarehouseRow {
  warehouse_id: number
  name: string
  province: string
  tier: number
  parent_warehouse_id: number | null
}

const TIER_COLOR: Record<string, string> = { district: '#D97706', ward: '#16A34A' }
const TIER_BG: Record<string, string>    = { district: '#FFFBEB', ward: '#F0FDF4' }
const TIER_ICON: Record<string, string>  = { district: '🏪', ward: '🏠' }
const NUM_TO_TIER: Record<number, 'district' | 'ward'> = { 2: 'district', 3: 'ward' }

const iStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1',
  fontSize: 13, outline: 'none', background: '#fff', color: '#1E293B',
}

const HubAccountsPage: React.FC = () => {
  const [canCreate, setCanCreate] = useState<string[]>([])
  const [accounts, setAccounts]   = useState<WHAccount[]>([])
  const [districts, setDistricts] = useState<WarehouseRow[]>([])
  const [wards, setWards]         = useState<WarehouseRow[]>([])
  const [loading,  setLoading]    = useState(true)
  const [username, setUsername]   = useState('')
  const [fullName, setFullName]   = useState('')
  const [warehouseId, setWarehouseId] = useState<number | ''>('')
  const [creating, setCreating]   = useState(false)
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null)

  // Gán người dùng có sẵn (thay vì tạo mới)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [query, setQuery]         = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [selectedUser, setSelectedUser]   = useState<UserSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [meRes, listRes, hubRes] = await Promise.all([
        API.get('/api/v1/warehouse-accounts/me'),
        API.get('/api/v1/warehouse-accounts'),
        API.get('/api/v1/warehouses/hub/districts'),
      ])
      const can = meRes.data.can_create || []
      setCanCreate(can)
      setAccounts(listRes.data)
      const myDistricts: WarehouseRow[] = hubRes.data?.districts ?? []
      setDistricts(myDistricts)

      if (can.includes('ward') && myDistricts.length > 0) {
        const wardLists = await Promise.all(
          myDistricts.map(d =>
            API.get('/api/v1/warehouses', { params: { tier: 3, parent_id: d.warehouse_id } })
              .then(r => r.data as WarehouseRow[])
              .catch(() => [] as WarehouseRow[])
          )
        )
        setWards(wardLists.flat())
      }
    } catch {
      toast.error('Không tải được dữ liệu tài khoản kho')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const districtById = useMemo(() => {
    const m = new Map<number, WarehouseRow>()
    districts.forEach(d => m.set(d.warehouse_id, d))
    return m
  }, [districts])

  const byId = useMemo(() => {
    const m = new Map<number, WarehouseRow>()
    districts.forEach(d => m.set(d.warehouse_id, d))
    wards.forEach(w => m.set(w.warehouse_id, w))
    return m
  }, [districts, wards])

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
        username: username.trim(), full_name: fullName.trim(), tier, warehouse_id: wh.warehouse_id,
      })
      toast.success('Tạo tài khoản thành công!')
      setLastCreated({ email: res.data.email, password: res.data.password })
      setUsername(''); setFullName(''); setWarehouseId('')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Tạo thất bại')
    } finally {
      setCreating(false)
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
        user_id: selectedUser.user_id, tier, warehouse_id: wh.warehouse_id,
      })
      toast.success(`Đã gán ${selectedUser.full_name} thành công`)
      setSelectedUser(null); setQuery(''); setSearchResults([]); setWarehouseId('')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Gán thất bại')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Đang tải...</div>
  }

  const allowed = canCreate.includes('district') || canCreate.includes('ward')

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', margin: 0 }}>
          👥 Tài khoản Kho quận / phường
        </h1>
        <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
          Tạo tài khoản quản lý Kho quận (T2) / Kho phường (T3) trong thành phố của bạn.
        </p>
      </div>

      {!allowed ? (
        <div style={{
          padding: '16px 18px', background: '#FEF2F2', border: '1px solid #FCA5A5',
          borderRadius: 10, color: '#B91C1C', fontSize: 13,
        }}>
          🔒 Bạn chưa được Quản lý tổng cấp quyền tự tạo tài khoản. Liên hệ Quản lý tổng để được cấp quyền.
        </div>
      ) : (
        <div style={{
          marginBottom: 24, padding: '16px 18px', background: '#EFF6FF',
          border: '1px solid #1D4ED833', borderRadius: 10,
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setMode('new')} style={{
              flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, background: mode === 'new' ? '#1D4ED8' : '#DBEAFE',
              color: mode === 'new' ? '#fff' : '#1D4ED8',
            }}>+ Tạo tài khoản mới</button>
            <button onClick={() => setMode('existing')} style={{
              flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, background: mode === 'existing' ? '#1D4ED8' : '#DBEAFE',
              color: mode === 'existing' ? '#fff' : '#1D4ED8',
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
                    style={{ ...iStyle, cursor: 'pointer', minWidth: 240 }}>
                    <option value="">-- Chọn kho --</option>
                    {canCreate.includes('district') && districts.length > 0 && (
                      <optgroup label="Kho Quận (Tier 2)">
                        {districts.map(d => (
                          <option key={d.warehouse_id} value={d.warehouse_id}>{d.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {canCreate.includes('ward') && wards.length > 0 && (
                      <optgroup label="Kho Phường (Tier 3)">
                        {wards.map(w => {
                          const parent = w.parent_warehouse_id ? districtById.get(w.parent_warehouse_id) : null
                          return (
                            <option key={w.warehouse_id} value={w.warehouse_id}>
                              {parent ? `${parent.name} › ${w.name}` : w.name}
                            </option>
                          )
                        })}
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
                    style={{ ...iStyle, cursor: 'pointer', minWidth: 240 }}>
                    <option value="">-- Chọn kho --</option>
                    {canCreate.includes('district') && districts.length > 0 && (
                      <optgroup label="Kho Quận (Tier 2)">
                        {districts.map(d => (
                          <option key={d.warehouse_id} value={d.warehouse_id}>{d.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {canCreate.includes('ward') && wards.length > 0 && (
                      <optgroup label="Kho Phường (Tier 3)">
                        {wards.map(w => {
                          const parent = w.parent_warehouse_id ? districtById.get(w.parent_warehouse_id) : null
                          return (
                            <option key={w.warehouse_id} value={w.warehouse_id}>
                              {parent ? `${parent.name} › ${w.name}` : w.name}
                            </option>
                          )
                        })}
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
                <div style={{ marginTop: 8, background: '#DBEAFE', border: '2px solid #93C5FD', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
      )}

      {accounts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          {accounts.filter(a => a.tier === 'district' || a.tier === 'ward').map(a => (
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
              }}>{a.tier === 'district' ? 'Kho quận (Tier 2)' : 'Kho phường (Tier 3)'}</span>
              <button onClick={() => handleResetPassword(a)} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                background: '#FFF7ED', color: '#C2410C', border: '1px solid #C2410C44',
                cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
              }}>🔑 Reset mật khẩu</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default HubAccountsPage
