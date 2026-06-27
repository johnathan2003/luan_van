/**
 * super/frontend/pages/SuperUsers.tsx
 * -------------------------------------
 * Superadmin — xem và can thiệp trực tiếp bảng users.
 */
import React, { useEffect, useState } from 'react'
import superApi from '../superApi'

const S = {
  card:   '#13131a',
  border: '#1e1e2e',
  red:    '#dc2626',
  text:   '#f1f5f9',
  muted:  '#475569',
  input:  '#1e1e2e',
}

interface ShopInfo {
  shop_id:    number
  shop_name:  string | null
  position:   string | null
  emp_status: string
}

interface UserData {
  user_id:   number
  email:     string
  full_name: string | null
  phone:     string | null
  address:   string | null
  status:    string
  created_at: string | null
  roles:     { role_name: string; status: string }[]
  shop_info: ShopInfo | null
}

const STATUS_COLOR: Record<string, string> = {
  active: '#16a34a', banned: '#dc2626', deleted: '#64748b',
}

const SuperUsers: React.FC = () => {
  const [users, setUsers]     = useState<UserData[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('all')
  const [page, setPage]       = useState(1)

  // Patch modal
  const [editUser, setEditUser]   = useState<UserData | null>(null)
  const [editForm, setEditForm]   = useState<{ status?: string; full_name?: string }>({})

  // Reset password
  const [resetUser, setResetUser]       = useState<UserData | null>(null)
  const [resetPw, setResetPw]           = useState('')
  const [resetResult, setResetResult]   = useState<{ email: string; password: string } | null>(null)

  const load = (s = status, q = search, p = page) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (s !== 'all') params.set('status', s)
    if (q) params.set('search', q)
    superApi.get(`/users?${params}`)
      .then(r => { setUsers(r.data.users || []); setTotal(r.data.total || 0) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status, page])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(status, search, 1) }

  const handleSaveEdit = async () => {
    if (!editUser) return
    try {
      await superApi.patch(`/users/${editUser.user_id}`, editForm)
      setUsers(us => us.map(u => u.user_id === editUser.user_id ? { ...u, ...editForm } : u))
      setEditUser(null)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi cập nhật')
    }
  }

  const handleResetPassword = async () => {
    if (!resetUser) return
    try {
      const res = await superApi.post(`/users/${resetUser.user_id}/reset-password`, {
        new_password: resetPw || undefined,
      })
      setResetResult({ email: res.data.email, password: res.data.new_password })
      setResetUser(null)
      setResetPw('')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi reset mật khẩu')
    }
  }

  const handleHardDelete = async (u: UserData) => {
    if (!confirm(`XÓA CỨNG user: ${u.email} (ID: ${u.user_id})\nKHÔNG THỂ PHỤC HỒI. Tiếp tục?`)) return
    try {
      await superApi.delete(`/users/${u.user_id}/hard`)
      setUsers(us => us.filter(x => x.user_id !== u.user_id))
      setTotal(t => t - 1)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi xóa')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ color: S.text, fontSize: 20, fontWeight: 800, margin: 0 }}>👥 Người dùng</h1>
        <p style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>Tổng: {total} — truy cập trực tiếp DB</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'active', 'banned', 'deleted'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            style={{
              padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: status === s ? S.red : S.card, color: status === s ? '#fff' : S.muted,
            }}>
            {s === 'all' ? 'Tất cả' : s}
          </button>
        ))}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm username / email..."
            style={{ padding: '7px 12px', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
          <button type="submit" style={{ padding: '7px 14px', background: S.red, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Tìm</button>
        </form>
      </div>

      {/* Table */}
      {loading
        ? <div style={{ color: S.muted, textAlign: 'center', padding: 40 }}>Đang tải...</div>
        : (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                  {['ID', 'Email', 'Họ tên', 'Shop/Vị trí', 'Roles', 'Status', 'Thao tác'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: S.muted, letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '12px 16px', color: S.muted, fontSize: 12 }}>{u.user_id}</td>
                    <td style={{ padding: '12px 16px', color: S.text, fontSize: 13, fontWeight: 600 }}>{u.email}</td>
                    <td style={{ padding: '12px 16px', color: S.muted, fontSize: 12 }}>{u.full_name || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.shop_info ? (
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>🏪 {u.shop_info.shop_name || `Shop #${u.shop_info.shop_id}`}</span>
                          {u.shop_info.position && (
                            <p style={{ fontSize: 11, color: S.muted, margin: '2px 0 0' }}>{u.shop_info.position}</p>
                          )}
                        </div>
                      ) : <span style={{ color: S.muted, fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {u.roles.map(r => (
                          <span key={r.role_name} style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                            background: r.role_name === 'superadmin' ? '#2d1010' : '#1e1e2e',
                            color: r.role_name === 'superadmin' ? '#fca5a5' : '#94a3b8',
                          }}>{r.role_name}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[u.status] || S.muted }}>{u.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => { setEditUser(u); setEditForm({ status: u.status, full_name: u.full_name || '' }) }}
                          style={{ padding: '5px 10px', background: S.input, border: `1px solid ${S.border}`, borderRadius: 6, color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          ✏️ Sửa
                        </button>
                        <button onClick={() => { setResetUser(u); setResetPw('') }}
                          style={{ padding: '5px 10px', background: '#1c1c10', border: '1px solid #713f12', borderRadius: 6, color: '#fbbf24', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          🔑 Reset
                        </button>
                        <button onClick={() => handleHardDelete(u)}
                          style={{ padding: '5px 10px', background: '#2d1010', border: '1px solid #7f1d1d', borderRadius: 6, color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: S.muted }}>Không có user</div>}
          </div>
        )
      }

      {/* Pagination */}
      {total > 30 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>← Trước</button>
          <span style={{ padding: '7px 14px', color: S.muted, fontSize: 13 }}>Trang {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={users.length < 30}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>Tiếp →</button>
        </div>
      )}

      {/* Reset Password modal */}
      {resetUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setResetUser(null)}>
          <div style={{ width: 380, background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: '#fbbf24', fontSize: 15, fontWeight: 800, margin: 0 }}>🔑 Reset mật khẩu</h2>
              <button onClick={() => setResetUser(null)} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ color: S.muted, fontSize: 12, margin: 0 }}>{resetUser.email}</p>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>
                MẬT KHẨU MỚI <span style={{ fontWeight: 400 }}>(để trống → tự sinh ngẫu nhiên)</span>
              </label>
              <input value={resetPw} onChange={e => setResetPw(e.target.value)}
                placeholder="Nhập mật khẩu hoặc để trống..."
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none', fontFamily: 'monospace' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setResetUser(null)} style={{ padding: '9px 18px', background: 'none', border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, fontSize: 13, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleResetPassword} style={{ padding: '9px 20px', background: '#854d0e', color: '#fef3c7', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🔑 Xác nhận reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password result — hiện 1 lần */}
      {resetResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: 400, background: S.card, border: '2px solid #854d0e', borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ color: '#fbbf24', fontSize: 16, fontWeight: 800, margin: 0, textAlign: 'center' }}>🔐 Mật khẩu mới</h2>
            <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', margin: 0, fontWeight: 600 }}>⚠️ Lưu lại ngay — chỉ hiển thị 1 lần!</p>
            {[
              { label: 'Email', value: resetResult.email },
              { label: 'Mật khẩu mới', value: resetResult.password },
            ].map(row => (
              <div key={row.label} style={{ background: S.input, borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: S.muted, margin: '0 0 4px' }}>{row.label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fef3c7', wordBreak: 'break-all' }}>{row.value}</code>
                  <button onClick={() => navigator.clipboard.writeText(row.value)}
                    style={{ padding: '4px 10px', background: '#1c1c10', color: '#fbbf24', border: '1px solid #713f12', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                    Copy
                  </button>
                </div>
              </div>
            ))}
            <button onClick={() => setResetResult(null)}
              style={{ padding: 11, background: '#854d0e', color: '#fef3c7', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              ✅ Đã lưu, đóng lại
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setEditUser(null)}>
          <div style={{ width: 380, background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: S.text, fontSize: 15, fontWeight: 800, margin: 0 }}>✏️ Sửa user #{editUser.user_id}</h2>
              <button onClick={() => setEditUser(null)} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ color: S.muted, fontSize: 12, margin: 0 }}>{editUser.email}</p>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>FULL NAME</label>
              <input value={editForm.full_name ?? ''} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>STATUS</label>
              <select value={editForm.status ?? 'active'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }}>
                {['active', 'banned', 'deleted'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setEditUser(null)} style={{ padding: '9px 18px', background: 'none', border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, fontSize: 13, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleSaveEdit} style={{ padding: '9px 20px', background: S.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>💾 Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperUsers
