/**
 * 🚚 Shipping Config Admin — Cấu hình vận chuyển
 * Nhóm 8: thêm, sửa vùng/phương thức vận chuyển, cấu hình phí
 */
import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { adminService } from '../../services/adminService'
import API from '../../services/api'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const EMPTY_ZONE   = { name: '', provinces: '', base_fee: '', per_kg: '', estimated_days: '' }
const EMPTY_METHOD = { name: '', code: '', description: '', is_active: true }

/* ─── Size Tiers Tab ──────────────────────────────────────────────────────── */

const DEFAULT_OVERSIZE_FEE = 200000

function calcTier(tiers: any[], l: number, w: number, h: number, kg: number) {
  if (!l && !w && !h && !kg) return null
  const sorted = [...tiers].sort((a, b) => a.tier_level - b.tier_level)
  const pick = (val: number, field: string) =>
    val > 0 ? sorted.find(t => val <= t[field]) : sorted[0]
  const tl = pick(l, 'max_length_cm')
  const tw = pick(w, 'max_width_cm')
  const th = pick(h, 'max_height_cm')
  const tk = pick(kg, 'max_weight_kg')
  const candidates = [tl, tw, th, tk].filter(Boolean)
  if (!candidates.length) return null
  const best = candidates.reduce((a, b) => (a.tier_level >= b.tier_level ? a : b))
  // quá khổ nếu không vừa bậc nào
  const oversized = [tl, tw, th, tk].some((v, i) => {
    const val = [l, w, h, kg][i]
    return val > 0 && !v
  })
  if (oversized) return { tier_level: 6, label: 'Quá khổ', extra_fee: DEFAULT_OVERSIZE_FEE }
  return best
}

