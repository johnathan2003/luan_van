import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ProductList from '../../components/product/ProductList'
import ProductFilter from '../../components/product/ProductFilter'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  fetchProducts, fetchCategories, setFilters,
  appendProducts, resetProducts, setLoadingMore, setLoopLoading,
} from '../../store/slices/productSlice'
import API from '../../services/api'

const ProductListPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { products, categories, filters, loading, total, loadingMore, loopLoading } = useAppSelector(s => s.product)
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search') ?? ''

  // ── Infinite scroll refs ─────────────────────────────────────────────────
  const infinitePageRef  = useRef(1)
  const infinitePagesRef = useRef(1)
  const isFetchingRef    = useRef(false)
  const isPausedRef      = useRef(false)
  const cancelLoopRef    = useRef(false)
  const sentinelRef      = useRef<HTMLDivElement>(null)

  // ── Pause khi hover footer ────────────────────────────────────────────────
  useEffect(() => {
    const footer = document.querySelector('footer')
    if (!footer) return
    const onEnter = () => {
      isPausedRef.current   = true
      cancelLoopRef.current = true
      dispatch(setLoopLoading(false))
    }
    const onLeave = () => {
      isPausedRef.current   = false
      cancelLoopRef.current = false
    }
    footer.addEventListener('mouseenter', onEnter)
    footer.addEventListener('mouseleave', onLeave)
    return () => {
      footer.removeEventListener('mouseenter', onEnter)
      footer.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  // ── Shop search ──────────────────────────────────────────────────────────
  const [tab, setTab]               = useState<'products' | 'shops'>('products')
  const [shops, setShops]           = useState<any[]>([])
  const [shopsTotal, setShopsTotal] = useState(0)
  const [shopsLoading, setShopsLoading] = useState(false)

  // ── Init / search change ─────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchCategories())
    dispatch(resetProducts())
    infinitePageRef.current  = 1
    infinitePagesRef.current = 1

    const initFilters = { page: 1, limit: 20, sort: filters.sort ?? 'popular', ...(searchQuery ? { search: searchQuery } : {}) }
    dispatch(setFilters({ ...initFilters }))
    dispatch(fetchProducts(initFilters)).then((res: any) => {
      if (res.payload) {
        infinitePageRef.current  = res.payload.page  ?? 1
        infinitePagesRef.current = res.payload.pages ?? 1
      }
    })

    if (searchQuery.trim()) {
      setShopsLoading(true)
      fetch(`/api/v1/shops/search?q=${encodeURIComponent(searchQuery)}&limit=20`)
        .then(r => r.ok ? r.json() : { shops: [], total: 0 })
        .then(d => { setShops(d.shops ?? []); setShopsTotal(d.total ?? 0) })
        .finally(() => setShopsLoading(false))
    } else {
      setShops([]); setShopsTotal(0); setTab('products')
    }
  }, [searchQuery])

  // ── Helper sleep ─────────────────────────────────────────────────────────
  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

  // ── loadMore: append trang tiếp theo, loop khi hết ──────────────────────
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || isPausedRef.current) return
    isFetchingRef.current = true

    const isLoop   = infinitePageRef.current >= infinitePagesRef.current
    const nextPage = isLoop ? 1 : infinitePageRef.current + 1

    try {
      if (isLoop) {
        cancelLoopRef.current = false
        dispatch(setLoopLoading(true))
        dispatch(setLoadingMore(false))
        await sleep(5000)
        if (cancelLoopRef.current) {
          cancelLoopRef.current = false
          isFetchingRef.current = false
          return
        }
        dispatch(setLoopLoading(false))
      }
      dispatch(setLoadingMore(true))

      const merged = { ...filters, page: nextPage, limit: 20 }
      const params = new URLSearchParams()
      Object.entries(merged).forEach(([k, v]) => { if (v !== undefined && v !== null) params.set(k, String(v)) })
      const res  = await API.get(`/api/v1/products?${params}`)
      const data = res.data
      dispatch(appendProducts({ products: data.products ?? [], total: data.total, page: data.page, pages: data.pages }))
      infinitePageRef.current  = data.page  ?? nextPage
      infinitePagesRef.current = data.pages ?? 1
    } catch {
      dispatch(setLoadingMore(false))
      dispatch(setLoopLoading(false))
    } finally {
      isFetchingRef.current = false
    }
  }, [dispatch, filters])

  // ── IntersectionObserver ─────────────────────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  // ── Filter change → reset + refetch ─────────────────────────────────────
  const handleFilterChange = (key: string, value: any) => {
    dispatch(resetProducts())
    infinitePageRef.current  = 1
    infinitePagesRef.current = 1

    const newFilters = { ...filters, [key]: value, page: 1, limit: 20 }
    dispatch(setFilters(newFilters))
    dispatch(fetchProducts(newFilters)).then((res: any) => {
      if (res.payload) {
        infinitePageRef.current  = res.payload.page  ?? 1
        infinitePagesRef.current = res.payload.pages ?? 1
      }
    })
  }

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>

        {/* Tabs khi có keyword */}
        {searchQuery && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden', width: 'fit-content' }}>
            <button onClick={() => setTab('products')} style={{
              padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              background: tab === 'products' ? '#7C3AED' : 'transparent',
              color: tab === 'products' ? '#fff' : 'var(--text-secondary)',
              borderRight: '1px solid var(--border-subtle)',
            }}>🛍️ Sản phẩm {total > 0 ? `(${total})` : ''}</button>
            <button onClick={() => setTab('shops')} style={{
              padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              background: tab === 'shops' ? '#7C3AED' : 'transparent',
              color: tab === 'shops' ? '#fff' : 'var(--text-secondary)',
            }}>🏪 Shop {shopsTotal > 0 ? `(${shopsTotal})` : ''}</button>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {shops.map((s: any) => (
                  <Link key={s.shop_id} to={`/shop/${s.shop_id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-subtle)', borderRadius: 14, padding: '20px 20px 16px', display: 'flex', gap: 14, alignItems: 'center', transition: 'box-shadow 0.2s, border-color 0.2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(124,58,237,0.14)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#7C3AED' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)' }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f3f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {s.avatar_url
                          ? <img src={s.avatar_url} alt={s.shop_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 26 }}>🏪</span>}
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

        {/* ── Tab: Products — infinite scroll ── */}
        {tab === 'products' && (
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ width: 220, flexShrink: 0 }}>
              <ProductFilter categories={categories} filters={filters} onChange={handleFilterChange} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 20 }}>
                <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Tìm thấy <strong>{total}</strong> sản phẩm</p>
              </div>
              <ProductList
                products={products}
                loading={loading}
                loadingMore={loadingMore}
                loopLoading={loopLoading}
              />
              {/* Sentinel — IntersectionObserver kích load thêm */}
              <div ref={sentinelRef} style={{ height: 1 }} />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default ProductListPage
