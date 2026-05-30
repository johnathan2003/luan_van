import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import Header from '../../components/common/Header'
import Loading from '../../components/common/Loading'
import { formatDate } from '../../utils/formatters'

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminService.getLogs().then(r => setLogs(r.data.logs)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div><Header title="Nhật ký hệ thống" /><Loading /></div>

  return (
    <div>
      <Header title="Nhật ký hệ thống" subtitle={`${logs.length} hành động gần đây`} />
      <div className="card table-wrapper">
        <table>
          <thead><tr><th>Thời gian</th><th>Admin</th><th>Hành động</th><th>Đối tượng</th><th>ID</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.log_id}>
                <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(l.created_at)}</td>
                <td style={{ fontSize: 13 }}>#{l.admin_id}</td>
                <td><code style={{ background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{l.action}</code></td>
                <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>{l.target_type}</td>
                <td style={{ fontSize: 13 }}>#{l.target_id || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Chưa có nhật ký</p>}
      </div>
    </div>
  )
}

export default AuditLogsPage
