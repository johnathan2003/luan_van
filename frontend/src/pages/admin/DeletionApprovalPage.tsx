import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import Loading from '../../components/common/Loading'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const MOCK_REQUESTS = [
  { deletion_req_id:1, product_id:15, product_name:'Sản phẩm A (giả mạo thương hiệu)', shop_id:2, reason:'Vi phạm quyền sở hữu trí tuệ, giả mạo thương hiệu Nike', status:'pending',  created_at:'2025-06-14' },
  { deletion_req_id:2, product_id:22, product_name:'Dụng cụ nguy hiểm X',               shop_id:3, reason:'Sản phẩm bị cấm theo quy định pháp luật',               status:'pending',  created_at:'2025-06-13' },
  { deletion_req_id:3, product_id:8,  product_name:'Thực phẩm chức năng B',              shop_id:1, reason:'Không có giấy phép lưu hành, quảng cáo sai sự thật',    status:'approved', created_at:'2025-06-10' },
  { deletion_req_id:4, product_id:31, product_name:'Phụ kiện điện thoại C',              shop_id:4, reason:'Hàng nhái, không rõ nguồn gốc xuất xứ',                 status:'rejected', created_at:'2025-06-08' },
]

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Chờ xử lý', color: C.warning, bg: '#FEF3C7' },
  approved: { label: 'Đã xóa',    color: C.success, bg: '#DCFCE7' },
  rejected: { label: 'Từ chối',   color: C.error,   bg: '#FEE2E2' },
}

const DeletionApprovalPage: React.FC = () => {
  const [requests, setRequests] = useState<any[]>(MOCK_REQUESTS)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    setLoading(true)
    adminService.getDeletionRequests()
      .then(r => setRequests(r.data?.requests || r.data || MOCK_REQUESTS))
      .catch(() => setRequests(MOCK_REQUESTS))
      .finally(() => setLoading(false))
  }, [])

  const handleApprove = (id: number) => {
    if (window.confirm('Xác nhận xóa sản phẩm này?'))
      setRequests(rs => rs.map(r => r.deletion_req_id === id ? { ...r, status: 'approved' } : r))
  }

  const handleReject = (id: number) => {
    setRequests(rs => rs.map(r => r.deletion_req_id === id ? { ...r, status: 'rejected' } : r))
  }

  if (loading) return <Loading />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🗑️ Yêu cầu xóa sản phẩm</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Xem xét và xử lý các yêu cầu xóa sản phẩm vi phạm</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {Object.entries(STATUS_STYLE).map(([k, v]) => (
          <div key={k} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${v.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{v.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: v.color }}>{requests.filter(r => r.status === k).length}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {requests.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>Không có yêu cầu nào</div>
        ) : requests.map(r => {
          const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending
          return (
            <div key={r.deletion_req_id} className="card" style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{r.product_name}</p>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <p style={{ fontSize: 13, color: C.gray, marginBottom: 4 }}>
                  Sản phẩm <strong>#{r.product_id}</strong> · Shop <strong>#{r.shop_id}</strong>
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.error, background: '#FEE2E2', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>Lý do</span>
                  <p style={{ fontSize: 13, color: C.navy }}>{r.reason}</p>
                </div>
                <p style={{ fontSize: 11, color: C.gray, marginTop: 6 }}>🕐 {r.created_at}</p>
              </div>
              {r.status === 'pending' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 20, flexShrink: 0 }}>
                  <button onClick={() => handleApprove(r.deletion_req_id)}
                    style={{ padding: '8px 18px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    🗑️ Xóa SP
                  </button>
                  <button onClick={() => handleReject(r.deletion_req_id)}
                    style={{ padding: '8px 18px', background: C.tint, color: C.gray, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Từ chối
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DeletionApprovalPage
