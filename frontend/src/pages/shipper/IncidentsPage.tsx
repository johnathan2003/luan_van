import React, { useEffect, useState } from 'react'
import { shipmentService } from '../../services/shipmentService'

const C = {
  amber: '#D97706', light: '#FEF3C7', tint: '#FFFBEB',
  navy: '#1E3A8A', blue: '#1D4ED8', gray: '#64748B',
  success: '#16A34A', error: '#DC2626', warning: '#D97706',
}

const QUICK_REASONS = [
  'Không tìm được địa chỉ giao hàng',
  'Khách không nghe máy / không ra nhận hàng',
  'Hàng hóa bị hư hỏng trong quá trình vận chuyển',
  'Xe hỏng / sự cố phương tiện',
  'Va chạm giao thông',
  'Thời tiết xấu ảnh hưởng giao hàng',
]

const INCIDENT_TYPE: Record<string, { label: string; icon: string; color: string }> = {
  accident:  { label: 'Tai nạn',   icon: '🚨', color: C.error   },
  delay:     { label: 'Giao trễ',  icon: '⏰', color: C.warning },
  complaint: { label: 'Khiếu nại', icon: '📣', color: C.blue    },
  lost_item: { label: 'Thất lạc',  icon: '🔍', color: C.navy    },
  other:     { label: 'Khác',      icon: '❓', color: C.gray    },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open:      { label: '🔴 Mới gửi',        color: C.error,   bg: '#FEE2E2' },
  in_review: { label: '⏳ Đang xử lý',     color: C.warning, bg: C.light   },
  resolved:  { label: '✓ Đã giải quyết',   color: C.success, bg: '#DCFCE7' },
  closed:    { label: '● Đã đóng',         color: C.gray,    bg: '#F1F5F9' },
}

