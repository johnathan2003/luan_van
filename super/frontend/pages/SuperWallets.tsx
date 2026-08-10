/**
 * super/frontend/pages/SuperWallets.tsx
 * ----------------------------------------
 * Superadmin — bảng ví tiền từng shop: khả dụng / đang giữ đấu giá / doanh thu.
 * Chỉ xem — số dư này sinh ra từ business logic (đơn hàng, đấu giá banner),
 * không sửa tay ở đây. Muốn sửa tay tiền hệ thống thì qua trang "Tài chính hệ thống".
 */
import React, { useEffect, useState } from 'react'
import superApi from '../superApi'

const S = {
  bg:      '#0a0a0f',
  card:    '#13131a',
  border:  '#1e1e2e',
  red:     '#dc2626',
  redDark: '#7f1d1d',
  text:    '#f1f5f9',
  muted:   '#475569',
  input:   '#1e1e2e',
  green:   '#16a34a',
  amber:   '#d97706',
}

interface ShopWalletRow {
  shop_id:       number
  shop_name:     string
  balance:       number
  reserved:      number
  available:     number
  total_orders:  number
  total_revenue: number
  shop_profit:   number
}

const fmt = (n: number) => Number(n || 0).toLocaleString('vi-VN') + '₫'

const SuperWallets: React.FC = () => {
  const [items, setItems]     = useState<ShopWalletRow[]>([])
  const [total, setTotal]     = useState(0)
  const [shopRate, setShopRate] = useState(0.7)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)

  const load = (q = search, p = page) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (q) params.set('q', q)
    superApi.get(`/wallets/shops?${params}`)
      .then(r => {
        setItems(r.data.items || [])
        setTotal(r.data.total || 0)
        setShopRate(r.data.shop_rate ?? 0.7)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(search, 1) }

  const totals = items.reduce((acc, r) => ({
    balance:   acc.balance + r.balance,
    reserved:  acc.reserved + r.reserved,
    available: acc.available + r.available,
    profit:    acc.profit + r.shop_profit,
  }), { balance: 0, reserved: 0, available: 0, profit: 0 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ color: S.text, fontSize: 20, fontWeight: 800, margin: 0 }}>💰 Ví tiền Shop</h1>
        <p style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>
          Tổng: {total} shop — doanh thu net tính theo % hoa hồng đang active ({(shopRate * 100).toFixed(0)}% về shop)
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Tổng khả dụng (trang này)', value: totals.available, color: S.green },
          { label: 'Tổng đang giữ đấu giá', value: totals.reserved, color: S.amber },
          { label: 'Tổng số dư ví', value: totals.balance, color: S.text },
          { label: 'Tổng doanh thu net (trang này)', value: totals.profit, color: S.red },
        ].map(c => (
          <div key={c.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ color: S.muted, fontSize: 11, margin: '0 0 6px', fontWeight: 600 }}>{c.label}</p>
            <p style={{ color: c.color, fontSize: 18, fontWeight: 800, margin: 0 }}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên shop..."
          style={{ padding: '7px 12px', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none', width: 260 }} />
        <button type="submit" style={{ padding: '7px 14px', background: S.red, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Tìm</button>
      </form>

      {/* Table */}
      {loading
        ? <div style={{ color: S.muted, textAlign: 'center', padding: 40 }}>Đang tải...</div>
        : (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0a0a0f' }}>
                  {['Shop', 'Khả dụng', 'Đang giữ đấu giá', 'Số dư ví', 'Đơn hoàn tất', 'Doanh thu gross', 'Doanh thu net (vào ví)'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: S.muted, fontSize: 11, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.shop_id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '10px 14px', color: S.text, fontWeight: 600 }}>{r.shop_name} <span style={{ color: S.muted, fontWeight: 400 }}>#{r.shop_id}</span></td>
                    <td style={{ padding: '10px 14px', color: S.green, fontWeight: 700 }}>{fmt(r.available)}</td>
                    <td style={{ padding: '10px 14px', color: S.amber }}>{fmt(r.reserved)}</td>
                    <td style={{ padding: '10px 14px', color: S.text }}>{fmt(r.balance)}</td>
                    <td style={{ padding: '10px 14px', color: S.muted }}>{r.total_orders}</td>
                    <td style={{ padding: '10px 14px', color: S.muted }}>{fmt(r.total_revenue)}</td>
                    <td style={{ padding: '10px 14px', color: S.red, fontWeight: 700 }}>{fmt(r.shop_profit)}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: S.muted }}>Không có shop nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      }

      {/* Pagination */}
      {total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>← Trước</button>
          <span style={{ padding: '7px 14px', color: S.muted, fontSize: 13 }}>Trang {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={items.length < 20}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>Tiếp →</button>
        </div>
      )}
    </div>
  )
}

export default SuperWallets
