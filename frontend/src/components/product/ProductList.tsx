import React from 'react'
import type { Product } from '../../types/product'
import ProductCard from './ProductCard'
import Loading from '../common/Loading'

interface Props { products: Product[]; loading?: boolean; emptyMessage?: string }

const ProductList: React.FC<Props> = ({ products, loading, emptyMessage = 'Không có sản phẩm nào' }) => {
  if (loading) return <Loading />
  if (!products.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray-400)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
      <p>{emptyMessage}</p>
    </div>
  )
  return (
    <div className="grid-4">
      {products.map(p => <ProductCard key={p.product_id} product={p} />)}
    </div>
  )
}

export default ProductList
