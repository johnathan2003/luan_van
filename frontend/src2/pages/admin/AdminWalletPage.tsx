/**
 * AdminWalletPage.tsx — Admin duyệt nạp tiền + xem ví shop
 * -----------------------------------------------------------
 * GET  /api/v1/wallet/admin/deposit-requests
 * POST /api/v1/wallet/admin/deposit-requests/{id}/approve
 * POST /api/v1/wallet/admin/deposit-requests/{id}/reject
 * GET  /api/v1/wallet/admin/wallets
 */
import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'

// ── Types ─────────────────────────────────────────────────────────────────────
interface DepositTxn {
  txn_id: number
  shop_id: number
  shop_name: string
  amount: number
  txn_type: string
  note: string | null
  created_at: string
}
interface WalletRow {
  wallet_id: number
  shop_id: number
  shop_name: string
  balance: number
  reserved: number
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
function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const btn = (bg: string, color = 'white'): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 7,
  padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
})

// ── Main ───────────────────────────────────────────────────────────────────────
const AdminWalletPage: React.FC = () => {
  const [tab, setTab] = useState<'deposits' | 'wallets'>('deposits')

  // Deposits
  const [deposits,      setDeposits]      = useState<DepositTxn[]>([])
  const [depositTotal,  setDepositTotal]  = useState(0)
  const [depositPage,   setDepositPage]   = useState(1)
  const [depositPages,  setDepositPages]  = useState(1)
  const [depositFilter, setDepositFilter] = useState<'pending' | 'all'>('pending')
  const [depositLoading, setDepositLoading] = useState(false)
  const [rejectModal, setRejectModal] = useState<{ txn_id: number; shop_name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState<number | null>(null)

  // Wallets
  const [wallets,     setWallets]     = useState<WalletRow[]>([])
  const [walletTotal, setWalletTotal] = useState(0)
  const [walletPage,  setWalletPage]  = useState(1)
  const [walletPages, setWalletPages] = useState(1)
  const [walletLoading, setWalletLoading] = useState(false)

  const loadDeposits = useCallback(async () => {
    setDepositLoading(true)
    try {
      const r = await API.get('/api/v1/wallet/admin/deposit-requests', {
        params: { page: depositPage, limit: 20, status: depositFilter },
      })
      setDeposits(r.data.deposits)
      setDepositTotal(r.data.total)
      setDepositPages(r.data.pages)
    } catch { /* ignore */ }
    finally { setDepositLoading(false) }
  }, [depositPage, depositFilter])

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

  useEffect(() => { if (tab === 'deposits') loadDeposits() }, [tab, loadDeposits])
  useEffect(() => { if (tab === 'wallets')  loadWallets()  }, [tab, loadWallets])

  const approve = async (txn_id: number) => {
    setProcessing(txn_id)
    try {
      const r = await API.post(`/api/v1/wallet/admin/deposit-requests/${txn_id}/approve`)
      toast.success(`✅ Đã duyệt — ${fmt(r.data.amount)} vào ví`)
      loadDeposits()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Lỗi khi duyệt')
    } finally { setProcessing(null) }
  }

  const reject = async () => {
    if (!rejectModal) return
    setProcessing(rejectModal.txn_id)
    try {
      await API.post(`/api/v1/wallet/admin/deposit-requests/${rejectModal.txn_id}/reject`, { reason: rejectReason || 'Admin từ chối' })
      toast.info('Đã từ chối yêu cầu nạp tiền')
      setRejectModal(null); setRejectReason(''); loadDeposits()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Lỗi khi từ chối')
    } finally { setProcessing(null) }
  }

  const tabBtn = (t: 'deposits' | 'wallets', label: string): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', background: tab === t ? C.green : 'transparent', color: tab === t ? 'white' : C.gray,
  })

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ marginBottom: 4 }}>💰 Quản lý Ví tiền Shop</h2>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>Duyệt yêu cầu nạp tiền và xem số dư ví của từng shop.</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={tabBtn('deposits', '')} onClick={() => setTab('deposits')}>
          📋 Yêu cầu nạp tiền
          {depositFilter === 'pending' && depositTotal > 0 && (
            <span style={{ marginLeft: 6, background: C.orange, color: 'white', borderRadius: 999, padding: '0 7px', fontSize: 11 }}>{depositTotal}</span>
          )}
        </button>
        <button style={tabBtn('wallets', '')} onClick={() => setTab('wallets')}>🏦 Ví của tất cả shop</button>
      </div>

      {/* ── DEPOSITS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'deposits' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['pending', 'all'] as const).map(f => (
                <button key={f} onClick={() => { setDepositFilter(f); setDepositPage(1) }}
                  style={{ ...btn(depositFilter === f ? C.orange : 'transparent', depositFilter === f ? 'white' : C.gray), border: `1px solid ${depositFilter === f ? C.orange : C.border}` }}>
                  {f === 'pending' ? '⏳ Chờ duyệt' : '📋 Tất cả'}
                </button>
              ))}
            </div>
            <button onClick={loadDeposits} style={btn(C.blue)}>🔄 Làm mới</button>
          </div>

          {depositLoading ? (
            <p style={{ color: C.gray, textAlign: 'center', padding: 20 }}>Đang tải...</p>
          ) : deposits.length === 0 ? (
            <p style={{ color: C.gray, textAlign: 'center', padding: 30 }}>
              {depositFilter === 'pending' ? '✅ Không có yêu cầu nào chờ duyệt.' : 'Chưa có yêu cầu nào.'}
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  {['#', 'Shop', 'Số tiền', 'Ghi chú', 'Thời gian', 'Trạng thái', 'Thao tác'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.gray, fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deposits.map(d => (
                  <tr key={d.txn_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 10px', color: C.gray }}>#{d.txn_id}</td>
                    <td style={{ padding: '10px 10px', fontWeight: 600 }}>{d.shop_name}</td>
                    <td style={{ padding: '10px 10px', fontWeight: 700, color: C.green }}>{fmt(d.amount)}</td>
                    <td style={{ padding: '10px 10px', color: C.gray, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.note || '—'}</td>
                    <td style={{ padding: '10px 10px', color: C.gray, whiteSpace: 'nowrap' }}>{fmtDate(d.created_at)}</td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{
                        background: d.txn_type === 'deposit_pending' ? C.orangeBg : d.txn_type === 'deposit' ? C.greenBg : C.redBg,
                        color:      d.txn_type === 'deposit_pending' ? C.orange   : d.txn_type === 'deposit' ? C.green   : C.red,
                        borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                      }}>
                        {d.txn_type === 'deposit_pending' ? '⏳ Chờ duyệt' : d.txn_type === 'deposit' ? '✅ Đã duyệt' : '❌ Từ chối'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      {d.txn_type === 'deposit_pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => approve(d.txn_id)}
                            disabled={processing === d.txn_id}
                            style={btn(processing === d.txn_id ? '#9CA3AF' : C.green)}>
                            ✅ Duyệt
                          </button>
                          <button
                            onClick={() => { setRejectModal({ txn_id: d.txn_id, shop_name: d.shop_name }); setRejectReason('') }}
                            style={btn(C.redBg, C.red)}>
                            ❌ Từ chối
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {depositPages > 1 && (
            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 16 }}>
              {Array.from({ length: depositPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setDepositPage(p)}
                  style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${p === depositPage ? C.orange : C.border}`, background: p === depositPage ? C.orange : 'transparent', color: p === depositPage ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── WALLETS TAB ──────────────────────────────────────────────────────── */}
      {tab === 'wallets' && (
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
                  {['Shop', 'Tổng số dư', 'Đang giữ', 'Khả dụng'].map(h => (
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

      {/* ── Reject Modal ─────────────────────────────────────────────────────── */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, maxWidth: 420, width: '90%' }}>
            <h3 style={{ margin: '0 0 8px', color: C.red }}>❌ Từ chối yêu cầu nạp tiền</h3>
            <p style={{ color: C.gray, fontSize: 13, marginBottom: 16 }}>
              Shop: <b>{rejectModal.shop_name}</b> · Yêu cầu #{rejectModal.txn_id}
            </p>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Lý do từ chối (tùy chọn)</label>
            <input
              type="text"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="VD: Thông tin chuyển khoản không hợp lệ..."
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, boxSizing: 'border-box', marginBottom: 16 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectModal(null)} style={btn('transparent', C.gray)}>Hủy</button>
              <button onClick={reject} disabled={processing !== null} style={btn(C.red)}>Xác nhận từ chối</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminWalletPage
