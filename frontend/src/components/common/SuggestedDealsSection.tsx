import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/formatters'

// Gợi ý sản phẩm — dùng API thật thay vì mock data

const DealCard: React.FC<{ item: any }> = ({ item }) => (
  <Link to={`/products/${item.product_id}`} style={{ textDecoration: 'none' }}>
    <div className="card" style={{ overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
      <div style={{ position: 'relative', background: 'var(--gray-100)', height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item.image_urls?.[0]
          ? <img src={item.image_urls[0]} alt={item.product_name} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
          : <span style={{ fontSize: 40 }}>📦</span>
        }
        <div style={{ position: 'absolute', top: 8, left: 8, background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 10, padding: '3px 7px', borderRadius: 20 }}>⚡ HOT</div>
      </div>
      <div style={{ padding: 10 }}>
        {item.shop_name && <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.shop_name}</div>}
        <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--gray-800)', lineHeight: 1.4, marginBottom: 6, height: 34, overflow: 'hidden' }}>{item.product_name}</p>
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>{formatCurrency(parseFloat(item.price))}</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 10.5, color: 'var(--gray-400)' }}>⭐ {item.rating}</span>
          <span style={{ fontSize: 10.5, color: 'var(--gray-400)' }}>Đã bán {item.sales_count}</span>
        </div>
      </div>
    </div>
  </Link>
)

const SuggestedDealsSection: React.FC = () => {
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/v1/shop/public/featured/products?limit=8')
      .then(r => r.ok ? r.json() : { products: [] })
      .then(d => setItems(d.products ?? []))
  }, [])

  if (items.length === 0) return null

  return (
    <div style={{ marginTop: 28 }}>
      <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 16 }}>🛍️ Có thể bạn sẽ thích</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {items.map((item: any) => <DealCard key={item.product_id} item={item} />)}
      </div>
    </div>
  )
}

export default SuggestedDealsSection
