/**
 * ShopLayout — dùng cho tất cả trang của Shop Owner / Shop Employee
 */
import React, { useEffect, useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/common/Navbar'
import { shopService } from '../services/shopService'
import { shopFlagStore } from '../utils/shopFlagStore'

const SHOP_NAV = [
  { icon: '\u{1F4CA}', label: 'Tổng Quan',   path: '/shop' },
  { icon: '\u{1F3F7}️', label: 'Sản Phẩm',  path: '/shop/products' },
  { icon: '\u{1F4E6}', label: 'Đơn Hàng',   path: '/shop/orders' },
  { icon: '\u{1F4AC}', label: 'Tin Nhắn',   path: '/shop/chat' },
  { icon: '\u{1F465}', label: 'Nhân Viên',  path: '/shop/employees' },
  { icon: '\u{1F4C8}', label: 'Doanh Thu',  path: '/shop/revenue' },
  { icon: '\u{1F3AB}', label: 'Voucher',    path: '/shop/vouchers' },
  { icon: '\u{1F3C6}', label: 'Đấu Giá Quảng Cáo', path: '/shop/auction' },
  { icon: '💰',        label: 'Ví Tiền',           path: '/shop/wallet' },
  { icon: '⚠️',        label: 'Khiếu Nại',  path: '/shop/complaints' },
]

const ShopSidebar: React.FC = () => {
  const [shopName, setShopName] = useState('Shop của tôi')
  const [shopId,   setShopId]   = useState<number | null>(null)

  useEffect(() => {
    shopService.getMyShop()
      .then(r => {
        setShopName(r.data.shop_name)
        setShopId(r.data.shop_id ?? r.data.id ?? null)
      })
      .catch(() => {})
  }, [])

  const flagRec   = shopId != null ? shopFlagStore.get(shopId) : null
  const flagTotal = flagRec?.total ?? 0
  const lv        = shopFlagStore.level(flagTotal)

  return (
    <aside style={{ width: 200, flexShrink: 0 }}>
      <div className="card" style={{ overflow: 'hidden', position: 'sticky', top: 80 }}>

        {/* Header xanh */}
        <div style={{ background: 'linear-gradient(135deg, #14532D 0%, #16A34A 100%)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Avatar + flag badge */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {'\u{1F3EA}'}
              </div>
              {flagTotal > 0 && (
                <div style={{
                  position: 'absolute', top: -5, right: -5,
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: flagTotal >= 5 ? '#DC2626' : '#F59E0B',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: 'white',
                  padding: '0 4px', border: '1.5px solid white',
                }}>
                  {flagTotal}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shopName}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>Quản lý shop</p>
            </div>
          </div>

          {/* Flag warning bar */}
          {flagTotal > 0 && (
            <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.28)' }}>
              {/* Progress bar */}
              <div style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${(flagTotal / 10) * 100}%`, background: flagTotal >= 7 ? '#EF4444' : flagTotal >= 5 ? '#F97316' : '#FBBF24', transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12 }}>{lv.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: flagTotal >= 5 ? '#FCA5A5' : '#FDE68A' }}>
                    {flagTotal}/10 cờ vi phạm
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>
                    {flagTotal >= 10
                      ? '🔴 Có thể bị khoá shop'
                      : flagTotal >= 5
                        ? '⚠️ Cảnh cáo nghiêm trọng'
                        : `Còn ${5 - flagTotal} cờ đến cảnh cáo`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav style={{ padding: '8px 0' }}>
          {SHOP_NAV.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/shop'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 20px', fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--role-active-color, #16A34A)' : 'var(--text-secondary)',
                background: isActive ? 'var(--role-active-bg, rgba(22,163,74,0.1))' : 'transparent',
                borderRight: isActive ? '3px solid var(--role-active-border, #22C55E)' : '3px solid transparent',
                textDecoration: 'none', transition: 'all 0.15s ease',
              })}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Link trang shop bán hàng */}
        {shopId != null && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Link to={`/shops/${shopId}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: 12, color: '#16A34A', textDecoration: 'none', background: 'rgba(22,163,74,0.08)', fontWeight: 600 }}>
                🛍️ Xem trang shop
                <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 11 }}>↗</span>
              </Link>
              <button
                title="Sao chép link"
                onClick={() => {
                  const url = `${window.location.origin}/shops/${shopId}`
                  navigator.clipboard.writeText(url).then(() => {
                    const btn = document.getElementById('copy-shop-link-btn')
                    if (btn) { btn.textContent = '✅'; setTimeout(() => { btn.textContent = '📋' }, 1500) }
                  })
                }}
                id="copy-shop-link-btn"
                style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', fontSize: 14 }}>
                📋
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

interface Props { children: React.ReactNode }


const ShopLayout: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.setAttribute('data-role', 'shop')
    return () => document.documentElement.removeAttribute('data-role')
  }, [])

  // Nếu shop bị xóa (404 từ /me), redirect về trang chủ
  useEffect(() => {
    shopService.getMyShop().catch((err: any) => {
      if (err?.response?.status === 404) {
        navigate('/', { replace: true })
      }
    })
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <Navbar />
      <div style={{ display: 'flex', gap: 24, flex: 1, width: '100%', maxWidth: 1400, margin: '0 auto', padding: '24px 32px 48px' }}>
        <ShopSidebar />
        <main style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default ShopLayout
