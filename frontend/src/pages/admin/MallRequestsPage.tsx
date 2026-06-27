import React, { useEffect, useState } from 'react'
import Loading from '../../components/common/Loading'
import { adminService } from '../../services/adminService'

const MallRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [msg, setMsg]           = useState('')

  const load = () => {
    setLoading(true)
    adminService.getMallRequests()
      .then(r => setRequests(r.data.requests ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const action = async (shopId: number, type: 'approve' | 'reject') => {
    try {
      const fn = type === 'approve' ? adminService.approveMall : adminService.rejectMall
      const r = await fn(shopId)
      setMsg(r.data.message ?? 'Thành công')
      load()
    } catch { setMsg('Lỗi kết nối') }
  }

  if (loading) return <Loading />

  return (
    <div>
      <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 20 }}>🏆 Duyệt BuyZo Mall</h2>
      {msg && <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>{msg}</div>}

      {requests.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Không có yêu cầu nào đang chờ duyệt</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map((req: any) => (
            <div key={req.shop_id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{req.shop_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>📍 {req.address}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  ⭐ {req.rating} · Đơn hàng: {req.total_orders} · Yêu cầu lúc: {req.requested_at ? new Date(req.requested_at).toLocaleString('vi-VN') : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <button onClick={() => action(req.shop_id, 'approve')}
                  style={{ padding: '8px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  ✅ Duyệt
                </button>
                <button onClick={() => action(req.shop_id, 'reject')}
                  style={{ padding: '8px 18px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  ❌ Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MallRequestsPage
