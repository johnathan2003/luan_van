/**
 * 🎫 Voucher Admin — Quản lý mã giảm giá
 * Nhóm 5: thêm, xóa, sửa, duyệt mã giảm giá
 */
import React, { useState } from 'react'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const EMPTY = { code: '', discount_type: 'percentage', discount_value: '', max_uses: '', valid_from: '', valid_to: '', status: 'pending' }

const VoucherAdminPage: React.FC = () => {
  const [vouchers, setVouchers] = useState(MOCK_VOUCHERS)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<number | null>(null)
  const [form, setForm]         = useState<any>(EMPTY)
  const [search, setSearch]     = useState('')

  const filtered = vouchers.filter(v => !search || v.code.toLowerCase().includes(search.toLowerCase()))

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setShowForm(true) }
  const openEdit = (v: any) => { setForm({ ...v }); setEditId(v.id); setShowForm(true) }

  const handleSave = () => {
    if (editId !== null) {
      setVouchers(vs => vs.map(v => v.id === editId ? { ...v, ...form } : v))
    } else {
      setVouchers(vs => [...vs, { ...form, id: Date.now(), current_uses: 0, status: 'pending' }])
    }
    setShowForm(false)
  }

  const handleDelete  = (id: number) => { if (window.confirm('Xóa mã giảm giá này?')) setVouchers(vs => vs.filter(v => v.id !== id)) }
  const handleApprove = (id: number) => setVouchers(vs => vs.map(v => v.id === id ? { ...v, status: 'active' } : v))

  const statusColor: Record<string, string> = { active: C.success, pending: C.warning, expired: C.gray, inactive: C.error }
  const statusBg:    Record<string, string> = { active: '#DCFCE7', pending: '#FEF3C7', expired: '#F1F5F9', inactive: '#FEE2E2' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🎫 Quản lý mã giảm giá</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Thêm, chỉnh sửa, duyệt và xóa voucher trên nền tảng</p>
        </div>
        <button onClick={openAdd} style={{ padding: '10px 20px', background: C.blue, color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          + Thêm voucher
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Tổng voucher', value: vouchers.length,                               color: C.blue,    bg: C.light },
          { label: 'Đang hoạt động',value: vouchers.filter(v=>v.status==='active').length,color: C.success, bg:'#DCFCE7' },
          { label: 'Chờ duyệt',   value: vouchers.filter(v=>v.status==='pending').length, color: C.warning, bg:'#FEF3C7' },
          { label: 'Hết hạn',     value: vouchers.filter(v=>v.status==='expired').length, color: C.gray,    bg:'#F1F5F9' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm mã voucher..."
          style={{ width: '100%', padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Mã', 'Loại', 'Giá trị', 'Đã dùng / Tối đa', 'Hiệu lực', 'Trạng thái', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id} style={{ borderBottom: `1px solid ${C.tint}` }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '12px 14px' }}>
                  <code style={{ background: C.light, color: C.navy, padding: '3px 9px', borderRadius: 6, fontWeight: 700, fontSize: 13 }}>{v.code}</code>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13 }}>{v.discount_type === 'percentage' ? 'Phần trăm' : 'Cố định'}</td>
                <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: C.navy }}>
                  {v.discount_type === 'percentage' ? `${v.discount_value}%` : `${Number(v.discount_value).toLocaleString('vi-VN')}₫`}
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13 }}>{v.current_uses} / {v.max_uses}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: C.gray }}>
                  <div>{v.valid_from?.slice(0, 10)}</div>
                  <div>→ {v.valid_to?.slice(0, 10)}</div>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: statusBg[v.status] ?? '#F1F5F9', color: statusColor[v.status] ?? C.gray }}>
                    {v.status === 'active' ? 'Hoạt động' : v.status === 'pending' ? 'Chờ duyệt' : v.status === 'expired' ? 'Hết hạn' : 'Tạm dừng'}
                  </span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {v.status === 'pending' && <button onClick={() => handleApprove(v.id)} style={{ padding:'5px 10px', background:'#DCFCE7', color:C.success, border:'none', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>✅ Duyệt</button>}
                    <button onClick={() => openEdit(v)} style={{ padding:'5px 10px', background:C.light, color:C.blue, border:'none', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>✏️ Sửa</button>
                    <button onClick={() => handleDelete(v.id)} style={{ padding:'5px 10px', background:'#FEE2E2', color:C.error, border:'none', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setShowForm(false)}>
          <div className="card" style={{ width:440, padding:28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ fontSize:18, fontWeight:800, color:C.navy }}>{editId ? 'Sửa voucher' : 'Thêm voucher mới'}</h2>
              <button onClick={() => setShowForm(false)} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:C.gray }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'code', label:'Mã voucher', type:'text', placeholder:'VD: SALE50' },
                { key:'discount_value', label:'Giá trị giảm', type:'number', placeholder: '' },
                { key:'max_uses', label:'Số lượng tối đa', type:'number', placeholder: '' },
                { key:'valid_from', label:'Ngày bắt đầu', type:'date', placeholder: '' },
                { key:'valid_to',   label:'Ngày kết thúc', type:'date', placeholder: '' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:12, fontWeight:600, color:C.gray, display:'block', marginBottom:4 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key] ?? ''} placeholder={f.placeholder}
                    onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width:'100%', padding:'9px 12px', border:`1px solid ${C.light}`, borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:C.gray, display:'block', marginBottom:4 }}>Loại giảm giá</label>
                <select value={form.discount_type} onChange={e => setForm((p:any) => ({ ...p, discount_type: e.target.value }))}
                  style={{ width:'100%', padding:'9px 12px', border:`1px solid ${C.light}`, borderRadius:8, fontSize:13, outline:'none' }}>
                  <option value="percentage">Phần trăm (%)</option>
                  <option value="fixed">Cố định (₫)</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:'10px', background:C.tint, color:C.gray, border:'none', borderRadius:9, fontWeight:600, cursor:'pointer' }}>Hủy</button>
              <button onClick={handleSave} style={{ flex:2, padding:'10px', background:C.blue, color:'white', border:'none', borderRadius:9, fontWeight:700, cursor:'pointer' }}>
                {editId ? 'Lưu thay đổi' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const MOCK_VOUCHERS = [
  { id:1, code:'WELCOME10', discount_type:'percentage', discount_value:10, max_uses:1000, current_uses:42, valid_from:'2025-01-01', valid_to:'2025-12-31', status:'active' },
  { id:2, code:'SALE50K',   discount_type:'fixed',      discount_value:50000, max_uses:500, current_uses:128, valid_from:'2025-06-01', valid_to:'2025-06-30', status:'active' },
  { id:3, code:'NEWSHOP20', discount_type:'percentage', discount_value:20, max_uses:200, current_uses:0, valid_from:'2025-07-01', valid_to:'2025-07-31', status:'pending' },
  { id:4, code:'XMAS2024',  discount_type:'percentage', discount_value:15, max_uses:5000, current_uses:4980, valid_from:'2024-12-20', valid_to:'2024-12-31', status:'expired' },
]

export default VoucherAdminPage
