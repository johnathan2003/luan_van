/**
 * AdminWalletPage.tsx — Xem ví shop (chỉ Superadmin)
 * -----------------------------------------------------------
 * GET  /api/v1/wallet/admin/wallets
 *
 * Nạp tiền giờ là hệ thống demo tự động 100% (shop tự "giả bộ thanh toán
 * xong" ở trang giả lập, không có tiền thật) — không còn hàng chờ admin
 * duyệt nữa, nên trang này chỉ còn thuần theo dõi/đối soát tổng số dư.
 */
import React, { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import API from '../../services/api'
import type { RootState } from '../../store/store'

// ── Types ─────────────────────────────────────────────────────────────────────
interface WalletRow {
  wallet_id: number
  shop_id: number
  shop_name: string
  balance: number
  reserved: number
  auction_fund: number
  available: number
}

// ── Colors ─────────────────────────────────────────────────────────────────────
const C = {
  green:    '#16A34A',  greenBg:  'rgba(22,163,74,0.08)',
  orange:   '#EA580C',  orangeBg: 'rgba(234,88,12,0.08)',
  red:      '#DC2626',  redBg:    'rgba(220,38,38,0.08)',
  blue:     '#2563EB',  blueBg:   'rgba(37,99,235,0.08)',
  gray:     'var(--text-secondary)',
  border:   'var(--border-subtle)',
  card:     'var(--bg-card)',
}

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }
const btn = (bg: string, color = 'white'): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 7,
  padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
})

// ── Main ───────────────────────────────────────────────────────────────────────
const AdminWalletPage: React.FC = () => {
  const currentUser = useSelector((s: RootState) => s.auth.user)
  const isSuperadmin = currentUser?.roles?.includes('superadmin') || false

  const [wallets,     setWallets]     = useState<WalletRow[]>([])
  const [walletTotal, setWalletTotal] = useState(0)
  const [walletPage,  setWalletPage]  = useState(1)
  const [walletPages, setWalletPages] = useState(1)
  const [walletLoading, setWalletLoading] = useState(false)

  const loadWallets = useCallback(async () => {
    setWalletLoading(true)
    try {
      const r = await API.get('/api/v1/wallet/admin/wallets', { params: { page: walletPage, limit: 20 } })
      setWallets(r.data.wallets)
      setWalletTotal(r.data.total)
      setWalletPages(r.data.pages)
    } catch { /* ignore */ }
    finally { setWalletLoading(false) }
  }, [walletPage])

  useEffect(() => { if (isSuperadmin) loadWallets() }, [isSuperadmin, loadWallets])

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ marginBottom: 4 }}>💰 Ví tiền Shop</h2>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>
        Nạp tiền là hệ thống demo, tự động 100% (shop tự thao tác, không có tiền thật) — không còn hàng chờ duyệt nào ở đây nữa.
        {isSuperadmin ? ' Bên dưới là tổng số dư ví của từng shop để theo dõi/đối soát.' : ' Tổng số dư ví chỉ Superadmin mới xem được.'}
      </p>

      {!isSuperadmin ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 30, textAlign: 'center', color: C.gray }}>
          🔒 Chỉ Superadmin mới xem được tổng số dư ví của các shop.
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color: C.gray, fontSize: 13 }}>Tổng {walletTotal} shop có ví</span>
            <button onClick={loadWallets} style={btn(C.blue)}>🔄 Làm mới</button>
          </div>

          {walletLoading ? (
            <p style={{ color: C.gray, textAlign: 'center', padding: 20 }}>Đang tải...</p>
          ) : wallets.length === 0 ? (
            <p style={{ color: C.gray, textAlign: 'center', padding: 30 }}>Chưa có shop nào có ví.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  {['Shop', 'Tổng số dư', 'Đang giữ (phiên đang chạy)', 'Tiền đấu giá (đánh dấu)', 'Khả dụng'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: C.gray, fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wallets.map(w => (
                  <tr key={w.wallet_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{w.shop_name}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: C.blue }}>{fmt(w.balance)}</td>
                    <td style={{ padding: '10px 12px', color: w.reserved > 0 ? C.orange : C.gray }}>{fmt(w.reserved)}</td>
                    <td style={{ padding: '10px 12px', color: w.auction_fund > 0 ? '#7C3AED' : C.gray }}>{fmt(w.auction_fund)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: C.green }}>{fmt(w.available)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {walletPages > 1 && (
            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 16 }}>
              {Array.from({ length: walletPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setWalletPage(p)}
                  style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${p === walletPage ? C.blue : C.border}`, background: p === walletPage ? C.blue : 'transparent', color: p === walletPage ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminWalletPage
