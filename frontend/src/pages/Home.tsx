import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/common/Navbar'
import Footer from '../components/common/Footer'
import ProductList from '../components/product/ProductList'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchProducts, fetchCategories, setFilters } from '../store/slices/productSlice'

const Home: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { products, categories, loading } = useAppSelector(s => s.product)

  useEffect(() => {
    dispatch(fetchCategories())
    dispatch(fetchProducts({ page: 1, limit: 12, sort: 'popular' }))
  }, [dispatch])

  return (
    <div className="page-wrapper">
      <Navbar />
      <main>
        {/* Hero banner */}
        <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #ff6633 100%)', color: 'white', padding: '60px 0', textAlign: 'center' }}>
          <div className="container">
            <h1 style={{ fontSize: 42, fontWeight: 800, marginBottom: 16, textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
              Mua sắm không giới hạn 🛒
            </h1>
            <p style={{ fontSize: 18, opacity: 0.9, marginBottom: 32 }}>
              Hàng ngàn sản phẩm chất lượng, giao hàng tận nơi
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/products')} style={{ background: 'white', color: 'var(--primary)', padding: '14px 32px', borderRadius: 'var(--radius-full)', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 16, boxShadow: 'var(--shadow-md)' }}>
                Mua ngay →
              </button>
              <button onClick={() => navigate('/register-shop')} style={{ background: 'transparent', color: 'white', padding: '14px 32px', borderRadius: 'var(--radius-full)', fontWeight: 700, border: '2px solid white', cursor: 'pointer', fontSize: 16 }}>
                Mở shop
              </button>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div style={{ background: 'white', padding: '32px 0', borderBottom: '1px solid var(--gray-100)' }}>
          <div className="container">
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              <button onClick={() => { dispatch(setFilters({ category_id: undefined })); navigate('/products') }}
                style={{ flexShrink: 0, padding: '10px 20px', borderRadius: 'var(--radius-full)', border: '1.5px solid var(--primary)', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                🏠 Tất cả
              </button>
              {categories.map(cat => (
                <button
                  key={cat.category_id}
                  onClick={() => { dispatch(setFilters({ category_id: cat.category_id })); navigate('/products') }}
                  style={{ flexShrink: 0, padding: '10px 20px', borderRadius: 'var(--radius-full)', border: '1.5px solid var(--gray-200)', background: 'white', color: 'var(--gray-700)', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}>
                  {cat.icon_url || '📦'} {cat.category_name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700 }}>🔥 Sản phẩm nổi bật</h2>
            <Link to="/products" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>Xem tất cả →</Link>
          </div>
          <ProductList products={products} loading={loading} />
        </div>

        {/* Features */}
        <div style={{ background: 'white', padding: '48px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, textAlign: 'center' }}>
              {[
                { icon: '🚚', title: 'Giao hàng nhanh', desc: 'Vận chuyển toàn quốc, giao trong 2-5 ngày' },
                { icon: '🔒', title: 'Thanh toán an toàn', desc: 'MoMo, VNPay, COD – đảm bảo bảo mật' },
                { icon: '↩️', title: 'Đổi trả dễ dàng', desc: '7 ngày đổi trả nếu sản phẩm lỗi' },
                { icon: '🎧', title: 'Hỗ trợ 24/7', desc: 'Đội ngũ CSKH sẵn sàng hỗ trợ bạn' },
              ].map(f => (
                <div key={f.title}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>{f.icon}</div>
                  <h3 style={{ fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Home
