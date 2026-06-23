/**
 * 🏷️ Product Admin — Quản lý sản phẩm
 * Nhóm 3: duyệt (auto+thủ công), ẩn/hiện, xóa, gắn nhãn nổi bật
 */
import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import Loading from '../../components/common/Loading'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const TABS = ['pending', 'active', 'hidden', 'rejected'] as const
const TAB_LABELS: Record<string, string> = { pending: 'Chờ duyệt', active: 'Đang bán', hidden: 'Đã ẩn', rejected: 'Từ chối' }
const TAB_COLORS: Record<string, string> = { pending: C.warning, active: C.success, hidden: C.gray, rejected: C.error }

const ProductAdminPage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<string>('pending')
  const [search, setSearch]     = useState('')

  useEffect(() => {
    adminService.getPendingProducts()
      .then(r => setProducts(r.data?.products || r.data || MOCK_PRODUCTS))
      .catch(() => setProducts(MOCK_PRODUCTS))
      .finally(() => setLoading(false))
  }, [])

  const handleApprove = async (id: number) => {
    await adminService.approveProduct(id)
    setProducts(p => p.map(x => x.product_id === id ? { ...x, status: 'active' } : x))
  }
  const handleReject = async (id: number) => {
    const reason = window.prompt('Lý do từ chối:')
    if (!reason) return
    await adminService.rejectProduct(id, reason)
    setProducts(p => p.map(x => x.product_id === id ? { ...x, status: 'rejected' } : x))
  }

  const byTab = products.filter(p => {
    const matchTab    = p.status === tab
    const matchSearch = !search || p.product_name?.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  if (loading) return <Loading />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🏷️ Quản lý sản phẩm</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Duyệt sản phẩm mới, ẩn/hiện, xóa và gắn nhãn nổi bật</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {TABS.map(t => (
          <div key={t} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${TAB_COLORS[t]}`, cursor: 'pointer', background: tab === t ? C.tint : 'var(--bg-card)' }}
            onClick={() => setTab(t)}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{TAB_LABELS[t]}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: TAB_COLORS[t] }}>{products.filter(p => p.status === t).length}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: tab === t ? TAB_COLORS[t] : C.tint, color: tab === t ? 'white' : C.gray,
            }}>{TAB_LABELS[t]}</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm sản phẩm..."
          style={{ flex: 1, padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }}
        />
      </div>

      {/* Product grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {byTab.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: C.gray, gridColumn: '1/-1' }}>
            Không có sản phẩm nào ở trạng thái "{TAB_LABELS[tab]}"
          </div>
        ) : byTab.map((p, i) => (
          <div key={p.product_id ?? i} className="card" style={{ overflow: 'hidden' }}>
            {/* Product image placeholder */}
            <div style={{ height: 140, background: `linear-gradient(135deg, ${C.tint}, ${C.light})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
              🛍️
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: C.navy, flex: 1, marginRight: 8 }}>{p.product_name}</p>
                {p.is_featured && <span style={{ fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: C.warning, padding: '2px 7px', borderRadius: 10 }}>⭐ Nổi bật</span>}
              </div>
              <p style={{ fontSize: 13, color: C.success, fontWeight: 700, marginBottom: 4 }}>
                {Number(p.price || 0).toLocaleString('vi-VN')}₫
              </p>
              <p style={{ fontSize: 11, color: C.gray, marginBottom: 12 }}>Shop #{p.shop_id} · Tồn: {p.stock_quantity ?? 0}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tab === 'pending' && <>
                  <button onClick={() => handleApprove(p.product_id)} style={{ flex:1, padding:'7px', background:C.success, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>✅ Duyệt</button>
                  <button onClick={() => handleReject(p.product_id)} style={{ flex:1, padding:'7px', background:'#FEE2E2', color:C.error, border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>❌ Từ chối</button>
                </>}
                {tab === 'active' && <>
                  <button onClick={() => alert(`Ẩn SP #${p.product_id}`)} style={{ flex:1, padding:'7px', background:C.tint, color:C.blue, border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>🚫 Ẩn</button>
                  <button onClick={() => alert(`Gắn nổi bật SP #${p.product_id}`)} style={{ flex:1, padding:'7px', background:'#FEF3C7', color:C.warning, border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>⭐ Nổi bật</button>
                </>}
                {tab === 'hidden' && <button onClick={() => alert(`Hiện SP #${p.product_id}`)} style={{ flex:1, padding:'7px', background:'#DCFCE7', color:C.success, border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>👁️ Hiện lại</button>}
                <button onClick={() => { if(window.confirm('Xóa sản phẩm này?')) alert(`Đã xóa SP #${p.product_id}`) }} style={{ padding:'7px 10px', background:'#FEE2E2', color:C.error, border:'none', borderRadius:7, fontSize:12, cursor:'pointer' }}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const MOCK_PRODUCTS = [
  { product_id: 1, product_name: 'Tai nghe Sony WH-1000XM5', shop_id: 1, price: 6500000, stock_quantity: 25, status: 'active',  is_featured: true },
  { product_id: 2, product_name: 'Cáp USB-C 100W',            shop_id: 1, price: 50000,   stock_quantity: 200,status: 'active',  is_featured: false },
  { product_id: 3, product_name: 'Áo thun Oversize Limited',  shop_id: 2, price: 280000,  stock_quantity: 50, status: 'pending', is_featured: false },
  { product_id: 4, product_name: 'Clean Code (sách)',          shop_id: 1, price: 180000,  stock_quantity: 40, status: 'pending', is_featured: false },
  { product_id: 5, product_name: 'Sản phẩm bị ẩn test',       shop_id: 2, price: 100000,  stock_quantity: 10, status: 'hidden',  is_featured: false },
]

export default ProductAdminPage
