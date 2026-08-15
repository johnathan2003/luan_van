/**
 * AIGuardianPage.tsx — "AI Guardian": nhật ký sự cố hệ thống
 * ---------------------------------------------------------------------------
 * Trình bày AI như một người bảo vệ luôn túc trực, quét hệ thống, tự xử lý
 * sự cố. Nội dung dựng từ template (điền số liệu thật), không gọi LLM thật
 * lúc runtime — ổn định 100% để demo trước hội đồng.
 *
 * GET  /api/v1/ai-incidents/templates
 * GET  /api/v1/ai-incidents
 * POST /api/v1/ai-incidents/preview
 * POST /api/v1/ai-incidents
 */
import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'

interface Field { key: string; label: string; type: 'text' | 'number'; default: string | number }
interface Template { category: string; label: string; icon: string; default_severity: string; fields: Field[] }
interface Incident {
  incident_id: number; category: string; severity: string; title: string
  root_cause: string; actions_taken: string[]; detected_at: string
  resolved_at: string | null; status: string
}

const C = {
  navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE',
  gray: 'var(--text-secondary)', border: 'var(--border-subtle)', card: 'var(--bg-card)',
  success: '#16A34A', warning: '#D97706', error: '#DC2626',
}
const SEVERITY_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  info:     { color: C.blue,    bg: C.light,          label: 'Thông tin' },
  warning:  { color: C.warning, bg: '#FEF3C7',         label: 'Cảnh báo' },
  critical: { color: C.error,   bg: '#FEE2E2',         label: 'Nghiêm trọng' },
}
const STATUS_LABEL: Record<string, string> = { detected: '🔍 Đang phát hiện', mitigating: '🛠️ Đang xử lý', resolved: '✅ Đã khắc phục' }

function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const btn = (color: string, disabled?: boolean): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700,
  background: disabled ? '#9CA3AF' : color, color: '#fff', cursor: disabled ? 'default' : 'pointer',
})
const inputStyle: React.CSSProperties = { padding: '8px 11px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13 }

const AIGuardianPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    API.get('/api/v1/ai-incidents').then(r => setIncidents(r.data.incidents || [])).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h2 style={{ margin: 0 }}>🛡️ AI Guardian — Nhật ký bảo vệ hệ thống</h2>
          <p style={{ color: C.gray, fontSize: 13, marginTop: 4 }}>
            AI quét hệ thống liên tục, ghi lại các sự cố phát hiện được và các bước đã tự động xử lý để đảm bảo hệ thống luôn hoạt động.
          </p>
        </div>
        <button onClick={() => setFormOpen(o => !o)} style={btn(C.navy)}>{formOpen ? '✕ Đóng' : '+ Ghi nhận sự cố'}</button>
      </div>

      {formOpen && <IncidentForm onSaved={() => { setFormOpen(false); load() }} />}

      <div style={{ marginTop: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.gray }}>Đang tải...</div>
        ) : incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🛡️</div>
            <p style={{ color: C.gray }}>Chưa ghi nhận sự cố nào — hệ thống đang chạy ổn định.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {incidents.map((i, idx) => <IncidentCard key={i.incident_id} incident={i} isFirst={idx === 0} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Timeline card ────────────────────────────────────────────────────────────
const IncidentCard: React.FC<{ incident: Incident; isFirst: boolean }> = ({ incident: i, isFirst }) => {
  const [open, setOpen] = useState(isFirst)
  const sev = SEVERITY_STYLE[i.severity] || SEVERITY_STYLE.warning

  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {/* Timeline rail */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: sev.color, marginTop: 18, flexShrink: 0 }} />
        <div style={{ width: 2, flex: 1, background: C.border, marginTop: 4 }} />
      </div>

      <div style={{ flex: 1, paddingBottom: 16 }}>
        <div onClick={() => setOpen(o => !o)}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ background: sev.bg, color: sev.color, borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{sev.label}</span>
                <span style={{ fontSize: 12, color: C.gray }}>{STATUS_LABEL[i.status] || i.status}</span>
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{i.title}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: C.gray }}>{fmtDate(i.detected_at)}</div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{open ? '▲ thu gọn' : '▼ chi tiết'}</div>
            </div>
          </div>

          {open && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: C.gray, lineHeight: 1.6 }}>{i.root_cause}</p>
              <div style={{ background: '#0F172A', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>
                {i.actions_taken.map((step, idx) => (
                  <div key={idx} style={{ color: '#86EFAC', padding: '3px 0', display: 'flex', gap: 8 }}>
                    <span style={{ color: '#475569' }}>[{idx + 1}]</span>
                    <span>✔ {step}</span>
                  </div>
                ))}
              </div>
              {i.resolved_at && (
                <p style={{ margin: '10px 0 0', fontSize: 12, color: C.success, fontWeight: 600 }}>
                  ✅ Đã khắc phục lúc {fmtDate(i.resolved_at)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Form tạo sự cố ────────────────────────────────────────────────────────────
const IncidentForm: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [category, setCategory] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [severity, setSeverity] = useState('warning')
  const [status, setStatus] = useState('resolved')
  const [detectedAt, setDetectedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [preview, setPreview] = useState<{ title: string; root_cause: string; actions_taken: string[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customRootCause, setCustomRootCause] = useState('')
  const [customActions, setCustomActions] = useState('')

  const customPayload = () => ({
    title: customTitle, root_cause: customRootCause,
    actions: customActions.split('\n').map(s => s.trim()).filter(Boolean),
  })

  useEffect(() => {
    API.get('/api/v1/ai-incidents/templates').then(r => setTemplates(r.data.templates || []))
  }, [])

  const tpl = templates.find(t => t.category === category)

  const selectCategory = (cat: string) => {
    setCategory(cat)
    const t = templates.find(x => x.category === cat)
    if (t) {
      setSeverity(t.default_severity)
      const init: Record<string, string> = {}
      t.fields.forEach(f => { init[f.key] = String(f.default) })
      setValues(init)
    }
    setPreview(null)
  }

  const runPreview = async () => {
    if (!category) return
    try {
      const r = await API.post('/api/v1/ai-incidents/preview', {
        category, values, custom: category === 'custom' ? customPayload() : undefined,
      })
      setPreview(r.data)
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Lỗi xem trước') }
  }

  const handleSave = async () => {
    if (!category) { toast.error('Chọn loại sự cố'); return }
    if (category === 'custom' && (!customTitle || !customRootCause)) { toast.error('Nhập tiêu đề và nguyên nhân'); return }
    setSaving(true)
    try {
      await API.post('/api/v1/ai-incidents', {
        category, values, severity, status,
        custom: category === 'custom' ? customPayload() : undefined,
        detected_at: detectedAt,
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      })
      toast.success('✅ Đã ghi nhận sự cố')
      onSaved()
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Lỗi khi lưu') } finally { setSaving(false) }
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {templates.map(t => (
          <button key={t.category} onClick={() => selectCategory(t.category)}
            style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${category === t.category ? C.navy : C.border}`, background: category === t.category ? C.navy : 'transparent', color: category === t.category ? '#fff' : undefined, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tpl && tpl.fields.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {tpl.fields.map(f => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
              <label style={{ fontSize: 11, color: C.gray }}>{f.label}</label>
              <input value={values[f.key] ?? ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })}
                type={f.type === 'number' ? 'number' : 'text'} style={inputStyle} />
            </div>
          ))}
        </div>
      )}

      {category === 'custom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Tiêu đề" value={customTitle} onChange={e => setCustomTitle(e.target.value)} style={inputStyle} />
          <textarea placeholder="Nguyên nhân" rows={2} value={customRootCause} onChange={e => setCustomRootCause(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
          <textarea placeholder="Các bước đã xử lý (mỗi dòng 1 bước)" rows={3} value={customActions} onChange={e => setCustomActions(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      )}

      {category && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={severity} onChange={e => setSeverity(e.target.value)} style={inputStyle}>
            <option value="info">Thông tin</option>
            <option value="warning">Cảnh báo</option>
            <option value="critical">Nghiêm trọng</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
            <option value="resolved">Đã khắc phục</option>
            <option value="mitigating">Đang xử lý</option>
            <option value="detected">Vừa phát hiện</option>
          </select>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: C.gray }}>Thời điểm phát hiện (có thể lùi ngày)</label>
            <input type="datetime-local" value={detectedAt} onChange={e => setDetectedAt(e.target.value)} style={inputStyle} />
          </div>
          <button onClick={runPreview} style={{ ...btn('#6B7280'), alignSelf: 'flex-end' }}>👁 Xem trước</button>
        </div>
      )}

      {preview && (
        <div style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 13 }}>{preview.title}</p>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: C.gray }}>{preview.root_cause}</p>
          <div style={{ background: '#0F172A', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>
            {preview.actions_taken.map((s, idx) => <div key={idx} style={{ color: '#86EFAC', padding: '2px 0' }}>[{idx + 1}] ✔ {s}</div>)}
          </div>
        </div>
      )}

      {category && (
        <button onClick={handleSave} disabled={saving} style={{ ...btn(C.success, saving), alignSelf: 'flex-start' }}>
          {saving ? '⏳...' : '✅ Lưu vào nhật ký'}
        </button>
      )}
    </div>
  )
}

export default AIGuardianPage
