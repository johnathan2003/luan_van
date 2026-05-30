import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../../components/common/Navbar'
import Footer from '../../components/common/Footer'
import Loading from '../../components/common/Loading'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchProductById } from '../../store/slices/productSlice'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatRating } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { selectedProduct: product, loading } = useAppSelector(s => s.product)
  const { add } = useCart()
  const { isAuthenticated } = useAuth()
  const [qty, setQty] = useState(1)
  const [imgIdx, setImgIdx] = useState(0)

  useEffect(() => {
    if (id) dispatch(fetchProductById(Number(id)))
  }, [id, dispatch])

  const handleAddToCart = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    await add(product!.product_id, qty)
  }

  if (loading) return (<><Navbar /><Loading /></>)
  if (!product) return (<><Navbar /><div className="container" style={{ padding: 40, textAlign: 'center' }}>Sản phẩm không tồn tại</div></>)

  const images = product.image_urls?.length ? product.image_urls : ['/images/placeholder.png']

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
          {/* Images */}
          <div>
            <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 12, aspectRatio: '1', background: 'var(--gray-100)' }}>
              <img src={getImageUrl(images[imgIdx])} alt={product.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {images.map((img, i) => (
                <img key={i} src={getImageUrl(img)} alt="" onClick={() => setImgIdx(i)}
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius)', cursor: 'pointer', border: i === imgIdx ? '2px solid var(--primary)' : '2px solid var(--gray-200)' }} />
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 8 }}>Danh mục: {product.category_id || 'Khác'}</p>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, lineHeight: 1.4 }}>{product.product_name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ color: '#f59e0b' }}>{'★'.repeat(Math.round(Number(product.rating)))}{'☆'.repeat(5 - Math.round(Number(product.rating)))}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{formatRating(product.rating)} ({product.total_reviews} đánh giá) · {product.sales_count} đã bán</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)', marginBottom: 20 }}>
              {formatCurrency(product.price)}
            </div>
            {product.description && (
              <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 20, fontSize: 14, lineHeight: 1.7, color: 'var(--gray-700)' }}>
                {product.description}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 14, color: 'var(--gray-600)' }}>Số lượng:</span>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}>−</button>
                <span style={{ width: 40, textAlign: 'center', fontWeight: 600 }}>{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock_quantity, q + 1))} style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}>+</button>
              </div>
              <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Còn {product.stock_quantity} sản phẩm</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleAddToCart} disabled={product.stock_quantity === 0} className="btn btn-outline btn-lg" style={{ flex: 1 }}>
                🛒 Thêm vào giỏ
              </button>
              <button onClick={() => { handleAddToCart(); navigate('/checkout') }} disabled={product.stock_quantity === 0} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                Mua ngay
              </button>
            </div>
            {product.stock_quantity === 0 && <p style={{ color: 'var(--error)', marginTop: 8, fontSize: 14 }}>Sản phẩm đã hết hàng</p>}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default ProductDetailPage
