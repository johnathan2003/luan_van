import React from 'react'
import { formatCurrency } from '../../utils/formatters'
import type { Analytics } from '../../types/shop'

interface Props { data: Analytics }

const AnalyticsWidget: React.FC<Props> = ({ data }) => (
  <div>
    {/* KPI cards */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
      {[
        { label: 'Doanh thu', value: formatCurrency(data.total_revenue), icon: '💰', color: 'var(--primary)' },
        { label: 'Đơn hàng', value: data.total_orders, icon: '📦', color: 'var(--info)' },
        { label: 'Sản phẩm', value: data.total_products, icon: '🏷️', color: 'var(--success)' },
      ].map(item => (
        <div key={item.label} className="card" style={{ padding: 20, borderLeft: `4px solid ${item.color}` }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>{item.label}</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</p>
        </div>
      ))}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* Top products */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Sản phẩm bán chạy</h3>
        {data.top_products?.map((p, i) => (
          <div key={p.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 24, height: 24, background: 'var(--gray-100)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
              <span style={{ fontSize: 14 }}>{p.product_name}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)' }}>{p.sales} đã bán</span>
          </div>
        ))}
        {!data.top_products?.length && <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>Chưa có dữ liệu</p>}
      </div>

      {/* Order status */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Trạng thái đơn hàng</h3>
        {Object.entries(data.order_status_counts || {}).map(([status, count]) => (
          <div key={status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
            <span style={{ color: 'var(--gray-600)' }}>{status}</span>
            <span style={{ fontWeight: 600 }}>{count as number}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
)

export default AnalyticsWidget
