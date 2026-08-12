import React, { useEffect, useState } from 'react'
import API from '../../services/api'
import EmployeeLayout from './EmployeeLayout'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', error: '#DC2626' }

const EmployeeProductsPage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    API.get('/api/v1/employee/products')
      .then(r => setProducts(r.data?.products ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await API.patch(`/api/v1/employee/products/${editing.product_id}`, {
        product_name: editing.product_name,
        price: Number(editing.price),
        stock_quantity: Number(editing.stock_quantity),
        description: editing.description,
      })
      setMsg('✅ Đã lưu')
      setEditing(null)
      load()
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.detail || 'Lỗi'))
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  return (
    <EmployeeLayout>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.navy, margin: 0 }}>📦 Sản phẩm</h1>

      {msg && (
        <div style={{ padding: '10px 16px', background: msg.startsWith('✅') ? '#DCFCE7' : '#FEE2E2', borderRadius: 8, fontSize: 13, color: msg.startsWith('✅') ? C.success : C.error }}>
          {msg}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.light}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['#', 'Sản phẩm', 'Giá', 'Tồn kho', 'Trạng thái', 'Thao tác'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.gray }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Đang tải...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Không có sản phẩm</td></tr>
            ) : products.map(p => (
              <tr key={p.product_id} style={{ borderTop: `1px solid ${C.light}` }}>
                <td style={{ padding: '12px 14px', color: C.gray, fontSize: 12 }}>#{p.product_id}</td>
                <td style={{ padding: '12px 14px' }}>
                  <p style={{ fontWeight: 600, color: C.navy, fontSize: 13, margin: 0 }}>{p.product_name}</p>
                </td>
                <td style={{ padding: '12px 14px', color: C.blue, fontWeight: 600 }}>
                  {Number(p.price).toLocaleString('vi-VN')}₫
                </td>
                <td style={{ padding: '12px 14px', color: C.gray }}>{p.stock_quantity}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: p.status === 'active' ? '#DCFCE7' : '#F1F5F9',
                    color: p.status === 'active' ? C.success : C.gray,
                  }}>{p.status === 'active' ? 'Hoạt động' : p.status}</span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <button onClick={() => setEditing({ ...p })} style={{
                    padding: '5px 12px', background: C.tint, color: C.blue,
                    border: `1px solid ${C.light}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>✏️ Sửa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ color: C.navy, margin: '0 0 20px', fontSize: 16 }}>✏️ Chỉnh sửa sản phẩm #{editing.product_id}</h3>
            {[
              { label: 'Tên sản phẩm', key: 'product_name', type: 'text' },
              { label: 'Giá (VNĐ)', key: 'price', type: 'number' },
              { label: 'Tồn kho', key: 'stock_quantity', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.gray, marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} value={editing[f.key] ?? ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })} style={{
                  width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8,
                  fontSize: 13, boxSizing: 'border-box', outline: 'none',
                }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setEditing(null)} style={{ padding: '9px 18px', border: `1px solid ${C.light}`, borderRadius: 8, background: '#fff', color: C.gray, cursor: 'pointer', fontSize: 13 }}>Hủy</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: C.blue, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </EmployeeLayout>
  )
}

export default EmployeeProductsPage
