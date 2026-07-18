/**
 * WalletPage.tsx — Ví tiền shop (kết nối API thật)
 * --------------------------------------------------
 * GET  /api/v1/wallet/me
 * GET  /api/v1/wallet/transactions
 * POST /api/v1/wallet/deposit-request
 */
import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Wallet {
  wallet_id: number
  shop_id: number
  shop_name: string | null
  balance: number
  reserved: number
  available: number
}
interface Txn {
  txn_id: number
  amount: number
  txn_type: string
  ref_type: string | null
  ref_id: number | null
  note: string | null
  created_at: string
}

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  green:  '#16A34A',
  greenBg: 'rgba(22,163,74,0.08)',
  blue:   '#2563EB',
  blueBg: 'rgba(37,99,235,0.08)',
  orange: '#EA580C',
  orangeBg: 'rgba(234,88,12,0.08)',
  red:    '#DC2626',
  gray:   'var(--text-secondary)',
  border: 'var(--border-subtle)',
  card:   'var(--bg-card)',
}

const TXN_LABELS: Record<string, { label: string; color: string; prefix: string }> = {
  deposit:          { label: 'Nạp tiền',             color: C.green,  prefix: '+' },
  deposit_pending:  { label: 'Chờ duyệt nạp',        color: C.orange, prefix: '' },
  deposit_rejected: { label: 'Bị từ chối',            color: C.red,    prefix: '' },
  withdraw:         { label: 'Rút tiền',              color: C.red,    prefix: '-' },
  reserve:          { label: 'Giữ cọc đấu giá',      color: C.orange, prefix: '-' },
  release:          { label: 'Hoàn cọc đấu giá',     color: C.blue,   prefix: '+' },
  charge:           { label: 'Thanh toán thắng đấu giá', color: C.red, prefix: '-' },
  refund:           { label: 'Hoàn tiền (thua đấu giá)', color: C.green, prefix: '+' },
}

