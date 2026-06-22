import React, { useEffect, useState } from 'react'
import { getAllDisputes, resolveDispute } from '../../utils/disputeStore'
import type { Dispute, DisputeStatus } from '../../types/dispute'
import { DISPUTE_STATUS_LABELS, DISPUTE_STATUS_COLORS, DISPUTE_TARGET_LABELS } from '../../types/dispute'
import { formatDate, formatOrderId } from '../../utils/formatters'
import { addNotificationFor, type NotificationRecipientType } from '../../utils/notificationStore'

// Sau khi admin xu ly 1 khieu nai, suy ra "3 ben lien quan" toi don hang do
// (nguoi mua / shop / shipper) de gui thong bao, du dispute chi co 2 ben truc tiep
// (nguoi gui khieu nai + doi tuong bi khieu nai). Ben thu 3 (khong xuat hien truc tiep
// trong dispute) duoc thong bao voi id mac dinh — chi de demo hien thi, khong can khop
// chinh xac tai khoan thuc.
const ALL_PARTY_TYPES: NotificationRecipientType[] = ['user', 'shop', 'shipper']
function notifyDisputeParties(d: Dispute, decision: DisputeStatus, note: string) {
  const statusLabel = DISPUTE_STATUS_LABELS[decision]
  const parties: { type: NotificationRecipientType; id: number; title: string }[] = [
    { type: d.complainant_type, id: d.complainant_id, title: `Khiếu nại #${d.dispute_id} của bạn đã được xử lý` },
    { type: d.target_type as NotificationRecipientType, id: d.target_id ?? 0, title: `Khiếu nại #${d.dispute_id} liên quan đến bạn đã có kết luận` },
  ]
  const usedTypes = new Set<NotificationRecipientType>([d.complainant_type, d.target_type as NotificationRecipientType])
  const thirdType = ALL_PARTY_TYPES.find(t => !usedTypes.has(t))
  if (thirdType) {
    parties.push({ type: thirdType, id: 0, title: `Đơn hàng ${formatOrderId(d.order_id)} có cập nhật khiếu nại` })
  }
  parties.forEach(p => {
    addNotificationFor(p.type, p.id, {
      title: p.title,
      message: `Trạng thái: ${statusLabel}. ${note}`,
      type: 'dispute',
      related_entity_type: 'dispute',
      related_entity_id: d.dispute_id,
    })
  })
}

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

// 4 chieu khieu nai he thong ho tro - dung de loc nhanh
const FLOW_OPTIONS: { key: string; label: string }[] = [
  { key: 'user->shop', label: 'Người mua → Shop' },
  { key: 'user->shipper', label: 'Người mua → Shipper' },
  { key: 'shop->user', label: 'Shop → Người mua' },
  { key: 'shop->shipper', label: 'Shop → Shipper' },
]