const SizeTiersTab: React.FC = () => {
  const [tiers, setTiers]     = useState<any[]>([])
  const [edited, setEdited]   = useState<any[]>([])
  const [saving, setSaving]   = useState(false)
  const [prevL, setPL]        = useState('')
  const [prevW, setPW]        = useState('')
  const [prevH, setPH]        = useState('')
  const [prevKg, setPKg]      = useState('')

  useEffect(() => {
    API.get('/api/v1/admin/shipping/size-tiers').then((r: any) => {
      const t = r.data?.tiers ?? []
      setTiers(t)
      setEdited(t.map((x: any) => ({ ...x })))
    }).catch(() => {})
  }, [])

  const update = (idx: number, field: string, val: string) => {
    setEdited(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t))
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = edited.map(t => ({
        tier_level:    t.tier_level,
        label:         t.label,
        max_length_cm: Number(t.max_length_cm),
        max_width_cm:  Number(t.max_width_cm),
        max_height_cm: Number(t.max_height_cm),
        max_weight_kg: Number(t.max_weight_kg),
        extra_fee:     Number(t.extra_fee),
      }))
      await API.put('/api/v1/admin/shipping/size-tiers', { tiers: payload })
      setTiers(edited.map(t => ({ ...t })))
      toast.success('Đã lưu cấu hình bậc kích thước')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi lưu cấu hình')
    } finally { setSaving(false) }
  }

  const reset = () => setEdited(tiers.map(t => ({ ...t })))

  // Preview
  const pl = parseFloat(prevL) || 0
  const pw = parseFloat(prevW) || 0
  const ph = parseFloat(prevH) || 0
  const pk = parseFloat(prevKg) || 0
  const previewTier = calcTier(edited, pl, pw, ph, pk)

  const tierColors: Record<number, string> = { 1:'#0D9488', 2:'#2563EB', 3:'#D97706', 4:'#7C3AED', 5:'#DC2626', 6:'#B45309' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Bảng 5 bậc editable */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontWeight: 800, color: '#1E3A8A', fontSize: 15, margin: 0 }}>⚖️ 5 Bậc kích thước</p>
            <p style={{ fontSize: 12, color: '#64748B', margin: '3px 0 0' }}>Hệ thống tự xếp bậc khi shop đóng gói. Chỉ sửa số liệu, không thêm/xóa bậc.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ padding: '7px 14px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              🔄 Khôi phục
            </button>
            <button onClick={save} disabled={saving} style={{ padding: '7px 16px', background: saving ? '#94A3B8' : '#1D4ED8', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {saving ? '⏳ Đang lưu...' : '💾 Lưu cấu hình'}
            </button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['Bậc', 'Tên bậc', 'Dài tối đa (cm)', 'Rộng tối đa (cm)', 'Cao tối đa (cm)', 'Cân tối đa (kg)', 'Phí thêm (₫)'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {edited.map((t, i) => (
              <tr key={t.tier_level} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{ background: tierColors[t.tier_level] + '20', color: tierColors[t.tier_level], borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 800 }}>
                    Bậc {t.tier_level}
                  </span>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <input value={t.label} onChange={e => update(i, 'label', e.target.value)}
                    style={{ width: 100, padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 13, outline: 'none' }} />
                </td>
                {(['max_length_cm','max_width_cm','max_height_cm','max_weight_kg'] as const).map(field => (
                  <td key={field} style={{ padding: '11px 14px' }}>
                    <input type="number" value={t[field]} onChange={e => update(i, field, e.target.value)}
                      style={{ width: 80, padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 13, outline: 'none', textAlign: 'right' }} />
                  </td>
                ))}
                <td style={{ padding: '11px 14px' }}>
                  <input type="number" value={t.extra_fee} onChange={e => update(i, 'extra_fee', e.target.value)}
                    style={{ width: 100, padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 13, outline: 'none', textAlign: 'right' }} />
                </td>
              </tr>
            ))}
            {/* Bậc 6 quá khổ — cố định */}
            <tr style={{ background: '#FEF9C3', borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '11px 14px' }}>
                <span style={{ background: '#B4530920', color: '#B45309', borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 800 }}>Bậc 6</span>
              </td>
              <td style={{ padding: '11px 14px', fontSize: 13, color: '#92400E', fontWeight: 600 }}>Quá khổ</td>
              <td colSpan={4} style={{ padding: '11px 14px', fontSize: 12, color: '#92400E' }}>Vượt quá bậc 5 (không thể chỉnh)</td>
              <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 800, color: '#DC2626' }}>+200,000₫</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Preview live */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <p style={{ fontWeight: 800, color: '#1E3A8A', fontSize: 14, margin: '0 0 14px' }}>🔍 Preview — Nhập kích thước để xem bậc</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { label: 'Dài (cm)',  val: prevL,  set: setPL  },
            { label: 'Rộng (cm)', val: prevW,  set: setPW  },
            { label: 'Cao (cm)',  val: prevH,  set: setPH  },
            { label: 'Cân (kg)',  val: prevKg, set: setPKg },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4, fontWeight: 600 }}>{f.label}</label>
              <input type="number" value={f.val} onChange={e => f.set(e.target.value)} placeholder="0"
                style={{ width: 90, padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none', textAlign: 'center' }} />
            </div>
          ))}
        </div>
        {previewTier ? (
          <div style={{ background: tierColors[previewTier.tier_level] + '15', border: `2px solid ${tierColors[previewTier.tier_level]}`, borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: tierColors[previewTier.tier_level] }}>Bậc {previewTier.tier_level}</span>
            <div>
              <p style={{ fontWeight: 800, color: tierColors[previewTier.tier_level], margin: 0, fontSize: 15 }}>📦 {previewTier.label}</p>
              <p style={{ color: '#64748B', margin: '3px 0 0', fontSize: 13 }}>
                Phí thêm: <strong style={{ color: '#DC2626' }}>+{(previewTier.extra_fee || 0).toLocaleString('vi-VN')}₫</strong>
              </p>
            </div>
          </div>
        ) : (
          <p style={{ color: '#94A3B8', fontSize: 13 }}>Nhập kích thước để xem bậc phí được áp dụng</p>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

const ShippingConfigPage: React.FC = () => {
  const [zones, setZones]     = useState<any[]>([])
  const [methods, setMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab]   = useState<'zones' | 'methods' | 'tiers'>('zones')
  const [showZoneForm, setShowZoneForm]     = useState(false)
  const [showMethodForm, setShowMethodForm] = useState(false)
  const [editZoneId, setEditZoneId]     = useState<number | null>(null)
  const [editMethodId, setEditMethodId] = useState<number | null>(null)
  const [zoneForm, setZoneForm]     = useState<any>(EMPTY_ZONE)
  const [methodForm, setMethodForm] = useState<any>(EMPTY_METHOD)
  const [error, setError] = useState('')

  const fmt = (n: number) => n.toLocaleString('vi-VN') + '₫'

  const loadData = async () => {
    try {
      const [zRes, mRes] = await Promise.all([
        adminService.getShippingZones(),
        adminService.getShippingMethods(),
      ])
      setZones(zRes.data?.zones ?? zRes.data ?? [])
      setMethods(mRes.data?.methods ?? mRes.data ?? [])
    } catch {
      setZones([])
      setMethods([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Zone handlers
  const openAddZone  = () => { setZoneForm(EMPTY_ZONE); setEditZoneId(null); setShowZoneForm(true); setError('') }
  const openEditZone = (z: any) => {
    setZoneForm({ name: z.name, provinces: z.provinces, base_fee: z.base_fee, per_kg: z.per_kg, estimated_days: z.estimated_days })
    setEditZoneId(z.zone_id)
    setShowZoneForm(true)
    setError('')
  }
  const removeZone = async (id: number) => {
    if (!window.confirm('Xóa vùng vận chuyển?')) return
    await adminService.deleteShippingZone(id)
    setZones(zs => zs.filter(z => z.zone_id !== id))
  }
  const saveZone = async () => {
    setError('')
    const payload = {
      name: zoneForm.name,
      provinces: zoneForm.provinces,
      base_fee: Number(zoneForm.base_fee) || 0,
      per_kg:   Number(zoneForm.per_kg) || 0,
      estimated_days: zoneForm.estimated_days,
    }
    try {
      if (editZoneId !== null) {
        await adminService.updateShippingZone(editZoneId, payload)
      } else {
        await adminService.createShippingZone(payload)
      }
      setShowZoneForm(false)
      loadData()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Lỗi khi lưu vùng vận chuyển')
    }
  }

  // Method handlers
  const openAddMethod  = () => { setMethodForm(EMPTY_METHOD); setEditMethodId(null); setShowMethodForm(true); setError('') }
  const openEditMethod = (m: any) => {
    setMethodForm({ name: m.name, code: m.code, description: m.description, is_active: m.is_active })
    setEditMethodId(m.method_id)
    setShowMethodForm(true)
    setError('')
  }
  const removeMethod = async (id: number) => {
    if (!window.confirm('Xóa phương thức vận chuyển?')) return
    await adminService.deleteShippingMethod(id)
    setMethods(ms => ms.filter(m => m.method_id !== id))
  }
  const toggleMethod = async (m: any) => {
    await adminService.updateShippingMethod(m.method_id, { is_active: !m.is_active })
    setMethods(ms => ms.map(x => x.method_id === m.method_id ? { ...x, is_active: !x.is_active } : x))
  }
  const saveMethod = async () => {
    setError('')
    try {
      if (editMethodId !== null) {
        await adminService.updateShippingMethod(editMethodId, methodForm)
      } else {
        await adminService.createShippingMethod(methodForm)
      }
      setShowMethodForm(false)
      loadData()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Lỗi khi lưu phương thức')
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🚚 Cấu hình vận chuyển</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Quản lý vùng giao hàng, phương thức vận chuyển và cấu hình phí</p>
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            ['zones',   '🗺️ Vùng vận chuyển'],
            ['methods', '📦 Phương thức VC'],
            ['tiers',   '⚖️ Phí theo kích thước'],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setActiveTab(t as any)} style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === t ? C.blue : C.tint, color: activeTab === t ? 'white' : C.gray,
            }}>{label}</button>
          ))}
        </div>
        {activeTab !== 'tiers' && (
          <button
            onClick={() => activeTab === 'zones' ? openAddZone() : openAddMethod()}
            style={{ padding: '8px 18px', background: C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Thêm mới
          </button>
        )}
      </div>

      {/* Zones tab */}
      {activeTab === 'zones' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.tint }}>
                {['Tên vùng', 'Tỉnh/TP áp dụng', 'Phí cơ bản', 'Phí/kg thêm', 'Thời gián ước tính', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Chưa có vùng nào. Nhấn "+ Thêm mới" để bắt đầu.</td></tr>
              ) : zones.map(z => (
                <tr key={z.zone_id} style={{ borderBottom: `1px solid ${C.tint}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '13px 16px', fontWeight: 700, fontSize: 14, color: C.navy }}>{z.name}</td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: C.gray, maxWidth: 200 }}>{z.provinces}</td>
                  <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 700, color: C.blue }}>{fmt(z.base_fee)}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13 }}>{fmt(z.per_kg)}/kg</td>
                  <td style={{ padding: '13px 16px', fontSize: 13 }}>{z.estimated_days} ngày</td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEditZone(z)} style={{ padding: '5px 10px', background: C.light, color: C.blue, border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✏️ Sửa</button>
                      <button onClick={() => removeZone(z.zone_id)} style={{ padding: '5px 10px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Methods tab */}
      {activeTab === 'methods' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {methods.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray, gridColumn: '1/-1' }}>
              Chưa có phương thức nào. Nhấn "+ Thêm mới" để bắt đầu.
            </div>
          ) : methods.map(m => (
            <div key={m.method_id} className="card" style={{ padding: '18px 20px', borderLeft: `4px solid ${m.is_active ? C.success : C.gray}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{m.name}</p>
                  <code style={{ fontSize: 11, background: C.tint, color: C.gray, padding: '2px 7px', borderRadius: 5 }}>{m.code}</code>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: m.is_active ? '#DCFCE7' : '#F1F5F9', color: m.is_active ? C.success : C.gray }}>
                  {m.is_active ? 'Hoạt động' : 'Tắt'}
                </span>
              </div>
              <p style={{ fontSize: 13, color: C.gray, marginBottom: 14 }}>{m.description}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openEditMethod(m)} style={{ flex: 1, padding: '7px', background: C.light, color: C.blue, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✏️ Sửa</button>
                <button onClick={() => toggleMethod(m)}
                  style={{ flex: 1, padding: '7px', background: m.is_active ? '#FEE2E2' : '#DCFCE7', color: m.is_active ? C.error : C.success, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {m.is_active ? '⏸️ Tắt' : '▶️ Bật'}
                </button>
                <button onClick={() => removeMethod(m.method_id)} style={{ padding: '7px 10px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Size Tiers tab */}
      {activeTab === 'tiers' && <SizeTiersTab />}

      {/* Zone Form Modal */}
      {showZoneForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setShowZoneForm(false)}>
          <div className="card" style={{ width:460, padding:28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ fontSize:18, fontWeight:800, color:C.navy }}>{editZoneId ? 'Sửa vùng vận chuyển' : 'Thêm vùng mới'}</h2>
              <button onClick={() => setShowZoneForm(false)} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:C.gray }}>✕</button>
            </div>
            {error && <div style={{ padding:'8px 12px', background:'#FEE2E2', color:C.error, borderRadius:8, marginBottom:12, fontSize:13 }}>{error}</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'name',           label:'Tên vùng',                  type:'text',   placeholder:'VD: Nội thành HCM' },
                { key:'provinces',      label:'Tỉnh/TP áp dụng',           type:'text',   placeholder:'VD: HCM, Bình Dương' },
                { key:'base_fee',       label:'Phí cơ bản (₫)',            type:'number', placeholder:'VD: 30000' },
                { key:'per_kg',         label:'Phí/kg thêm (₫)',           type:'number', placeholder:'VD: 5000' },
                { key:'estimated_days', label:'Thời gián ước tính (ngày)', type:'text',   placeholder:'VD: 1-2' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:12, fontWeight:600, color:C.gray, display:'block', marginBottom:4 }}>{f.label}</label>
                  <input type={f.type} value={zoneForm[f.key] ?? ''} placeholder={f.placeholder}
                    onChange={e => setZoneForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width:'100%', padding:'9px 12px', border:`1px solid ${C.light}`, borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowZoneForm(false)} style={{ flex:1, padding:'10px', background:C.tint, color:C.gray, border:'none', borderRadius:9, fontWeight:600, cursor:'pointer' }}>Hủy</button>
              <button onClick={saveZone} style={{ flex:2, padding:'10px', background:C.blue, color:'white', border:'none', borderRadius:9, fontWeight:700, cursor:'pointer' }}>{editZoneId ? 'Lưu' : 'Thêm mới'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Method Form Modal */}
      {showMethodForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setShowMethodForm(false)}>
          <div className="card" style={{ width:420, padding:28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ fontSize:18, fontWeight:800, color:C.navy }}>{editMethodId ? 'Sửa phương thức' : 'Thêm phương thức'}</h2>
              <button onClick={() => setShowMethodForm(false)} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:C.gray }}>✕</button>
            </div>
            {error && <div style={{ padding:'8px 12px', background:'#FEE2E2', color:C.error, borderRadius:8, marginBottom:12, fontSize:13 }}>{error}</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'name',        label:'Tên phương thức', type:'text', placeholder:'VD: Giao hàng nhanh' },
                { key:'code',        label:'Mã (code)',        type:'text', placeholder:'VD: EXPRESS' },
                { key:'description', label:'Mô tả',           type:'text', placeholder:'VD: Giao trong 2-4 giờ' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:12, fontWeight:600, color:C.gray, display:'block', marginBottom:4 }}>{f.label}</label>
                  <input type={f.type} value={methodForm[f.key] ?? ''} placeholder={f.placeholder}
                    onChange={e => setMethodForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width:'100%', padding:'9px 12px', border:`1px solid ${C.light}`, borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <label style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={methodForm.is_active} onChange={e => setMethodForm((p: any) => ({ ...p, is_active: e.target.checked }))} />
                Kích hoạt ngay
              </label>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowMethodForm(false)} style={{ flex:1, padding:'10px', background:C.tint, color:C.gray, border:'none', borderRadius:9, fontWeight:600, cursor:'pointer' }}>Hủy</button>
              <button onClick={saveMethod} style={{ flex:2, padding:'10px', background:C.blue, color:'white', border:'none', borderRadius:9, fontWeight:700, cursor:'pointer' }}>{editMethodId ? 'Lưu' : 'Thêm mới'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShippingConfigPage
