import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { adminService } from '../../services/adminService'
import Header from '../../components/common/Header'
import Modal from '../../components/common/Modal'
import Loading from '../../components/common/Loading'

const DisputeResolutionPage: React.FC = () => {
  const [disputes, setDisputes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [resolveModal, setResolveModal] = useState<any>(null)
  const [resolution, setResolution] = useState('')

  const load = async () => {
    setLoading(true)
    try { const r = await adminService.getDisputes(); setDisputes(r.data.disputes) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleResolve = async () => {
    try {
      await adminService.resolveDispute(resolveModal.dispute_id, { resolution_details: resolution, decision: 'resolved' })
      toast.success('Đã giải quyết khiếu nại')
      setResolveModal(null); setResolution(''); load()
    } catch { toast.error('Lỗi') }
  }

  if (loading) return <div><Header title="Khiếu nại" /><Loading /></div>

  return (
    <div>
      <Header title="Giải quyết khiếu nại" subtitle={`${disputes.length} khiếu nại đang mở`} />
      {disputes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>✅ Không có khiếu nại nào</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {disputes.map(d => (
            <div key={d.dispute_id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 700 }}>Khiếu nại #{d.dispute_id} · Đơn hàng #{d.order_id}</p>
                  <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>Bên khởi tạo: <strong>{d.initiated_party}</strong></p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', background: '#fef9c3', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>Đang mở</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--gray-700)', marginBottom: 12 }}>{d.reason || 'Không có mô tả'}</p>
              <button onClick={() => { setResolveModal(d); setResolution('') }} className="btn btn-primary btn-sm">Giải quyết</button>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!resolveModal} onClose={() => setResolveModal(null)} title="Giải quyết khiếu nại">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: 14, background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: 14 }}>
            <p><strong>Đơn hàng:</strong> #{resolveModal?.order_id}</p>
            <p><strong>Bên khởi tạo:</strong> {resolveModal?.initiated_party}</p>
          </div>
          <div>
            <label className="input-label">Quyết định giải quyết</label>
            <textarea className="input" rows={4} placeholder="Mô tả cách giải quyết..." value={resolution} onChange={e => setResolution(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => setResolveModal(null)} className="btn btn-ghost">Hủy</button>
            <button onClick={handleResolve} className="btn btn-primary">Xác nhận giải quyết</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default DisputeResolutionPage
