/**
 * super/frontend/pages/SuperDashboard.tsx
 * -----------------------------------------
 * Dashboard nhanh cho superadmin.
 * Tóm tắt DB counts: sản phẩm, user.
 */
import React, { useEffect, useState } from 'react'
import superApi from '../superApi'

const CARD_STYLE: React.CSSProperties = {
  background: '#13131a',
  border: '1px solid #1e1e2e',
  borderRadius: 12,
  padding: '24px',
}

const SuperDashboard: React.FC = () => {
  const [stats, setStats] = useState<{ products: number; users: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      superApi.get('/products?limit=1'),
      superApi.get('/users?limit=1'),
    ]).then(([prodRes, userRes]) => {
      setStats({
        products: prodRes.data.total ?? 0,
        users:    userRes.data.total ?? 0,
      })
    }).finally(() => setLoading(false))
  }, [])

  const ITEMS = [
    { label: 'Tổng sản phẩm',   value: stats?.products, icon: '📦', path: '/super/products' },
    { label: 'Tổng người dùng', value: stats?.users,    icon: '👥', path: '/super/users' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 800, margin: 0 }}>
          ⚡ Superadmin Dashboard
        </h1>
        <p style={{ color: '#475569', fontSize: 13, marginTop: 6 }}>
          Can thiệp trực tiếp vào database — không ghi log — nằm ngoài khuôn khổ hệ thống
        </p>
      </div>

      {/* Warning banner */}
      <div style={{
        padding: '14px 18px',
        background: 'rgba(127,29,29,0.2)',
        border: '1px solid #7f1d1d',
        borderRadius: 10,
        color: '#fca5a5',
        fontSize: 13,
      }}>
        ⚠️ Mọi thao tác tại đây tác động <strong>trực tiếp</strong> vào database và <strong>không được ghi nhận</strong> vào audit log.
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {loading
          ? [1, 2].map(i => (
              <div key={i} style={{ ...CARD_STYLE, height: 100, opacity: 0.4 }} />
            ))
          : ITEMS.map(item => (
              <a key={item.label} href={item.path} style={{ textDecoration: 'none' }}>
                <div style={{
                  ...CARD_STYLE,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#7f1d1d')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e2e')}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9' }}>
                    {item.value?.toLocaleString() ?? '—'}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{item.label}</div>
                </div>
              </a>
            ))
        }
      </div>

      {/* Quick links */}
      <div style={CARD_STYLE}>
        <h2 style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700, marginTop: 0, marginBottom: 16, letterSpacing: '0.08em' }}>
          THAO TÁC NHANH
        </h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '📦 Sửa ảnh sản phẩm',  href: '/super/products' },
            { label: '👥 Xem tất cả user',    href: '/super/users' },
          ].map(item => (
            <a key={item.href} href={item.href}
              style={{
                padding: '9px 16px',
                background: '#1e1e2e',
                border: '1px solid #2d2d3d',
                borderRadius: 8,
                color: '#cbd5e1',
                fontSize: 13,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SuperDashboard
