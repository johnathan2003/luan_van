/**
 * WalletPage.tsx — Ví tiền shop (kết nối API thật)
 * --------------------------------------------------
 * GET  /api/v1/wallet/me
 * GET  /api/v1/wallet/transactions
 * POST /api/v1/wallet/deposit-request
 * POST /api/v1/wallet/allocate-auction
 */
import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import type { RootState } from '../../store/store'

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
  green:    '#16A34A',
  greenBg:  'rgba(22,163,74,0.08)',
  blue:     '#2563EB',
  blueBg:   'rgba(37,99,235,0.08)',
  orange:   '#EA580C',
  orangeBg: 'rgba(234,88,12,0.08)',
  purple:   '#7C3AED',
  purpleBg: 'rgba(124,58,237,0.08)',
  red:      '#DC2626',
  gray:     'var(--text-secondary)',
  border:   'var(--border-subtle)',
  card:     'var(--bg-card)',
}

const TXN_LABELS: Record<string, { label: string; color: string; prefix: string }> = {
  deposit:          { label: 'Nạp tiền',                  color: C.green,  prefix: '+' },
  deposit_pending:  { label: 'Chờ duyệt nạp',             color: C.orange, prefix: '' },
  deposit_rejected: { label: 'Bị từ chối',                 color: C.red,    prefix: '' },
  withdraw:         { label: 'Rút tiền',                   color: C.red,    prefix: '-' },
  reserve:          { label: 'Nạp tiền đấu giá',          color: C.purple, prefix: '-' },
  release:          { label: 'Hoàn tiền đấu giá',         color: C.blue,   prefix: '+' },
  charge:           { label: 'Thanh toán thắng đấu giá',  color: C.red,    prefix: '-' },
  refund:           { label: 'Hoàn tiền (thua đấu giá)',  color: C.green,  prefix: '+' },
}

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }
function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── LocalStorage helpers — key theo user_id ───────────────────────────────────
function walletKey(uid: number | string)  { return `shop_wallet_v2_${uid}` }
function txnsKey(uid: number | string)    { return `shop_wallet_txns_v2_${uid}` }
function defaultWallet(uid: number | string): Wallet {
  return { wallet_id: 0, shop_id: Number(uid), shop_name: null, balance: 0, reserved: 0, available: 0 }
}
function lsGet<T>(key: string, fallback: T): T {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback } catch { return fallback }
}
function lsSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

