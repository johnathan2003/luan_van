/**
 * 🏪 Shop Overview — trang tổng quan của shop owner
 * Layout: ShopLayout (do Router bọc ngoài)
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../../components/common/Loading'
import { shopService } from '../../services/shopService'
import { formatCurrency } from '../../utils/formatters'

const ShopOverviewPage: React.FC = () => {
  const [shop, setShop]       = useState<any>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [orders, setOrders]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      shopService.getMyShop(),
      shopService.getAnalytics(30),
      shopService.getOrders({ limit: 5, order_status: 'pending' }),
    ]).then(([s, a, o]) => {
      setShop(s.data)
      setAnalytics(a.data)
      setOrders(o.data.orders || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  return (
    <div>
      {/* Shop header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{shop?.shop_name}</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>📍 {shop?.address}</p>
        </div>
        <Link to="/shop/products" className="btn btn-primary">+ Thêm sản phẩm</Link>
      </div>

      {/* KPI */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Doanh thu (30 ngày)', value: formatCurrency(analytics.total_revenue), icon: '💰', color: 'var(--primary)', path: '/shop/analytics' },
            { label: 'Tổng đơn hàng',       value: analytics.total_orders,                 icon: '📦', color: 'var(--info)',    path: '/shop/orders' },
            { label: 'Sản phẩm',            value: analytics.total_products,               icon: '🏷️', color: 'var(--success)', path: '/shop/products' },
          ].map(k => (
            <Link key={k.label} to={k.path} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: 20, borderTop: `4px solid ${k.color}`, transition: 'transform 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = '')}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{k.icon}</div>
                <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>{k.label}</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Đơn hàng chờ xác nhận */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>⏳ Đơn chờ xác nhận</h3>
            <Link to="/shop/orders?status=pending" style={{ fontSize: 13, color: 'var(--primary)' }}>Xem tất cả</Link>
          </div>
          {orders.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>Không có đơn nào đang chờ</p>
          ) : orders.map((o: any) => (
            <div key={o.order_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13 }}>#{o.order_id} · {o.items?.[0]?.product_name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(o.final_price)}</span>
            </div>
          ))}
        </div>

        {/* Top sản phẩm */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>🔥 Bán chạy nhất</h3>
            <Link to="/shop/analytics" style={{ fontSize: 13, color: 'var(--primary)' }}>Chi tiết</Link>
          </div>
          {analytics?.top_products?.length === 0 && <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>Chưa có dữ liệu</p>}
          {analytics?.top_products?.map((p: any, i: number) => (
            <div key={p.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span style={{ width: 24, height: 24, background: i < 3 ? 'var(--primary)' : 'var(--gray-200)', color: i < 3 ? 'white' : 'var(--gray-500)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product_name}</span>
              <span style={{ fontSize: 12, color: 'var(--gray-500)', flexShrink: 0 }}>{p.sales} đã bán</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
        {[
          { icon: '👥', label: 'Quản lý nhân viên', path: '/shop/employees' },
          { icon: '🎫', label: 'Tạo voucher',        path: '/shop/vouchers' },
          { icon: '⚙️', label: 'Cài đặt shop',      path: '/profile' },
        ].map(l => (
          <Link key={l.path} to={l.path} className="btn btn-outline btn-sm" style={{ gap: 6 }}>
            {l.icon} {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default ShopOverviewPage
