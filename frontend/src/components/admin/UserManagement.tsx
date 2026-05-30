import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { adminService } from '../../services/adminService'
import { formatDate } from '../../utils/formatters'
import Loading from '../common/Loading'

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try { const res = await adminService.getUsers(); setUsers(res.data.users) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleBan = async (id: number, banned: boolean) => {
    try {
      if (banned) await adminService.unbanUser(id)
      else await adminService.banUser(id)
      toast.success(banned ? 'Đã mở khóa' : 'Đã khóa tài khoản')
      load()
    } catch { toast.error('Lỗi') }
  }

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <Loading />

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input className="input" placeholder="🔍 Tìm kiếm người dùng..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
      </div>
      <div className="card table-wrapper">
        <table>
          <thead><tr><th>Tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.user_id}>
                <td style={{ fontWeight: 500 }}>{u.full_name || '—'}</td>
                <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>{u.email}</td>
                <td style={{ fontSize: 12 }}>{u.roles?.join(', ') || 'user'}</td>
                <td>
                  <span style={{ fontSize: 12, fontWeight: 600, color: u.status === 'active' ? 'var(--success)' : u.status === 'banned' ? 'var(--error)' : 'var(--gray-400)' }}>
                    {u.status === 'active' ? '● Hoạt động' : u.status === 'banned' ? '● Bị khóa' : '● Không hoạt động'}
                  </span>
                </td>
                <td style={{ fontSize: 13 }}>{formatDate(u.created_at)}</td>
                <td>
                  <button
                    onClick={() => handleBan(u.user_id, u.status === 'banned')}
                    className={`btn btn-sm ${u.status === 'banned' ? 'btn-outline' : 'btn-danger'}`}
                  >
                    {u.status === 'banned' ? 'Mở khóa' : 'Khóa TK'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Không tìm thấy người dùng</p>}
      </div>
    </div>
  )
}

export default UserManagement
