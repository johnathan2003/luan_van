/**
 * 🚚 Shipping Config Admin — Cấu hình vận chuyển
 * Nhóm 8: thêm, sửa vùng/phương thức vận chuyển, cấu hình phí
 */
import React, { useState, useEffect } from 'react'
import { adminService } from '../../services/adminService'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const EMPTY_ZONE   = { name: '', provinces: '', base_fee: '', per_kg: '', estimated_days: '' }
const EMPTY_METHOD = { name: '', code: '', description: '', is_active: true }

const ShippingConfigPage: React.FC = () => {
  const [zones, setZones]     = useState<any[]>([])
  const [methods, setMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab]   = useState<'zones' | 'methods'>('zones')
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
          {(['zones','methods'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: '8px 22px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === t ? C.blue : C.tint, color: activeTab === t ? 'white' : C.gray,
            }}>{t === 'zones' ? '🗺️ Vùng vận chuyển' : '📦 Phương thức VC'}</button>
          ))}
        </div>
        <button
          onClick={() => activeTab === 'zones' ? openAddZone() : openAddMethod()}
          style={{ padding: '8px 18px', background: C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Thêm mới
        </button>
      </div>

      {/* Zones tab */}
      {activeTab === 'zones' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.tint }}>
                {['Tên vùng', 'Tỉnh/TP áp dụng', 'Phí cơ bản', 'Phí/kg thêm', 'Thời gian ước tính', ''].map(h => (
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
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
                { key:'estimated_days', label:'Thời gian ước tính (ngày)', type:'text',   placeholder:'VD: 1-2' },
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
