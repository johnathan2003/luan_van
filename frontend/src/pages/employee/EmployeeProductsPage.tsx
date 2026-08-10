import React, { useEffect, useState } from 'react'
import API from '../../services/api'
import EmployeeLayout from './EmployeeLayout'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', error: '#DC2626' }

const EmployeeProductsPage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    API.get('/api/v1/employee/products')
      .then(r => setProducts(r.data?.products ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <EmployeeLayout>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.navy, margin: 0 }}>📦 Sản phẩm</h1>
        <p style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>Chỉ xem — liên hệ chủ shop nếu cần chỉnh sửa</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.light}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['#', 'Sản phẩm', 'Giá', 'Tồn kho', 'Trạng thái'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.gray }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Đang tải...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Không có sản phẩm</td></tr>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </EmployeeLayout>
  )
}

export default EmployeeProductsPage