const IncidentsPage: React.FC = () => {
  const [tab, setTab] = useState<'report'|'history'|'violations'>('history')
  const [incidents, setIncidents]   = useState<any[]>([])
  const [violations, setViolations] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)

  // Report form
  const [orderId, setOrderId]       = useState('')
  const [incType, setIncType]       = useState('other')
  const [desc, setDesc]             = useState('')
  const [quickReason, setQuickReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [errMsg, setErrMsg]         = useState('')

  const loadData = () => {
    setLoading(true)
    Promise.all([
      shipmentService.getMyIncidents({ limit: 50, is_violation: false }),
      shipmentService.getMyIncidents({ limit: 50, is_violation: true }),
    ])
      .then(([incRes, vioRes]) => {
        const incs = incRes.data?.incidents ?? incRes.data
        const vios = vioRes.data?.incidents ?? vioRes.data
        if (Array.isArray(incs)) setIncidents(incs)
        if (Array.isArray(vios)) setViolations(vios)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleSelectQuick = (r: string) => {
    setQuickReason(r); setDesc(r)
  }

  const handleSubmit = async () => {
    setErrMsg('')
    if (!orderId || !desc) { setErrMsg('Vui lòng điền mã đơn hàng và mô tả'); return }
    setSubmitting(true)
    try {
      await shipmentService.createIncident({
        order_id: parseInt(orderId) || undefined,
        type: incType,
        title: INCIDENT_TYPE[incType]?.label ?? incType,
        description: desc,
      })
      setOrderId(''); setIncType('other'); setDesc(''); setQuickReason('')
      setSubmitted(true); setTimeout(() => setSubmitted(false), 3000)
      setTab('history')
      loadData()
    } catch (err: any) {
      setErrMsg(err?.response?.data?.detail ?? 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setSubmitting(false)
    }
  }

  const totalPenalty = violations.length // placeholder — backend doesn't store penalty amount yet

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>⚠️ Sự cố & Vi phạm</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 3 }}>Báo cáo sự cố khi giao hàng và xem lịch sử vi phạm</p>
      </div>

      {submitted && (
        <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 12, padding: '14px 18px', color: C.success, fontWeight: 600, fontSize: 14 }}>
          ✅ Đã gửi báo cáo sự cố! Bộ phận hỗ trợ sẽ liên hệ bạn sớm nhất.
        </div>
      )}
      {errMsg && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '14px 18px', color: C.error, fontWeight: 600, fontSize: 14 }}>
          ⚠️ {errMsg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Sự cố đang xử lý',  value: incidents.filter(i => i.status === 'open' || i.status === 'in_review').length, color: C.warning },
          { label: 'Sự cố đã giải quyết', value: incidents.filter(i => i.status === 'resolved').length, color: C.success },
          { label: 'Số vi phạm',         value: violations.length, color: C.error },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 18px', borderLeft: `3px solid ${s.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        {([
          ['report',     '📝 Báo cáo sự cố'],
          ['history',    '📋 Lịch sử sự cố'],
          ['violations', '🚫 Lịch sử vi phạm'],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === k ? C.navy : '#F1F5F9', color: tab === k ? 'white' : C.gray,
          }}>{l}</button>
        ))}
      </div>

      {/* ── Tab: Báo cáo ── */}
      {tab === 'report' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 18 }}>Báo cáo sự cố mới</h3>

          {/* Quick reasons */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.gray, marginBottom: 10, textTransform: 'uppercase' }}>Chọn lý do nhanh</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {QUICK_REASONS.map(r => (
                <button key={r} onClick={() => handleSelectQuick(r)} style={{
                  padding: '10px 14px', background: quickReason === r ? '#DBEAFE' : '#F8FAFC',
                  border: `1px solid ${quickReason === r ? C.blue : '#E2E8F0'}`,
                  borderRadius: 8, textAlign: 'left', cursor: 'pointer', fontSize: 13,
                  color: quickReason === r ? C.blue : C.navy, fontWeight: quickReason === r ? 600 : 400,
                }}>
                  {quickReason === r ? '✓ ' : ''}{r}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 6 }}>Mã đơn hàng *</label>
                <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="VD: 2031"
                  style={{ width: '100%', padding: '10px 14px', border: '2px solid #E2E8F0', borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 6 }}>Loại sự cố *</label>
                <select value={incType} onChange={e => setIncType(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '2px solid #E2E8F0', borderRadius: 9, fontSize: 13, outline: 'none' }}>
                  {Object.entries(INCIDENT_TYPE).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 6 }}>Mô tả chi tiết *</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4}
                placeholder="Mô tả chi tiết sự cố xảy ra..."
                style={{ width: '100%', padding: '10px 14px', border: '2px solid #E2E8F0', borderRadius: 9, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleSubmit} disabled={submitting} style={{
              padding: '13px', background: submitting ? '#9CA3AF' : C.navy, color: 'white', border: 'none',
              borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: submitting ? 'default' : 'pointer',
            }}>
              {submitting ? '⏳ Đang gửi...' : '📤 Gửi báo cáo sự cố'}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Lịch sử sự cố ── */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>
          ) : incidents.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 40, textAlign: 'center', color: C.gray }}>Chưa có sự cố nào</div>
          ) : incidents.map((inc: any) => {
            const itype = INCIDENT_TYPE[inc.type] ?? INCIDENT_TYPE.other
            const stype = STATUS_META[inc.status]  ?? STATUS_META.open
            const date  = inc.created_at ? String(inc.created_at).slice(0, 10) : '—'
            return (
              <div key={inc.incident_id} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 24 }}>{itype.icon}</span>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15, color: C.navy, margin: 0 }}>{inc.title}</p>
                      <p style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
                        {inc.order_id ? `Đơn #${inc.order_id} · ` : ''}{date}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: stype.bg, color: stype.color }}>{stype.label}</span>
                </div>
                {inc.description && (
                  <p style={{ fontSize: 13, color: C.navy, background: '#F8FAFC', padding: '10px 14px', borderRadius: 8, margin: 0 }}>{inc.description}</p>
                )}
                {inc.support_note && (
                  <p style={{ fontSize: 12, color: C.success, background: '#DCFCE7', padding: '8px 14px', borderRadius: 8, marginTop: 8 }}>
                    💬 Hỗ trợ: {inc.support_note}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: Vi phạm ── */}
      {tab === 'violations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>
          ) : violations.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 40, textAlign: 'center', color: C.success }}>🎉 Chưa có vi phạm nào!</div>
          ) : violations.map((v: any) => {
            const itype = INCIDENT_TYPE[v.type] ?? INCIDENT_TYPE.other
            const date  = v.created_at ? String(v.created_at).slice(0, 10) : '—'
            return (
              <div key={v.incident_id} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 20px', borderLeft: `3px solid ${C.error}`, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span>{itype.icon}</span>
                    <p style={{ fontWeight: 600, fontSize: 14, color: C.navy, margin: 0 }}>{v.title}</p>
                  </div>
                  {v.description && <p style={{ fontSize: 13, color: C.gray, margin: '0 0 4px' }}>{v.description}</p>}
                  <p style={{ fontSize: 12, color: C.gray }}>🕐 {date}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.error, background: '#FEE2E2', padding: '2px 9px', borderRadius: 20, flexShrink: 0, marginLeft: 16 }}>Vi phạm</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default IncidentsPage
