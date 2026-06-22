import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Loading from '../../components/common/Loading'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchProductById } from '../../store/slices/productSlice'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatRating } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'
import { trackMissionEvent } from '../../utils/eventsStore'

const C = {
  primary: '#1D4ED8', navy: '#1E3A8A',
  gray: '#64748B', light: '#F1F5F9',
  success: '#16A34A', error: '#DC2626',
  gold: '#F59E0B',
}

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { selectedProduct: product, loading } = useAppSelector(s => s.product)
  const { add } = useCart()
  const { isAuthenticated } = useAuth()
  const [qty, setQty] = useState(1)
  const [imgIdx, setImgIdx] = useState(0)
  const [addedMsg, setAddedMsg] = useState(false)

  useEffect(() => {
    if (id) dispatch(fetchProductById(Number(id)))
  }, [id, dispatch])

  // tich tien do nhiem vu "luot xem san pham" cho su kien
  useEffect(() => {
    if (id) trackMissionEvent('view_product')
  }, [id])

  const handleAddToCart = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    await add(product!.product_id, qty)
    setAddedMsg(true)
    setTimeout(() => setAddedMsg(false), 2000)
  }

  const handleBuyNow = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    await add(product!.product_id, qty)
    navigate('/checkout')
  }

  if (loading) return (<Loading />)
  if (!product) return (
    <>
    <div className="container" style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
      <p style={{ color: C.gray }}>San pham khong ton tai</p>
      <Link to="/products" className="btn btn-primary" style={{ marginTop: 16 }}>Quay lai mua sam</Link>
    </div></>
  )

  const images = product.image_urls?.length ? product.image_urls : ['/images/placeholder.png']
  const ratingNum = Math.round(Number(product.rating) || 0)
  const inStock = product.stock_quantity > 0

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: C.gray, marginBottom: 20 }}>
          <Link to="/" style={{ color: C.gray, textDecoration: 'none' }}>Trang chu</Link>
          <span>/</span>
          <Link to="/products" style={{ color: C.gray, textDecoration: 'none' }}>San pham</Link>
          {(product as any).category_name && (
            <>
              <span>/</span>
              <span>{(product as any).category_name}</span>
            </>
          )}
          <span>/</span>
          <span style={{ color: C.navy, fontWeight: 500 }}>{product.product_name}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>

          {/* Images */}
          <div>
            <div style={{
              borderRadius: 16, overflow: 'hidden', marginBottom: 12,
              aspectRatio: '1', background: 'var(--gray-100)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
            }}>
              <img src={getImageUrl(images[imgIdx])} alt={product.product_name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            {images.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {images.map((img, i) => (
                  <img key={i} src={getImageUrl(img)} alt="" onClick={() => setImgIdx(i)}
                    style={{
                      width: 72, height: 72, objectFit: 'cover', borderRadius: 10,
                      cursor: 'pointer',
                      border: i === imgIdx ? `2px solid ${C.primary}` : '2px solid transparent',
                      opacity: i === imgIdx ? 1 : 0.65, transition: 'all 0.15s',
                    }} />
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {(product as any).category_name && (
              <span style={{
                display: 'inline-block', fontSize: 11, fontWeight: 600,
                color: C.primary, background: '#DBEAFE',
                padding: '3px 10px', borderRadius: 20, marginBottom: 10,
              }}>{(product as any).category_name}</span>
            )}

            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, lineHeight: 1.4, marginBottom: 10 }}>
              {product.product_name}
            </h1>

            {/* Rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 1 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} style={{ color: i < ratingNum ? C.gold : '#D1D5DB', fontSize: 16 }}>★</span>
                ))}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.gold }}>{formatRating(product.rating)}</span>
              <span style={{ fontSize: 13, color: C.gray }}>({product.total_reviews} danh gia)</span>
              <span style={{ fontSize: 13, color: C.gray }}>· Da ban {product.sales_count?.toLocaleString('vi-VN') ?? 0}</span>
            </div>

            {/* Gia */}
            <div style={{ fontSize: 34, fontWeight: 900, color: '#E11D48', marginBottom: 20, letterSpacing: '-0.03em' }}>
              {formatCurrency(product.price)}
            </div>

            {/* Mo ta */}
            {product.description && (
              <div style={{
                background: C.light, borderRadius: 12, padding: '14px 16px',
                marginBottom: 20, fontSize: 14, lineHeight: 1.7, color: C.gray,
              }}>
                {product.description}
              </div>
            )}

            {/* So luong */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <span style={{ fontSize: 14, color: C.gray, fontWeight: 500 }}>So luong:</span>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--gray-200)', borderRadius: 10, overflow: 'hidden' }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={{ width: 38, height: 38, border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: C.gray }}>−</button>
                <span style={{ width: 44, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock_quantity, q + 1))}
                  style={{ width: 38, height: 38, border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: C.gray }}>+</button>
              </div>
              <span style={{ fontSize: 13, color: inStock ? C.success : C.error, fontWeight: 600 }}>
                {inStock ? `Con ${product.stock_quantity} sp` : 'Het hang'}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <button onClick={handleAddToCart} disabled={!inStock}
                className="btn btn-outline btn-lg" style={{ flex: 1 }}>
                {addedMsg ? '✓ Da them!' : 'Them vao gio'}
              </button>
              <button onClick={handleBuyNow} disabled={!inStock}
                className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                Mua ngay
              </button>
            </div>

            {/* Shop card */}
            {(product as any).shop_name && (
              <Link to={`/shops/${product.shop_id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'white', border: '1.5px solid var(--gray-200)',
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  transition: 'box-shadow 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                  }}>🏪</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: C.navy, margin: 0 }}>
                      {(product as any).shop_name}
                    </p>
                    {(product as any).shop_rating && (
                      <p style={{ fontSize: 12, color: C.gray, marginTop: 3 }}>
                        ⭐ {(product as any).shop_rating} · Nhấn để xem shop
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 20, color: C.gray }}>›</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetailPage
