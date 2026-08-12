import React, { useState } from 'react'
import { toast } from 'react-toastify'
import Modal from '../common/Modal'
import { formatDate } from '../../utils/formatters'

interface ApprovalItem { id: number; title: string; subtitle?: string; date?: string; status: string }
interface Props {
  items: ApprovalItem[]
  onApprove: (id: number) => Promise<void>
  onReject: (id: number, reason: string) => Promise<void>
  onRefresh: () => void
  emptyMsg?: string
}

const ApprovalList: React.FC<Props> = ({ items, onApprove, onReject, onRefresh, emptyMsg = 'Không có yêu cầu' }) => {
  const [rejectModal, setRejectModal] = useState<number | null>(null)
  const [reason, setReason] = useState('')

  const handleApprove = async (id: number) => {
    try { await onApprove(id); toast.success('Đã phê duyệt'); onRefresh() } catch (err: any) { toast.error(err.response?.data?.detail || 'Lỗi') }
  }

  const handleReject = async () => {
    if (!reason.trim()) { toast.warning('Vui lòng nhập lý do'); return }
    try { await onReject(rejectModal!, reason); toast.success('Đã từ chối'); setRejectModal(null); setReason(''); onRefresh() } catch { toast.error('Lỗi') }
  }

  if (!items.length) return <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>{emptyMsg}</p>

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 15 }}>{item.title}</p>
              {item.subtitle && <p style={{ color: 'var(--gray-500)', fontSize: 13, marginTop: 2 }}>{item.subtitle}</p>}
              {item.date && <p style={{ color: 'var(--gray-400)', fontSize: 12, marginTop: 4 }}>{formatDate(item.date)}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleApprove(item.id)} className="btn btn-primary btn-sm">✓ Duyệt</button>
              <button onClick={() => { setRejectModal(item.id); setReason('') }} className="btn btn-danger btn-sm">✗ Từ chối</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={rejectModal !== null} onClose={() => setRejectModal(null)} title="Lý do từ chối">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <textarea className="input" rows={4} placeholder="Nhập lý do từ chối..." value={reason} onChange={e => setReason(e.target.value)} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setRejectModal(null)} className="btn btn-ghost">Hủy</button>
            <button onClick={handleReject} className="btn btn-danger">Từ chối</button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default ApprovalList
