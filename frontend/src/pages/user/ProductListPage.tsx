import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ProductList from '../../components/product/ProductList'
import ProductFilter from '../../components/product/ProductFilter'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchProducts, fetchCategories, setFilters } from '../../store/slices/productSlice'

const ProductListPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { products, categories, filters, loading, total, pages, page } = useAppSelector(s => s.product)
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search') ?? ''

  // ─── Shop search state ──────────────────────────────────────────────────────
  const [tab, setTab]           = useState<'products' | 'shops'>('products')
  const [shops, setShops]       = useState<any[]>([])
  const [shopsTotal, setShopsTotal] = useState(0)
  const [shopsLoading, setShopsLoading] = useState(false)

  useEffect(() => {
    dispatch(fetchCategories())
    dispatch(setFilters({ search: searchQuery, page: 1 }))
    // Khi có keyword → cũng tìm shop
    if (searchQuery.trim()) {
      setShopsLoading(true)
      fetch(`/api/v1/shops/search?q=${encodeURIComponent(searchQuery)}&limit=20`)
        .then(r => r.ok ? r.json() : { shops: [], total: 0 })
        .then(d => { setShops(d.shops ?? []); setShopsTotal(d.total ?? 0) })
        .finally(() => setShopsLoading(false))
    } else {
      setShops([])
      setShopsTotal(0)
      setTab('products')
    }
  }, [searchQuery])

  useEffect(() => {
    dispatch(fetchProducts(filters))
  }, [filters, dispatch])

  const handleFilterChange = (key: string, value: any) => {
    dispatch(setFilters({ [key]: value, page: 1 }))
  }

  const hasShops = shops.length > 0 || shopsLoading

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>

        {/* Tabs khi có keyword tìm kiếm */}
        {searchQuery && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden', width: 'fit-content' }}>
            <button onClick={() => setTab('products')} style={{
              padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              background: tab === 'products' ? '#7C3AED' : 'transparent',
              color: tab === 'products' ? '#fff' : 'var(--text-secondary)',
              borderRight: '1px solid var(--border-subtle)',
            }}>
              🛍️ Sản phẩm {total > 0 ? `(${total})` : ''}
            </button>
            <button onClick={() => setTab('shops')} style={{
              padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              background: tab === 'shops' ? '#7C3AED' : 'transparent',
              color: tab === 'shops' ? '#fff' : 'var(--text-secondary)',
            }}>
              🏪 Shop {shopsTotal > 0 ? `(${shopsTotal})` : ''}
            </button>
          </div>
        )}

        {/* ── Tab: Shops ── */}
        {tab === 'shops' && searchQuery && (
          <div>
            {shopsLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Đang tìm shop...</div>
            ) : shops.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                Không tìm thấy shop nào với từ khóa "<strong>{searchQuery}</strong>"
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {shops.map((s: any) => (
                  <Link key={s.shop_id} to={`/shop/${s.shop_id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-subtle)', borderRadius: 14, padding: '20px 20px 16px', display: 'flex', gap: 14, alignItems: 'center', transition: 'box-shadow 0.2s, border-color 0.2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(124,58,237,0.14)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#7C3AED' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)' }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f3f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {s.avatar_url
                          ? <img src={s.avatar_url} alt={s.shop_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 26 }}>🏪</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.shop_name}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {s.address || 'Chưa cập nhật địa chỉ'}</p>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#f59e0b' }}>⭐ {parseFloat(s.rating || '0').toFixed(1)}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.total_orders} đơn</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Products ── */}
        {tab === 'products' && (
          <div style={{ display: 'flex', gap: 24 }}>
            {/* Filter sidebar */}
            <div style={{ width: 220, flexShrink: 0 }}>
              <ProductFilter categories={categories} filters={filters} onChange={handleFilterChange} />
            </div>

            {/* Products */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Tìm thấy <strong>{total}</strong> sản phẩm</p>
              </div>
              <ProductList products={products} loading={loading} />

              {/* Pagination */}
              {pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
                  {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => dispatch(setFilters({ page: p }))}
                      className={`btn btn-sm ${page === p ? 'btn-primary' : 'btn-outline'}`}
                    >{p}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default ProductListPage