const DisputeResolutionPage: React.FC = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | DisputeStatus>('all')
  const [flowFilter, setFlowFilter] = useState<'all' | string>('all')
  const [selected, setSelected] = useState<Dispute | null>(null)
  const [decision, setDecision] = useState<DisputeStatus>('resolved')
  const [note, setNote] = useState('')

  const reload = () => setDisputes(getAllDisputes())
  useEffect(() => { reload() }, [])

  const filtered = disputes.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (flowFilter !== 'all' && `${d.complainant_type}->${d.target_type}` !== flowFilter) return false
    return true
  })

  const handleOpenResolve = (d: Dispute) => {
    setSelected(d)
    setDecision('resolved')
    setNote('')
  }

  const handleConfirm = () => {
    if (!selected) return
    if (!note.trim()) { alert('Vui lòng nhập ghi chú/kết luận xử lý'); return }
    resolveDispute(selected.dispute_id, decision, note.trim())
    notifyDisputeParties(selected, decision, note.trim())
    setSelected(null)
    setNote('')
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>⚖️ Giải quyết khiếu nại</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
          Xem xét và xử lý khiếu nại giữa người mua, shop và shipper — bao gồm hàng giả, hư hỏng/giao gian dối, đổi trả gian lận, "bom" hàng, hiềm khích shop–shipper.
        </p>
      </div>

      {/* Stats theo trang thai */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {(Object.keys(DISPUTE_STATUS_LABELS) as DisputeStatus[]).map(k => (
          <div key={k} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${DISPUTE_STATUS_COLORS[k]}`, cursor: 'pointer', background: statusFilter === k ? C.tint : 'var(--bg-card)' }}
            onClick={() => setStatusFilter(statusFilter === k ? 'all' : k)}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{DISPUTE_STATUS_LABELS[k]}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: DISPUTE_STATUS_COLORS[k] }}>{disputes.filter(d => d.status === k).length}</p>
          </div>
        ))}
      </div>

      {/* Filter: trang thai + chieu khieu nai */}
      <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', 'Tất cả trạng thái'], ...Object.entries(DISPUTE_STATUS_LABELS)].map(([k, l]) => (
          <button key={k} onClick={() => setStatusFilter(k as any)} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: statusFilter === k ? C.blue : C.tint, color: statusFilter === k ? 'white' : C.gray,
          }}>{l}</button>
        ))}
        <span style={{ width: 1, height: 20, background: C.light, margin: '0 4px' }} />
        {[{ key: 'all', label: 'Tất cả loại' }, ...FLOW_OPTIONS].map(f => (
          <button key={f.key} onClick={() => setFlowFilter(f.key)} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: flowFilter === f.key ? C.navy : '#F1F5F9', color: flowFilter === f.key ? 'white' : C.gray,
          }}>{f.label}</button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>✅ Không có khiếu nại nào</div>
        ) : filtered.map(d => (
          <div key={d.dispute_id} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Khiếu nại #{d.dispute_id}</p>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: DISPUTE_STATUS_COLORS[d.status] + '20', color: DISPUTE_STATUS_COLORS[d.status] }}>
                    {DISPUTE_STATUS_LABELS[d.status]}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: '#F1F5F9', color: C.navy }}>
                    {d.complainant_type === 'shop' ? 'Shop' : 'Người mua'} → {DISPUTE_TARGET_LABELS[d.target_type]}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: C.gray }}>
                  Đơn hàng <strong style={{ color: C.blue }}>{formatOrderId(d.order_id)}</strong> ·
                  Người gửi: <strong>{d.complainant_name}</strong> · Bị khiếu nại: <strong>{d.target_name}</strong> · {formatDate(d.created_at)}
                </p>
              </div>
              {(d.status === 'pending' || d.status === 'reviewing') && (
                <button onClick={() => handleOpenResolve(d)}
                  style={{ padding: '8px 20px', background: C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  ⚖️ Xử lý
                </button>
              )}
            </div>

            <div style={{ padding: '10px 14px', background: C.tint, borderRadius: 8, marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 4 }}>LÝ DO: {d.reason_label.toUpperCase()}</p>
              <p style={{ fontSize: 13, color: C.navy, whiteSpace: 'pre-wrap' }}>{d.content}</p>
            </div>

            {(d.evidence.images.length > 0 || d.evidence.videoName) && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 6 }}>BẰNG CHỨNG</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {d.evidence.images.map((img, i) => (
                    <img key={i} src={img} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                  ))}
                  {d.evidence.videoName && (
                    <span style={{ fontSize: 12.5, color: C.gray, padding: '6px 10px', background: '#F1F5F9', borderRadius: 8 }}>🎬 {d.evidence.videoName}</span>
                  )}
                </div>
              </div>
            )}

            {d.resolution_note && (
              <div style={{ padding: '10px 14px', background: d.status === 'rejected' ? '#FEE2E2' : '#DCFCE7', borderRadius: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: d.status === 'rejected' ? C.error : C.success, marginBottom: 4 }}>KẾT LUẬN CỦA SÀN</p>
                <p style={{ fontSize: 13, color: d.status === 'rejected' ? '#7f1d1d' : '#166534' }}>{d.resolution_note}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Resolve Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setSelected(null)}>
          <div className="card" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>⚖️ Xử lý #{selected.dispute_id}</h2>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            <div style={{ padding: '12px 16px', background: C.tint, borderRadius: 10, marginBottom: 16, fontSize: 13, lineHeight: 1.8 }}>
              <p><strong>Đơn hàng:</strong> {formatOrderId(selected.order_id)}</p>
              <p><strong>Loại:</strong> {selected.complainant_type === 'shop' ? 'Shop' : 'Người mua'} khiếu nại {DISPUTE_TARGET_LABELS[selected.target_type]}</p>
              <p><strong>Lý do:</strong> {selected.reason_label}</p>
              <p><strong>Người gửi:</strong> {selected.complainant_name} · <strong>Bị khiếu nại:</strong> {selected.target_name}</p>
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 8 }}>QUYẾT ĐỊNH</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {([['reviewing', 'Đang xem xét'], ['resolved', 'Đã giải quyết'], ['rejected', 'Từ chối']] as [DisputeStatus, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setDecision(k)} style={{
                  flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${decision === k ? DISPUTE_STATUS_COLORS[k] : C.light}`,
                  background: decision === k ? DISPUTE_STATUS_COLORS[k] : 'white',
                  color: decision === k ? 'white' : C.gray,
                }}>{l}</button>
              ))}
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 8 }}>GHI CHÚ / KẾT LUẬN</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
              placeholder="VD: Hoàn tiền 100% cho khách hàng. Yêu cầu shop gửi lại sản phẩm đúng mô tả..."
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setSelected(null)} style={{ flex: 1, padding: '10px', background: C.tint, color: C.gray, border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleConfirm} style={{ flex: 2, padding: '10px', background: C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>✅ Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DisputeResolutionPage
