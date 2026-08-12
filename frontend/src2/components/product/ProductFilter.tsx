import React from 'react'
import type { Category } from '../../types/product'
import { SORT_OPTIONS } from '../../utils/constants'

interface Props {
  categories: Category[]
  filters: any
  onChange: (key: string, value: any) => void
}

const ProductFilter: React.FC<Props> = ({ categories, filters, onChange }) => (
  <div className="card" style={{ padding: 20, position: 'sticky', top: 80 }}>
    <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Bộ lọc</h3>

    {/* Category */}
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-600)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Danh mục</p>
      <button
        onClick={() => onChange('category_id', undefined)}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer', fontSize: 14, background: !filters.category_id ? 'var(--primary)' : 'transparent', color: !filters.category_id ? 'white' : 'var(--gray-700)', marginBottom: 2 }}
      >
        Tất cả
      </button>
      {categories.map(cat => (
        <button
          key={cat.category_id}
          onClick={() => onChange('category_id', cat.category_id)}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer', fontSize: 14, background: filters.category_id === cat.category_id ? 'var(--primary)' : 'transparent', color: filters.category_id === cat.category_id ? 'white' : 'var(--gray-700)', marginBottom: 2 }}
        >
          {cat.category_name}
        </button>
      ))}
    </div>

    {/* Price range */}
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-600)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Giá</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" placeholder="Từ" type="number" value={filters.min_price || ''} onChange={e => onChange('min_price', e.target.value ? Number(e.target.value) : undefined)} style={{ width: '50%' }} />
        <input className="input" placeholder="Đến" type="number" value={filters.max_price || ''} onChange={e => onChange('max_price', e.target.value ? Number(e.target.value) : undefined)} style={{ width: '50%' }} />
      </div>
    </div>

    {/* Sort */}
    <div>
      <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-600)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sắp xếp</p>
      <select className="input" value={filters.sort || 'newest'} onChange={e => onChange('sort', e.target.value)}>
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>

    <button
      onClick={() => { onChange('category_id', undefined); onChange('min_price', undefined); onChange('max_price', undefined); onChange('sort', 'newest') }}
      className="btn btn-ghost btn-sm w-full"
      style={{ marginTop: 16 }}
    >
      Xóa bộ lọc
    </button>
  </div>
)

export default ProductFilter
