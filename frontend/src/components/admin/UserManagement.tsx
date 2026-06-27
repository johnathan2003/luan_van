import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import Loading from '../common/Loading'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const ROLE_COLOR: Record<string, { color: string; bg: string }> = {
  admin:      { color: C.blue,    bg: C.light   },
  shop:       { color: '#16A34A', bg: '#DCFCE7' },
  shipper:    { color: C.warning, bg: '#FEF3C7' },
  user:       { color: '#7C3AED', bg: '#EDE9FE' },  // "user" = người dùng thường
  superadmin: { color: '#DC2626', bg: '#FEE2E2' },
  employee:   { color: C.gray,    bg: '#F1F5F9' },
}

const UserManagement: React.FC = () => {
  const [users, setUsers]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    setLoading(true)
    adminService.getUsers()
      .then(res => { const d = res.data?.users ?? res.data; if (Array.isArray(d)) setUsers(d) })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  const handleBan = (id: number, isBanned: boolean) => {
    setUsers(us => us.map(u => u.user_id === id ? { ...u, status: isBanned ? 'active' : 'banned' } : u))
    if (isBanned) adminService.unbanUser(id).catch(() => {})
    else          adminService.banUser(id).catch(() => {})
  }

  const filtered = users.filter(u => {
    const mq = !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    const mr = roleFilter === 'all' || u.roles?.includes(roleFilter)
    const ms = statusFilter === 'all' || u.status === statusFilter
    return mq && mr && ms
  })

  if (loading) return <Loading />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>👥 Quản lý người dùng</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Xem và quản lý tất cả tài khoản trong hệ thống</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Tổng ND',      value: users.length,                              color: C.blue    },
          { label: 'Hoạt động',    value: users.filter(u => u.status === 'active').length,   color: C.success },
          { label: 'Bị khóa',      value: users.filter(u => u.status === 'banned').length,   color: C.error   },
          { label: 'Không HĐ',    value: users.filter(u => u.status === 'inactive').length, color: C.gray    },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm tên, email..."
          style={{ flex: 1, minWidth: 180, padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }} />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }}>
          <option value="all">Tất cả vai trò</option>
          <option value="admin">Admin</option>
          <option value="shop">Cửa hàng</option>
          <option value="shipper">Shipper</option>
          <option value="user">Khách hàng</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }}>
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="banned">Bị khóa</option>
          <option value="inactive">Không HĐ</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Người dùng', 'Email', 'Vai trò', 'Trạng thái', 'Ngày tạo', 'Thao tác'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Không tìm thấy người dùng</td></tr>
            ) : filtered.map(u => {
              const isBanned = u.status === 'banned'
              const roles: string[] = u.roles ?? ['user']
              return (
                <tr key={u.user_id} style={{ borderBottom: `1px solid ${C.tint}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${C.blue}, #3B82F6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                        {(u.full_name?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>{u.full_name || '—'}</p>
                        <p style={{ fontSize: 11, color: C.gray }}>UID #{u.user_id}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: C.gray }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {roles.map(r => {
                        const rc = ROLE_COLOR[r] ?? ROLE_COLOR.user
                        return (
                          <span key={r} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: rc.bg, color: rc.color }}>
                            {r === 'admin' ? 'Admin' : r === 'shop' ? 'Shop' : r === 'shipper' ? 'Shipper' : 'KH'}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: 240 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: u.status === 'active' ? C.success : u.status === 'banned' ? C.error : C.gray }}>
                      {u.status === 'active' ? '● Hoạt động' : u.status === 'banned' ? '● Bị khóa' : '● Không HĐ'}
                    </span>
                    {u.violation_reason && (
                      <p style={{ fontSize: 11, color: C.error, marginTop: 3, lineHeight: 1.4 }}>⚠️ {u.violation_reason}</p>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: C.gray }}>{u.created_at}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {!roles.includes('admin') && (
                      <button onClick={() => handleBan(u.user_id, isBanned)}
                        style={{ padding: '5px 14px', background: isBanned ? '#DCFCE7' : '#FEE2E2', color: isBanned ? C.success : C.error, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {isBanned ? 'Mở khóa' : 'Khóa TK'}
                      </button>
                    )}
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

export default UserManagement
