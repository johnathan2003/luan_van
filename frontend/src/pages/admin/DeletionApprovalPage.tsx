import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import Header from '../../components/common/Header'
import Loading from '../../components/common/Loading'

const DeletionApprovalPage: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminService.getDeletionRequests().then(r => setRequests(r.data.requests)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div><Header title="Yêu cầu xóa sản phẩm" /><Loading /></div>

  return (
    <div>
      <Header title="Yêu cầu xóa sản phẩm" subtitle={`${requests.length} yêu cầu đang chờ`} />
      {requests.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>Không có yêu cầu nào</p>
      ) : (
        <div className="card table-wrapper">
          <table>
            <thead><tr><th>Sản phẩm</th><th>Lý do</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.deletion_req_id}>
                  <td>#{r.product_id}</td>
                  <td style={{ fontSize: 13 }}>{r.reason || '—'}</td>
                  <td><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)' }}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default DeletionApprovalPage
