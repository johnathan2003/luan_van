/**
 * MyDisputesPage.tsx — [F-2]
 * Đã thay toàn bộ localStorage (disputeStore) bằng API thật:
 *   GET  /api/v1/disputes/me   — danh sách khiếu nại của user
 *   POST /api/v1/disputes      — tạo khiếu nại mới
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useAppSelector } from '../../store/hooks'
import { formatDate } from '../../utils/formatters'
import api from '../../services/api'

const STATUS_LABEL: Record<string, string> = {
  open: '🔓 Đang mở',
  resolved: '✅ Đã giải quyết',
  escalated: '⚠️ Leo thang',
}
const STATUS_COLOR: Record<string, string> = {
  open: '#e07b00',
  resolved: '#16a34a',
  escalated: '#dc2626',
}

interface DisputeItem {
  dispute_id: number
  order_id: number
  order_number: string | null
  reason: string
  evidence_urls: string | null
  status: string
  resolution_details: string | null
  refund_amount: number | null
  created_at: string
  resolved_at: string | null
}

const MyDisputesPage: React.FC = () => {
  const { user } = useAppSelector(s => s.auth)

  const [disputes, setDisputes]   = useState<DisputeItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<DisputeItem | null>(null)
  const [showForm, setShowForm]   = useState(false)

  // Form tạo khiếu nại mới
  const [orderId, setOrderId]     = useState('')
  const [reason, setReason]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/disputes/me')
      setDisputes(res.data.disputes || [])
    } catch {
      setDisputes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const handleSubmit = async () => {
    setFormError('')
    if (!orderId.trim() || !reason.trim()) {
      setFormError('Vui lòng nhập mã đơn hàng và lý do khiếu nại')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/disputes', {
        order_id: parseInt(orderId.trim()),
        reason: reason.trim(),
      })
      setShowForm(false)
      setOrderId('')
      setReason('')
      await load()
    } catch (e: any) {
      setFormError(e?.response?.data?.detail || 'Gửi khiếu nại thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, margin: 0 }}>
          Danh sách khiếu nại bạn đã gửi tới sàn — admin sẽ xem xét và xử lý.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Đóng' : '➕ Gửi khiếu nại'}
        </button>
      </div>

      {/* Form tạo khiếu nại */}
      {showForm && (
        <div className="card" style={{ padding: '20px 24px', marginBottom: 20, borderLeft: '3px solid var(--primary)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Gửi khiếu nại mới</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="number"
              placeholder="Mã đơn hàng (số)"
              value={orderId}
              onChange={e => setOrderId(e.target.value)}
              className="form-input"
              style={{ maxWidth: 220 }}
            />
            <textarea
              placeholder="Mô tả lý do khiếu nại..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="form-input"
              rows={4}
              style={{ resize: 'vertical' }}
            />
            {formError && <p style={{ color: 'var(--error)', fontSize: 13 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Đang gửi…' : 'Gửi khiếu nại'}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>Đang tải…</div>
      ) : disputes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗂️</div>
          <p>Bạn chưa gửi khiếu nại nào</p>
        </div>
      ) : (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Lý do</th>
                <th>Trạng thái</th>
                <th>Ngày gửi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {disputes.map(d => (
                <tr key={d.dispute_id} onClick={() => setSelected(d)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{d.order_number || `#${d.order_id}`}</td>
                  <td style={{ fontSize: 13, maxWidth: 260 }}>{d.reason}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-full)',
                      fontSize: 12, fontWeight: 600,
                      background: (STATUS_COLOR[d.status] || '#888') + '20',
                      color: STATUS_COLOR[d.status] || '#888',
                    }}>
                      {STATUS_LABEL[d.status] || d.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{formatDate(d.created_at)}</td>
                  <td>
                    <button onClick={e => { e.stopPropagation(); setSelected(d) }} className="btn btn-outline btn-sm">
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal chi tiết */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setSelected(null)}
        >
          <div className="card" style={{ width: '90vw', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800 }}>Khiếu nại #{selected.dispute_id}</h2>
                <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 2 }}>
                  Đơn: {selected.order_number || `#${selected.order_id}`}
                </p>
              </div>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-500)' }}>✕</button>
            </div>

            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-full)',
              fontSize: 12, fontWeight: 600, marginBottom: 14,
              background: (STATUS_COLOR[selected.status] || '#888') + '20',
              color: STATUS_COLOR[selected.status] || '#888',
            }}>
              {STATUS_LABEL[selected.status] || selected.status}
            </span>

            <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>📌 Lý do:</p>
            <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 14, whiteSpace: 'pre-wrap' }}>{selected.reason}</p>

            {selected.evidence_urls && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4 }}>BẰNG CHỨNG</p>
                <p style={{ fontSize: 13, color: 'var(--gray-600)' }}>{selected.evidence_urls}</p>
              </div>
            )}

            {selected.resolution_details && (
              <div style={{ background: 'var(--gray-50, #f8fafc)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--gray-700)', marginBottom: 12 }}>
                <strong>Kết luận từ sàn:</strong> {selected.resolution_details}
              </div>
            )}

            {selected.refund_amount != null && (
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
                💰 Hoàn tiền: {selected.refund_amount.toLocaleString('vi-VN')}₫
              </p>
            )}

            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 12 }}>
              Gửi lúc {formatDate(selected.created_at)}
              {selected.resolved_at && ` • Giải quyết lúc ${formatDate(selected.resolved_at)}`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyDisputesPage
