/**
 * ⚙️ Admin Overview — trang tổng quan hệ thống
 * Layout: AdminLayout (do Router bọc ngoài)
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardWidget from '../../components/admin/Dashboard'
import Loading from '../../components/common/Loading'
import { adminService } from '../../services/adminService'

const AdminOverviewPage: React.FC = () => {
  const [data, setData]     = useState<any>(null)
  const [logs, setLogs]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([adminService.getDashboard(), adminService.getLogs()])
      .then(([d, l]) => { setData(d.data); setLogs(l.data.logs?.slice(0, 5) || []) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Tổng quan hệ thống</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Quản lý toàn bộ nền tảng ShopVN</p>
        </div>
      </div>

      {data && <DashboardWidget data={data} />}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, margin: '28px 0' }}>
        {[
          { icon: '✅', label: 'Duyệt shop mới',     path: '/admin/approvals',        count: data?.pending_shop_registrations,     color: 'var(--warning)' },
          { icon: '🚚', label: 'Duyệt shipper',      path: '/admin/approvals',        count: data?.pending_shipper_registrations,   color: 'var(--info)' },
          { icon: '⚖️', label: 'Giải quyết khiếu nại', path: '/admin/disputes',       count: data?.open_disputes,                  color: 'var(--error)' },
          { icon: '🧑‍💼', label: 'Thêm nhân viên HT', path: '/admin/system-employees', count: null,                                  color: 'var(--success)' },
        ].filter(a => a.count === null || (a.count !== undefined && a.count > 0) || a.count === null).map(a => (
          <Link key={a.label} to={a.path} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, transition: 'transform 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = '')}>
              <span style={{ fontSize: 24 }}>{a.icon}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{a.label}</p>
                {a.count !== null && a.count !== undefined && (
                  <p style={{ fontSize: 20, fontWeight: 800, color: a.color }}>{a.count} đang chờ</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent logs */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>📋 Hoạt động gần đây</h3>
          <Link to="/admin/logs" style={{ fontSize: 13, color: 'var(--primary)' }}>Xem tất cả</Link>
        </div>
        {logs.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>Chưa có nhật ký nào</p>
        ) : logs.map((l: any) => (
          <div key={l.log_id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-100)', alignItems: 'center' }}>
            <code style={{ background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap' }}>{l.action}</code>
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{l.target_type} #{l.target_id}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>{l.created_at?.slice(0, 16)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AdminOverviewPage
