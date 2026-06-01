import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ProductList from '../components/product/ProductList'
import FlashTimer from '../components/common/FlashTimer'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchProducts, fetchCategories, setFilters } from '../store/slices/productSlice'

/**
 * Trang chủ — Navbar + Footer do PublicLayout (Router.tsx) bọc sẵn.
 */
const Home: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { products, categories, loading } = useAppSelector(s => s.product)

  useEffect(() => {
    dispatch(fetchCategories())
    dispatch(fetchProducts({ page: 1, limit: 12, sort: 'popular' }))
  }, [dispatch])

  return (
    <>
      {/* Hero banner */}
      <div style={{
        background: 'var(--hero-gradient, linear-gradient(135deg, var(--bg-topbar) 0%, var(--primary) 100%))',
        color: 'var(--hero-text, var(--text-on-topbar))',
        padding: '60px 0',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'var(--accent-gold)',
            opacity: 0.12,
            filter: 'blur(40px)',
          }}
        />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 20 }}>
            <FlashTimer label="Flash Sale hôm nay" durationSeconds={7200} />
          </div>
          <h1 style={{
            fontSize: 42,
            fontWeight: 800,
            marginBottom: 16,
            textShadow: '0 2px 12px rgba(0,0,0,0.2)',
          }}>
            Mua sắm không giới hạn{' '}
            <span style={{ color: 'var(--hero-accent, var(--accent-gold))' }}>🛒</span>
          </h1>
          <p style={{ fontSize: 18, opacity: 0.92, marginBottom: 32, maxWidth: 520, margin: '0 auto 32px' }}>
            Hàng ngàn sản phẩm chất lượng, giao hàng tận nơi
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/products')}
            >
              Mua ngay →
            </button>
            <button
              type="button"
              onClick={() => navigate('/register-shop')}
              style={{
                background: 'var(--accent-gold)',
                color: '#1E1B4B',
                padding: '14px 32px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                border: '2px solid rgba(255,255,255,0.4)',
                cursor: 'pointer',
                fontSize: 16,
                boxShadow: '0 4px 16px rgba(249, 199, 79, 0.45)',
              }}
            >
              Mở shop
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="section-surface" style={{ padding: '32px 0', borderBottom: 'none', marginTop: -1 }}>
        <div className="container">
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { dispatch(setFilters({ category_id: undefined })); navigate('/products') }}
              style={{ borderRadius: 'var(--radius-full)', flexShrink: 0 }}
            >
              🏠 Tất cả
            </button>
            {categories.map(cat => (
              <button
                key={cat.category_id}
                type="button"
                onClick={() => { dispatch(setFilters({ category_id: cat.category_id })); navigate('/products') }}
                style={{
                  flexShrink: 0,
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-full)',
                  border: '1.5px solid var(--border-subtle)',
                  background: 'var(--bg-highlight, var(--bg-page))',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-accent)'
                  e.currentTarget.style.background = 'var(--bg-card)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                  e.currentTarget.style.background = 'var(--bg-highlight, var(--bg-page))'
                }}
              >
                {cat.icon_url || '📦'} {cat.category_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            🔥 <span className="text-accent-gold">Sản phẩm</span> nổi bật
          </h2>
          <Link
            to="/products"
            style={{
              color: 'var(--price-color)',
              fontWeight: 600,
              fontSize: 14,
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-accent)',
              background: 'var(--bg-highlight, transparent)',
            }}
          >
            Xem tất cả →
          </Link>
        </div>
        <ProductList products={products} loading={loading} />
      </div>

      {/* Features */}
      <div className="section-surface" style={{ padding: '48px 0', marginBottom: 32 }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 32,
            textAlign: 'center',
          }}>
            {[
              { icon: '🚚', title: 'Giao hàng nhanh', desc: 'Vận chuyển toàn quốc, giao trong 2-5 ngày' },
              { icon: '🔒', title: 'Thanh toán an toàn', desc: 'MoMo, VNPay, COD – đảm bảo bảo mật' },
              { icon: '↩️', title: 'Đổi trả dễ dàng', desc: '7 ngày đổi trả nếu sản phẩm lỗi' },
              { icon: '🎧', title: 'Hỗ trợ 24/7', desc: 'Đội ngũ CSKH sẵn sàng hỗ trợ bạn' },
            ].map(f => (
              <div
                key={f.title}
                style={{
                  padding: '20px 16px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-highlight, var(--gray-50))',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default Home
