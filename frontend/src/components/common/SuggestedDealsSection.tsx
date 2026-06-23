import React from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/formatters'

// Goi y san pham hien thi o cuoi cac trang de trang khong bi trong
// (Don hang cua toi / Gio hang / Voucher) - du lieu mau, chua noi API thuc

interface DealItem {
  id: number
  brand?: string
  name: string
  image: string
  price: number
  originalPrice: number
  sold: string
}

// San pham tu cac nhan hang dang giam gia
const BRAND_DEALS: DealItem[] = [
  { id: 11, brand: 'Samsung', name: 'Galaxy S24 Ultra 512GB',         image: 'https://placehold.co/180x180/1428A0/ffffff?text=S24Ultra', price: 24990000, originalPrice: 29990000, sold: '890' },
  { id: 12, brand: 'Nike',    name: 'Air Max 270 React - Đen/Trắng',  image: 'https://placehold.co/180x180/111827/ffffff?text=AirMax',   price: 2990000,  originalPrice: 3990000,  sold: '3.4k' },
  { id: 14, brand: 'Adidas',  name: 'Ultra Boost 22 Running Shoes',   image: 'https://placehold.co/180x180/222/ffffff?text=UBoost',      price: 3490000,  originalPrice: 4990000,  sold: '2.1k' },
  { id: 15, brand: 'Xiaomi',  name: 'Redmi Note 13 Pro 5G 256GB',     image: 'https://placehold.co/180x180/ff6900/ffffff?text=Xiaomi',   price: 5990000,  originalPrice: 7490000,  sold: '4.8k' },
]

// San pham dang duoc san (BuyZo) tro gia
const PLATFORM_DEALS: DealItem[] = [
  { id: 1, name: 'Tai nghe Sony WH-1000XM5',  image: 'https://placehold.co/180x180/1a1a2e/ffffff?text=Sony',     price: 4990000, originalPrice: 8490000, sold: '312' },
  { id: 4, name: 'Dầu gội Pantene 900ml',     image: 'https://placehold.co/180x180/1e3a5f/ffffff?text=Pantene', price: 99000,   originalPrice: 185000,  sold: '543' },
  { id: 6, name: 'Sữa rửa mặt CeraVe 236ml',  image: 'https://placehold.co/180x180/e2e8f0/1a1a2e?text=CeraVe',  price: 245000,  originalPrice: 395000,  sold: '880' },
  { id: 8, name: 'Nước hoa Dior Sauvage 100ml', image: 'https://placehold.co/180x180/0f172a/ffffff?text=Dior', price: 2290000, originalPrice: 3800000, sold: '156' },
]

const DealCard: React.FC<{ item: DealItem; badge: string; badgeColor: string }> = ({ item, badge, badgeColor }) => {
  const pct = Math.round((1 - item.price / item.originalPrice) * 100)
  return (
    <Link to={`/products/${item.id}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
        <div style={{ position: 'relative', background: 'var(--gray-100)' }}>
          <img src={item.image} alt={item.name} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', top: 8, left: 8, background: badgeColor, color: '#fff', fontWeight: 800, fontSize: 10, padding: '3px 7px', borderRadius: 20 }}>{badge}</div>
          {pct > 0 && <div style={{ position: 'absolute', top: 8, right: 8, background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 11, padding: '3px 7px', borderRadius: 20 }}>-{pct}%</div>}
        </div>
        <div style={{ padding: 10 }}>
          {item.brand && <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.brand}</div>}
          <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--gray-800)', lineHeight: 1.4, marginBottom: 6, height: 34, overflow: 'hidden' }}>{item.name}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>{formatCurrency(item.price)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 10.5, color: 'var(--gray-400)', textDecoration: 'line-through' }}>{formatCurrency(item.originalPrice)}</span>
            <span style={{ fontSize: 10.5, color: 'var(--gray-400)' }}>Đã bán {item.sold}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

const DealRow: React.FC<{ title: string; icon: string; items: DealItem[]; badge: string; badgeColor: string; linkTo: string }> = ({ title, icon, items, badge, badgeColor, linkTo }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <p style={{ fontWeight: 700, fontSize: 14.5 }}>{icon} {title}</p>
      <Link to={linkTo} style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Xem thêm →</Link>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      {items.map(item => <DealCard key={item.id} item={item} badge={badge} badgeColor={badgeColor} />)}
    </div>
  </div>
)

// Section dung chung de chen vao cuoi cac trang (Don hang / Gio hang / Voucher) cho khoi trong
const SuggestedDealsSection: React.FC = () => (
  <div style={{ marginTop: 28 }}>
    <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 16 }}>🛍️ Có thể bạn sẽ thích</p>
    <DealRow title="Nhãn hàng đang giảm giá" icon="🏆" items={BRAND_DEALS} badge="MALL" badgeColor="#7C3AED" linkTo="/mall" />
    <DealRow title="Sàn đang trợ giá" icon="⚡" items={PLATFORM_DEALS} badge="TRỢ GIÁ" badgeColor="#ef4444" linkTo="/" />
  </div>
)

export default SuggestedDealsSection
