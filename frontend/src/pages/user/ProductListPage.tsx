import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '../../components/common/Navbar'
import Footer from '../../components/common/Footer'
import ProductList from '../../components/product/ProductList'
import ProductFilter from '../../components/product/ProductFilter'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchProducts, fetchCategories, setFilters } from '../../store/slices/productSlice'

const ProductListPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { products, categories, filters, loading, total, pages, page } = useAppSelector(s => s.product)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    dispatch(fetchCategories())
    const search = searchParams.get('search')
    if (search) dispatch(setFilters({ search }))
  }, [])

  useEffect(() => {
    dispatch(fetchProducts(filters))
  }, [filters, dispatch])

  const handleFilterChange = (key: string, value: any) => {
    dispatch(setFilters({ [key]: value, page: 1 }))
  }

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>
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
      </div>
      <Footer />
    </div>
  )
}

export default ProductListPage
