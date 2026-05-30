import React from 'react'
import Navbar from '../../components/common/Navbar'
import Footer from '../../components/common/Footer'
import CartItem from '../../components/cart/CartItem'
import CartSummary from '../../components/cart/CartSummary'
import { useCart } from '../../hooks/useCart'
import { Link } from 'react-router-dom'
import Loading from '../../components/common/Loading'

const CartPage: React.FC = () => {
  const { cart, loading, clear } = useCart()

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Giỏ hàng của tôi ({cart.item_count})</h1>
        {loading ? <Loading /> : cart.items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🛒</div>
            <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Giỏ hàng trống</h2>
            <p style={{ color: 'var(--gray-500)', marginBottom: 24 }}>Thêm sản phẩm vào giỏ để tiếp tục</p>
            <Link to="/products" className="btn btn-primary btn-lg">Tiếp tục mua sắm</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
            <div>
              <div className="card" style={{ padding: '0 20px' }}>
                {cart.items.map(item => <CartItem key={item.cart_id} item={item} />)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                <Link to="/products" style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 500 }}>← Tiếp tục mua</Link>
                <button onClick={clear} style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: 14, cursor: 'pointer' }}>🗑 Xóa tất cả</button>
              </div>
            </div>
            <CartSummary total={cart.total} itemCount={cart.item_count} />
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

export default CartPage