function fmt(n: number) {
  return n.toLocaleString('vi-VN') + 'đ'
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const WalletPage: React.FC = () => {
  const [wallet,  setWallet]  = useState<Wallet | null>(null)
  const [txns,    setTxns]    = useState<Txn[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoading] = useState(true)
  const [txnType, setTxnType] = useState('')

  // Deposit form
  const [amount,  setAmount]  = useState('')
  const [note,    setNote]    = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState<'overview' | 'history' | 'deposit'>('overview')

  const loadWallet = useCallback(async () => {
    try {
      const r = await API.get('/api/v1/wallet/me')
      setWallet(r.data)
    } catch (e: any) {
      toast.error('Không thể tải ví: ' + (e?.response?.data?.detail || e.message))
    }
  }, [])

  const loadTxns = useCallback(async () => {
    try {
      const params: any = { page, limit: 15 }
      if (txnType) params.txn_type = txnType
      const r = await API.get('/api/v1/wallet/transactions', { params })
      setTxns(r.data.transactions)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch { /* ignore */ }
  }, [page, txnType])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadWallet(), loadTxns()]).finally(() => setLoading(false))
  }, [loadWallet, loadTxns])

  const handleDeposit = async () => {
    const raw = parseInt(amount.replace(/[^\d]/g, ''))
    if (!raw || raw <= 0) { toast.error('Nhập số tiền hợp lệ'); return }
    if (raw > 100_000_000) { toast.error('Tối đa 100,000,000đ'); return }
    setSubmitting(true)
    try {
      await API.post('/api/v1/wallet/deposit-request', { amount: raw, note: note || 'Nạp thử' })
      toast.success('✅ Đã gửi yêu cầu nạp tiền — Admin sẽ duyệt sớm!')
      setAmount(''); setNote('')
      await Promise.all([loadWallet(), loadTxns()])
      setTab('history')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Không thể gửi yêu cầu')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải ví...</div>
  }

  const btnStyle = (bg: string, color = 'white'): React.CSSProperties => ({
    background: bg, color, border: 'none', borderRadius: 8,
    padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  })
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
    background: active ? C.green : 'transparent',
    color:      active ? 'white' : C.gray,
  })

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ marginBottom: 4 }}>💰 Ví tiền shop</h2>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>
        Quản lý số dư để tham gia đấu giá banner quảng cáo.
      </p>

      {/* ── Balance cards ────────────────────────────────────────────────────── */}
      {wallet && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Tổng số dư',        value: wallet.balance,   color: C.blue,   bg: C.blueBg,   icon: '🏦' },
            { label: 'Đang giữ đấu giá',  value: wallet.reserved,  color: C.orange, bg: C.orangeBg, icon: '🔒' },
            { label: 'Khả dụng',          value: wallet.available, color: C.green,  bg: C.greenBg,  icon: '✅' },
          ].map(({ label, value, color, bg, icon }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color }}>{fmt(value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={tabStyle(tab === 'overview')} onClick={() => setTab('overview')}>📊 Tổng quan</button>
        <button style={tabStyle(tab === 'history')}  onClick={() => setTab('history')}>📋 Lịch sử</button>
        <button style={tabStyle(tab === 'deposit')}  onClick={() => setTab('deposit')}>💳 Nạp tiền</button>
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────────── */}
      {tab === 'overview' && wallet && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px' }}>Thông tin ví</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {[
                ['Shop',          wallet.shop_name ?? `#${wallet.shop_id}`],
                ['ID ví',         `#${wallet.wallet_id}`],
                ['Tổng số dư',    <b style={{ color: C.blue }}>{fmt(wallet.balance)}</b>],
                ['Đang giữ',      <b style={{ color: C.orange }}>{fmt(wallet.reserved)}</b>],
                ['Khả dụng',      <b style={{ color: C.green, fontSize: 16 }}>{fmt(wallet.available)}</b>],
              ].map(([k, v]) => (
                <tr key={String(k)}>
                  <td style={{ padding: '10px 0', color: C.gray, width: 160 }}>{k}</td>
                  <td style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>{v as any}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button style={btnStyle(C.green)} onClick={() => setTab('deposit')}>💳 Nạp tiền</button>
            <button style={btnStyle('transparent', C.gray)} onClick={() => setTab('history')}>
              📋 Xem lịch sử giao dịch ({total})
            </button>
          </div>
          <div style={{ marginTop: 16, background: C.greenBg, borderRadius: 10, padding: '12px 16px', fontSize: 12, color: C.green }}>
            <b>💡 Cách hoạt động:</b> Khi đặt giá banner, số tiền sẽ chuyển sang trạng thái "Đang giữ". Nếu thắng → bị trừ thật. Nếu thua → được hoàn lại vào số dư khả dụng.
          </div>
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Lịch sử giao dịch <span style={{ color: C.gray, fontSize: 14, fontWeight: 400 }}>({total})</span></h3>
            <select
              value={txnType}
              onChange={e => { setTxnType(e.target.value); setPage(1) }}
              style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 12 }}>
              <option value="">Tất cả</option>
              <option value="deposit">Nạp tiền</option>
              <option value="deposit_pending">Chờ duyệt</option>
              <option value="reserve">Giữ cọc</option>
              <option value="release">Hoàn cọc</option>
              <option value="charge">Thanh toán</option>
              <option value="refund">Hoàn tiền</option>
            </select>
          </div>

          {txns.length === 0 ? (
            <p style={{ color: C.gray, textAlign: 'center', padding: 20 }}>Chưa có giao dịch nào.</p>
          ) : (
            <div>
              {txns.map(t => {
                const meta = TXN_LABELS[t.txn_type] ?? { label: t.txn_type, color: C.gray, prefix: '' }
                const sign = meta.prefix === '+' ? '+' : meta.prefix === '-' ? '-' : ''
                return (
                  <div key={t.txn_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{meta.label}</div>
                      {t.note && <div style={{ fontSize: 12, color: C.gray }}>{t.note}</div>}
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{fmtDate(t.created_at)}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ fontWeight: 700, color: meta.color, fontSize: 14 }}>
                        {sign}{fmt(Math.abs(t.amount))}
                      </div>
                      <div style={{ fontSize: 11, color: C.gray }}># {t.txn_id}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 20 }}>
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${p === page ? C.green : C.border}`, background: p === page ? C.green : 'transparent', color: p === page ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Deposit ──────────────────────────────────────────────────────────── */}
      {tab === 'deposit' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px' }}>Nạp tiền vào ví</h3>
          <div style={{ background: C.orangeBg, border: `1px solid ${C.orange}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: C.orange }}>
            <b>📋 Quy trình:</b> Bạn gửi yêu cầu → Admin duyệt → tiền vào ví. Tối đa 100,000,000đ/lần và 2 yêu cầu chờ duyệt cùng lúc.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 6 }}>Số tiền nạp (đ)</label>
              {/* Quick amounts */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {[500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000].map(v => (
                  <button key={v} onClick={() => setAmount(v.toLocaleString('vi-VN'))}
                    style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: `1px solid ${amount === v.toLocaleString('vi-VN') ? C.green : C.border}`, background: amount === v.toLocaleString('vi-VN') ? C.green : 'transparent', color: amount === v.toLocaleString('vi-VN') ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                    {v.toLocaleString('vi-VN')}đ
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={amount}
                onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setAmount(raw ? Number(raw).toLocaleString('vi-VN') : '') }}
                placeholder="Nhập số tiền..."
                style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 6 }}>Ghi chú (tuỳ chọn)</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="VD: Nạp tiền tháng 7, đấu giá banner..."
                style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={handleDeposit}
              disabled={submitting || !amount}
              style={{ ...btnStyle(submitting || !amount ? '#9CA3AF' : C.green), padding: '12px', fontSize: 14, alignSelf: 'flex-start', minWidth: 160 }}>
              {submitting ? 'Đang gửi...' : '💳 Gửi yêu cầu nạp tiền'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WalletPage
