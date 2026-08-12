import React from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '../../types/product'
import { formatCurrency, formatRating } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../hooks/useAuth'

interface Props { product: Product }

const ProductCard: React.FC<Props> = ({ product }) => {
  const { add } = useCart()
  const { isAuthenticated } = useAuth()

  return (
    <div className="card" style={{ transition: 'transform var(--transition), box-shadow var(--transition)', cursor: 'pointer' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lg)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' }}
    >
      <Link to={`/products/${product.product_id}`}>
        <div style={{ position: 'relative', paddingTop: '100%', background: 'var(--gray-100)' }}>
          <img
            src={getImageUrl(product.image_urls?.[0])}
            alt={product.product_name}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {product.sales_count > 100 && (
            <span style={{ position: 'absolute', top: 8, left: 8, background: 'var(--flash-timer-bg)', color: 'var(--flash-timer-text)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
              HOT
            </span>
          )}
        </div>
      </Link>
      <div style={{ padding: 12 }}>
        <Link to={`/products/${product.product_id}`}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {product.product_name}
          </p>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
          <span style={{ color: '#f59e0b', fontSize: 13 }}>★</span>
          <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{formatRating(product.rating)}</span>
          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>({product.total_reviews})</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-400)' }}>Đã bán {product.sales_count}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--price-color)',
            letterSpacing: '-0.02em',
          }}>
            {formatCurrency(product.price)}
          </span>
          {isAuthenticated && product.stock_quantity > 0 && (
            <button
              onClick={(e) => { e.preventDefault(); add(product.product_id) }}
              style={{ background: 'var(--cta-bg)', color: 'var(--cta-text)', border: 'none', borderRadius: 'var(--radius)', padding: '5px 10px', fontSize: 18, cursor: 'pointer' }}
              title="Thêm vào giỏ"
            >
              +
            </button>
          )}
        </div>
        {product.stock_quantity === 0 && (
          <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>Hết hàng</p>
        )}
      </div>
    </div>
  )
}

export default ProductCard
