import React from 'react'
import type { Product } from '../../types/product'
import ProductCard from './ProductCard'
import Loading from '../common/Loading'

// ── Skeleton card nhấp nháy khi loop ─────────────────────────────────────────
const SkeletonCard: React.FC = () => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1.5px solid var(--border-subtle)',
    borderRadius: 14,
    overflow: 'hidden',
    animation: 'skeletonPulse 1.2s ease-in-out infinite',
  }}>
    {/* Ảnh */}
    <div style={{ height: 180, background: 'var(--bg-highlight, #e5e7eb)' }} />
    {/* Nội dung */}
    <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ height: 10, width: '60%', background: 'var(--bg-highlight, #e5e7eb)', borderRadius: 6 }} />
      <div style={{ height: 13, width: '90%', background: 'var(--bg-highlight, #e5e7eb)', borderRadius: 6 }} />
      <div style={{ height: 13, width: '70%', background: 'var(--bg-highlight, #e5e7eb)', borderRadius: 6 }} />
      <div style={{ height: 18, width: '45%', background: 'var(--bg-highlight, #e5e7eb)', borderRadius: 6, marginTop: 4 }} />
    </div>
  </div>
)

interface Props {
  products: Product[]
  loading?: boolean
  loadingMore?: boolean
  loopLoading?: boolean
  emptyMessage?: string
}

const ProductList: React.FC<Props> = ({
  products,
  loading,
  loadingMore,
  loopLoading,
  emptyMessage = 'Không có sản phẩm nào',
}) => {
  if (loading) return <Loading />

  if (!products.length && !loopLoading) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray-400)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
      <p>{emptyMessage}</p>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.45 }
          50%       { opacity: 0.9  }
        }
      `}</style>

      {/* Danh sách sản phẩm thật */}
      <div className="grid-4">
        {products.map((p, idx) => <ProductCard key={`${p.product_id}-${idx}`} product={p} />)}
      </div>

      {/* Chỉ hiện text khi loop (hết trang → chuẩn bị load lại) */}
      {loopLoading && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 10, padding: '32px 0', color: 'var(--text-secondary)',
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '2.5px solid var(--border-subtle)',
            borderTopColor: 'var(--primary, #7C3AED)',
            animation: 'spin 0.7s linear infinite',
          }} />
          <span style={{ fontSize: 13 }}>Đang làm mới danh sách…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Spinner nhỏ khi load trang kế (không phải loop) */}
      {loadingMore && !loopLoading && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 10, padding: '24px 0', color: 'var(--text-secondary)',
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '2.5px solid var(--border-subtle)',
            borderTopColor: 'var(--primary, #7C3AED)',
            animation: 'spin 0.7s linear infinite',
          }} />
          <span style={{ fontSize: 13 }}>Đang tải thêm sản phẩm…</span>
        </div>
      )}
    </>
  )
}

export default ProductList
