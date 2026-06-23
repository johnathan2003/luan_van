/**
 * 🚚 Shipping Config Admin — Cấu hình vận chuyển
 * Nhóm 8: thêm, sửa vùng/phương thức vận chuyển, cấu hình phí
 */
import React, { useState } from 'react'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const EMPTY_ZONE = { name: '', provinces: '', base_fee: '', per_kg: '', estimated_days: '' }
const EMPTY_METHOD = { name: '', code: '', description: '', is_active: true }

const ShippingConfigPage: React.FC = () => {
  const [zones, setZones]           = useState(MOCK_ZONES)
  const [methods, setMethods]       = useState(MOCK_METHODS)
  const [activeTab, setActiveTab]   = useState<'zones' | 'methods'>('zones')
  const [showZoneForm, setShowZoneForm]     = useState(false)
  const [showMethodForm, setShowMethodForm] = useState(false)
  const [editZoneId, setEditZoneId]   = useState<number | null>(null)
  const [editMethodId, setEditMethodId] = useState<number | null>(null)
  const [zoneForm, setZoneForm]       = useState<any>(EMPTY_ZONE)
  const [methodForm, setMethodForm]   = useState<any>(EMPTY_METHOD)

  const fmt = (n: number) => n.toLocaleString('vi-VN') + '₫'

  // Zone handlers
  const openAddZone   = () => { setZoneForm(EMPTY_ZONE); setEditZoneId(null); setShowZoneForm(true) }
  const openEditZone  = (z: any) => { setZoneForm({ ...z }); setEditZoneId(z.id); setShowZoneForm(true) }
  const removeZone    = (id: number) => { if (window.confirm('Xóa vùng vận chuyển?')) setZones(zs => zs.filter(z => z.id !== id)) }
  const saveZone = () => {
    if (editZoneId !== null) setZones(zs => zs.map(z => z.id === editZoneId ? { ...z, ...zoneForm } : z))
    else setZones(zs => [...zs, { ...zoneForm, id: Date.now() }])
    setShowZoneForm(false)
  }

  // Method handlers
  const openAddMethod   = () => { setMethodForm(EMPTY_METHOD); setEditMethodId(null); setShowMethodForm(true) }
  const openEditMethod  = (m: any) => { setMethodForm({ ...m }); setEditMethodId(m.id); setShowMethodForm(true) }
  const removeMethod    = (id: number) => { if (window.confirm('Xóa phương thức vận chuyển?')) setMethods(ms => ms.filter(m => m.id !== id)) }
  const saveMethod = () => {
    if (editMethodId !== null) setMethods(ms => ms.map(m => m.id === editMethodId ? { ...m, ...methodForm } : m))
    else setMethods(ms => [...ms, { ...methodForm, id: Date.now() }])
    setShowMethodForm(false)
  }

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
              {zones.map(z => (
                <tr key={z.id} style={{ borderBottom: `1px solid ${C.tint}` }}
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
                      <button onClick={() => removeZone(z.id)} style={{ padding: '5px 10px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>🗑️</button>
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
          {methods.map(m => (
            <div key={m.id} className="card" style={{ padding: '18px 20px', borderLeft: `4px solid ${m.is_active ? C.success : C.gray}` }}>
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
                <button onClick={() => setMethods(ms => ms.map(x => x.id === m.id ? { ...x, is_active: !x.is_active } : x))}
                  style={{ flex: 1, padding: '7px', background: m.is_active ? '#FEE2E2' : '#DCFCE7', color: m.is_active ? C.error : C.success, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {m.is_active ? '⏸️ Tắt' : '▶️ Bật'}
                </button>
                <button onClick={() => removeMethod(m.id)} style={{ padding: '7px 10px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>🗑️</button>
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
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'name', label:'Tên vùng', type:'text', placeholder:'VD: Nội thành HCM' },
                { key:'provinces', label:'Tỉnh/TP áp dụng', type:'text', placeholder:'VD: HCM, Bình Dương' },
                { key:'base_fee', label:'Phí cơ bản (₫)', type:'number', placeholder:'VD: 30000' },
                { key:'per_kg', label:'Phí/kg thêm (₫)', type:'number', placeholder:'VD: 5000' },
                { key:'estimated_days', label:'Thời gian ước tính (ngày)', type:'number', placeholder:'VD: 1-2' },
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
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'name', label:'Tên phương thức', type:'text', placeholder:'VD: Giao hàng nhanh' },
                { key:'code', label:'Mã (code)', type:'text', placeholder:'VD: EXPRESS' },
                { key:'description', label:'Mô tả', type:'text', placeholder:'VD: Giao trong 2-4 giờ' },
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

const MOCK_ZONES = [
  { id:1, name:'Nội thành HCM',  provinces:'TP.HCM',                      base_fee:25000, per_kg:4000, estimated_days:'1-2' },
  { id:2, name:'Vùng lân cận',   provinces:'Bình Dương, Đồng Nai, Long An',base_fee:35000, per_kg:5000, estimated_days:'2-3' },
  { id:3, name:'Miền Tây',       provinces:'Cần Thơ, An Giang, Vĩnh Long', base_fee:45000, per_kg:6000, estimated_days:'3-4' },
  { id:4, name:'Miền Bắc',       provinces:'Hà Nội, Hải Phòng, Hải Dương',base_fee:50000, per_kg:7000, estimated_days:'3-5' },
  { id:5, name:'Miền Trung',     provinces:'Đà Nẵng, Huế, Quảng Nam',     base_fee:45000, per_kg:6500, estimated_days:'3-4' },
]

const MOCK_METHODS = [
  { id:1, name:'Giao hàng tiêu chuẩn', code:'STANDARD', description:'Giao hàng trong 3-5 ngày làm việc.',        is_active: true },
  { id:2, name:'Giao hàng nhanh',      code:'EXPRESS',  description:'Giao trong vòng 24 giờ kể từ lúc lấy hàng.', is_active: true },
  { id:3, name:'Hỏa tốc',             code:'SAMEDAY',  description:'Giao trong 2-4 giờ (chỉ nội thành HCM).',    is_active: true },
  { id:4, name:'Giao hàng quốc tế',    code:'INTL',     description:'Dành cho đơn hàng quốc tế, 7-14 ngày.',      is_active: false },
]

export default ShippingConfigPage