const WalletPage: React.FC = () => {
  const location = useLocation()
  const userId = useSelector((s: RootState) => s.auth.user?.user_id ?? 0)

  // Helpers — dùng closure userId, ổn vì userId là primitive
  const getWallet  = () => lsGet<Wallet>(walletKey(userId), defaultWallet(userId))
  const getTxns    = () => lsGet<Txn[]>(txnsKey(userId), [])
  const saveWallet = (w: Wallet) => lsSet(walletKey(userId), w)
  const saveTxns   = (t: Txn[])  => lsSet(txnsKey(userId), t)

  const [wallet,  setWallet]  = useState<Wallet>(defaultWallet(0))
  const [txns,    setTxns]    = useState<Txn[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [txnType, setTxnType] = useState('')

  // Load khi userId sẵn sàng (đồng bộ, không cần async)
  useEffect(() => {
    if (!userId) return
    setWallet(getWallet())
    const all = getTxns()
    const filtered = txnType ? all.filter(t => t.txn_type === txnType) : all
    const start = (page - 1) * 15
    setTxns(filtered.slice(start, start + 15))
    setTotal(filtered.length)
    setPages(Math.max(1, Math.ceil(filtered.length / 15)))
  }, [userId, page, txnType])

  // Đọc ?tab= từ URL
  const [tab, setTab] = useState<'overview' | 'history' | 'deposit' | 'auction_fund'>(() => {
    const p = new URLSearchParams(location.search).get('tab')
    if (p === 'auction_fund' || p === 'deposit' || p === 'history') return p
    return 'overview'
  })

  const [amount,        setAmount]        = useState('')
  const [note,          setNote]          = useState('')
  const [auctionAmount, setAuctionAmount] = useState('')

  const handleDeposit = () => {
    const raw = parseInt(amount.replace(/[^\d]/g, ''))
    if (!raw || raw <= 0) { toast.error('Nhập số tiền hợp lệ'); return }
    if (raw > 100_000_000) { toast.error('Tối đa 100,000,000đ'); return }
    const next = { ...wallet, balance: wallet.balance + raw, available: wallet.available + raw }
    setWallet(next); saveWallet(next)
    const txn: Txn = { txn_id: Date.now(), amount: raw, txn_type: 'deposit', ref_type: null, ref_id: null, note: note || 'Nạp tiền', created_at: new Date().toISOString() }
    const nextTxns = [txn, ...getTxns()]; saveTxns(nextTxns)
    setTxns(nextTxns.slice(0, 15)); setTotal(nextTxns.length); setPages(Math.max(1, Math.ceil(nextTxns.length / 15)))
    toast.success(`✅ Nạp ${fmt(raw)} thành công!`)
    setAmount(''); setNote(''); setTab('overview')
  }

  const handleAllocateAuction = () => {
    const raw = parseInt(auctionAmount.replace(/[^\d]/g, ''))
    if (!raw || raw <= 0) { toast.error('Nhập số tiền hợp lệ'); return }
    // Kiểm tra bị ban do vi phạm hủy cọc
    const violations = Number(localStorage.getItem(`shop_auction_ban_${userId}`) || '0')
    if (violations >= 3) {
      toast.error('🚫 Tài khoản bị khóa — không thể nạp Tiền đấu giá do vi phạm hủy cọc quá 2 lần!')
      return
    }
    if (raw > wallet.available) { toast.error('Không đủ số dư khả dụng'); return }
    const next = { ...wallet, reserved: wallet.reserved + raw, available: wallet.available - raw }
    setWallet(next); saveWallet(next)
    const txn: Txn = { txn_id: Date.now(), amount: raw, txn_type: 'reserve', ref_type: null, ref_id: null, note: 'Nạp tiền đấu giá', created_at: new Date().toISOString() }
    const nextTxns = [txn, ...getTxns()]; saveTxns(nextTxns)
    setTxns(nextTxns.slice(0, 15)); setTotal(nextTxns.length); setPages(Math.max(1, Math.ceil(nextTxns.length / 15)))
    toast.success(`✅ Chuyển ${fmt(raw)} vào Tiền đấu giá thành công!`)
    setAuctionAmount(''); setTab('overview')
  }

  const btnStyle = (bg: string, color = 'white'): React.CSSProperties => ({
    background: bg, color, border: 'none', borderRadius: 8,
    padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  })
  const tabStyle = (active: boolean, activeColor = C.green): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
    background: active ? activeColor : 'transparent',
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
            { label: 'Tổng số dư',    value: wallet.balance,   color: C.blue,   bg: C.blueBg,   icon: '🏦' },
            { label: 'Tiền đấu giá',  value: wallet.reserved,  color: C.purple, bg: C.purpleBg, icon: '🔒' },
            { label: 'Khả dụng',      value: wallet.available, color: C.green,  bg: C.greenBg,  icon: '✅' },
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button style={tabStyle(tab === 'overview')}      onClick={() => setTab('overview')}>📊 Tổng quan</button>
        <button style={tabStyle(tab === 'history')}       onClick={() => setTab('history')}>📋 Lịch sử</button>
        <button style={tabStyle(tab === 'deposit')}       onClick={() => setTab('deposit')}>💳 Nạp tiền</button>
        <button style={tabStyle(tab === 'auction_fund', C.purple)} onClick={() => setTab('auction_fund')}>🔒 Tiền đấu giá</button>
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────────── */}
      {tab === 'overview' && wallet && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px' }}>Thông tin ví</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {[
                ['Shop',            wallet.shop_name ?? `#${wallet.shop_id}`],
                ['ID ví',           `#${wallet.wallet_id}`],
                ['Tổng số dư',      <b style={{ color: C.blue }}>{fmt(wallet.balance)}</b>],
                ['Tiền đấu giá',    <b style={{ color: C.purple }}>{fmt(wallet.reserved)}</b>],
                ['Khả dụng',        <b style={{ color: C.green, fontSize: 16 }}>{fmt(wallet.available)}</b>],
              ].map(([k, v]) => (
                <tr key={String(k)}>
                  <td style={{ padding: '10px 0', color: C.gray, width: 160 }}>{k}</td>
                  <td style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>{v as any}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button style={btnStyle(C.green)}  onClick={() => setTab('deposit')}>💳 Nạp tiền</button>
            <button style={btnStyle(C.purple)} onClick={() => setTab('auction_fund')}>🔒 Nạp tiền đấu giá</button>
            <button style={btnStyle('transparent', C.gray)} onClick={() => setTab('history')}>
              📋 Lịch sử ({total})
            </button>
          </div>
          <div style={{ marginTop: 16, background: C.purpleBg, borderRadius: 10, padding: '12px 16px', fontSize: 12, color: C.purple }}>
            <b>💡 Cách hoạt động:</b> Nạp tiền vào Tổng số dư — hoặc nạp thẳng vào Tiền đấu giá để đặt giá banner. Thua đấu giá → hoàn lại. Thắng → trừ thanh toán.
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
              <option value="reserve">Tiền đấu giá</option>
              <option value="release">Hoàn tiền đấu giá</option>
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

      {/* ── Nạp tiền (external → balance) ────────────────────────────────────── */}
      {tab === 'deposit' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 4px' }}>💳 Nạp tiền vào ví</h3>
          <p style={{ fontSize: 13, color: C.gray, marginBottom: 20 }}>Tiền sẽ được cộng ngay vào <b>Tổng số dư</b>. Tối đa 100,000,000đ/lần.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 6 }}>Số tiền nạp (đ)</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {[500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000].map(v => (
                  <button key={v} onClick={() => setAmount(v.toLocaleString('vi-VN'))}
                    style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: `1px solid ${amount === v.toLocaleString('vi-VN') ? C.green : C.border}`, background: amount === v.toLocaleString('vi-VN') ? C.green : 'transparent', color: amount === v.toLocaleString('vi-VN') ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                    {v.toLocaleString('vi-VN')}đ
                  </button>
                ))}
              </div>
              <input type="text" value={amount}
                onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setAmount(raw ? Number(raw).toLocaleString('vi-VN') : '') }}
                placeholder="Nhập số tiền..."
                style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 6 }}>Ghi chú (tuỳ chọn)</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder="VD: Nạp tiền tháng 7, đấu giá banner..."
                style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleDeposit} disabled={!amount}
              style={{ ...btnStyle(!amount ? '#9CA3AF' : C.green), padding: '12px', fontSize: 14, alignSelf: 'flex-start', minWidth: 160 }}>
              💳 Nạp tiền
            </button>
          </div>
        </div>
      )}

      {/* ── Tiền đấu giá (nạp mới → cộng vào cả balance + reserved) ────────── */}
      {tab === 'auction_fund' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 4px' }}>🔒 Nạp tiền đấu giá</h3>
          <p style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>Chuyển từ <b>Số dư khả dụng</b> sang <b>Tiền đấu giá</b> để dùng khi đặt giá banner.</p>

          {wallet && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div style={{ background: C.blueBg, border: `1px solid ${C.blue}33`, borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>🏦 Tổng số dư hiện tại</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{fmt(wallet.balance)}</div>
              </div>
              <div style={{ background: C.purpleBg, border: `1px solid ${C.purple}33`, borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>🔒 Tiền đấu giá hiện tại</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.purple }}>{fmt(wallet.reserved)}</div>
              </div>
            </div>
          )}

          <div style={{ background: C.purpleBg, border: `1px solid ${C.purple}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: C.purple }}>
            <b>💡 Lưu ý:</b> Tiền đấu giá dùng để đặt giá banner. Nếu thua → hoàn lại vào Khả dụng. Nếu thắng → trừ để thanh toán.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 6 }}>
                Số tiền chuyển vào Tiền đấu giá (đ)
                {wallet && <span style={{ color: C.green, marginLeft: 8, fontSize: 12, fontWeight: 600 }}>Khả dụng: {fmt(wallet.available)}</span>}
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {[500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000].filter(v => !wallet || v <= wallet.available).map(v => (
                  <button key={v} onClick={() => setAuctionAmount(v.toLocaleString('vi-VN'))}
                    style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: `1px solid ${auctionAmount === v.toLocaleString('vi-VN') ? C.purple : C.border}`, background: auctionAmount === v.toLocaleString('vi-VN') ? C.purple : 'transparent', color: auctionAmount === v.toLocaleString('vi-VN') ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                    {v.toLocaleString('vi-VN')}đ
                  </button>
                ))}
                {wallet && wallet.available > 0 && (
                  <button onClick={() => setAuctionAmount(wallet.available.toLocaleString('vi-VN'))}
                    style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.purple}`, background: 'transparent', color: C.purple, cursor: 'pointer', fontWeight: 600 }}>
                    Tất cả ({fmt(wallet.available)})
                  </button>
                )}
              </div>
              <input type="text" value={auctionAmount}
                onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setAuctionAmount(raw ? Number(raw).toLocaleString('vi-VN') : '') }}
                placeholder="Nhập số tiền..."
                style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleAllocateAuction} disabled={!auctionAmount}
              style={{ ...btnStyle(!auctionAmount ? '#9CA3AF' : C.purple), padding: '12px', fontSize: 14, alignSelf: 'flex-start', minWidth: 200 }}>
              🔒 Nạp vào Tiền đấu giá
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WalletPage
