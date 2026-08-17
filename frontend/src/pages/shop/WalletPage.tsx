/**
 * WalletPage.tsx — Ví tiền shop (kết nối API thật)
 * --------------------------------------------------
 * GET  /api/v1/wallet/me
 * GET  /api/v1/wallet/transactions
 * POST /api/v1/wallet/deposit/start           (→ mở trang QR nạp tiền demo)
 * POST /api/v1/wallet/allocate-auction        (chuyển Khả dụng → Tiền đấu giá, tức thời)
 *
 * Nạp tiền là hệ thống DEMO — không có tiền thật, không qua admin duyệt.
 * Chọn phương thức → mở trang QR/giả lập thanh toán (giống lúc thanh toán
 * đơn hàng) → "giả bộ thanh toán xong" → tự đóng trang, quay lại đây, tiền
 * tự động cộng vào Số dư khả dụng.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { walletService } from '../../services/walletService'
import { PAYMENT_PROVIDERS, type PaymentProvider } from '../../utils/paymentProviders'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Wallet {
  wallet_id: number
  shop_id: number
  shop_name: string | null
  balance: number
  reserved: number
  auction_fund: number
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
  deposit:          { label: 'Nạp tiền',                       color: C.green,  prefix: '+' },
  deposit_pending:  { label: 'Đang chờ xác nhận (demo)',       color: C.orange, prefix: '' },
  deposit_rejected: { label: 'Hết hạn / đã huỷ',                color: C.red,    prefix: '' },
  withdraw:         { label: 'Rút tiền',                        color: C.red,    prefix: '-' },
  reserve:          { label: 'Giữ tiền cho phiên đấu giá',      color: C.orange, prefix: '-' },
  release:          { label: 'Hoàn tiền (thua đấu giá)',        color: C.blue,   prefix: '+' },
  charge:           { label: 'Thanh toán thắng đấu giá',        color: C.red,    prefix: '-' },
  refund:           { label: 'Hoàn tiền',                       color: C.green,  prefix: '+' },
  allocate_auction: { label: 'Chuyển vào Tiền đấu giá',         color: C.purple, prefix: '' },
}

function fmt(n: number) { return Number(n || 0).toLocaleString('vi-VN') + 'đ' }
function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const PROVIDERS: PaymentProvider[] = ['momo', 'vnpay', 'zalopay']

const WalletPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const [wallet,  setWallet]  = useState<Wallet | null>(null)
  const [txns,    setTxns]    = useState<Txn[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [txnType, setTxnType] = useState('')
  const [loading, setLoading] = useState(true)

  const loadWallet = useCallback(async () => {
    try {
      const r = await walletService.getWallet()
      setWallet(r.data)
    } catch { /* ignore */ }
  }, [])

  const loadTxns = useCallback(async () => {
    try {
      const r = await walletService.getTransactions({ page, limit: 15, txn_type: txnType || undefined })
      setTxns(r.data.transactions)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch { /* ignore */ }
  }, [page, txnType])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadWallet(), loadTxns()]).finally(() => setLoading(false))
  }, [loadWallet, loadTxns])

  // Quay về từ trang QR nạp tiền sau khi thành công (?deposited=1)
  useEffect(() => {
    if (new URLSearchParams(location.search).get('deposited') === '1') {
      toast.success('✅ Nạp tiền thành công — số dư đã được cập nhật!')
      loadWallet()
      navigate('/shop/wallet', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Đọc ?tab= từ URL
  const [tab, setTab] = useState<'overview' | 'history' | 'deposit' | 'auction_fund'>(() => {
    const p = new URLSearchParams(location.search).get('tab')
    if (p === 'auction_fund' || p === 'deposit' || p === 'history') return p
    return 'overview'
  })

  const [amount,        setAmount]        = useState('')
  const [note,          setNote]          = useState('')
  const [auctionAmount, setAuctionAmount] = useState('')
  const [starting,      setStarting]      = useState<PaymentProvider | null>(null)
  const [allocating,    setAllocating]    = useState(false)

  const handleStartDeposit = async (provider: PaymentProvider) => {
    const raw = parseInt(amount.replace(/[^\d]/g, ''))
    if (!raw || raw <= 0) { toast.error('Nhập số tiền hợp lệ'); return }
    if (raw > 100_000_000) { toast.error('Tối đa 100,000,000đ'); return }
    setStarting(provider)
    try {
      const r = await walletService.startDeposit(raw, note)
      navigate(`/shop/wallet-deposit/${provider}/${r.data.txn_id}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Không tạo được giao dịch nạp tiền')
    } finally {
      setStarting(null)
    }
  }

  const handleAllocateAuction = async () => {
    const raw = parseInt(auctionAmount.replace(/[^\d]/g, ''))
    if (!raw || raw <= 0) { toast.error('Nhập số tiền hợp lệ'); return }
    if (wallet && raw > wallet.available) { toast.error('Không đủ số dư khả dụng'); return }
    setAllocating(true)
    try {
      await walletService.allocateAuction(raw)
      toast.success(`✅ Đã chuyển ${fmt(raw)} vào Tiền đấu giá!`)
      setAuctionAmount('')
      await Promise.all([loadWallet(), loadTxns()])
      setTab('overview')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Chuyển tiền thất bại')
    } finally {
      setAllocating(false)
    }
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

  if (loading && !wallet) return <div style={{ textAlign: 'center', padding: 60, color: C.gray }}>Đang tải...</div>

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ marginBottom: 4 }}>💰 Ví tiền shop</h2>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>
        Quản lý số dư để tham gia đấu giá banner / vị trí sản phẩm. <i>Hệ thống demo — không có tiền thật.</i>
      </p>

      {/* ── Balance cards ────────────────────────────────────────────────────── */}
      {wallet && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Tổng số dư',                value: wallet.balance,      color: C.blue,   bg: C.blueBg,   icon: '🏦' },
            { label: 'Đang giữ (phiên đang chạy)', value: wallet.reserved,     color: C.orange, bg: C.orangeBg, icon: '⏳' },
            { label: 'Tiền đấu giá (đã đánh dấu)', value: wallet.auction_fund, color: C.purple, bg: C.purpleBg, icon: '🔒' },
            { label: 'Khả dụng',                   value: wallet.available,   color: C.green,  bg: C.greenBg,  icon: '✅' },
          ].map(({ label, value, color, bg, icon }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 12, padding: '14px 14px' }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 10.5, color: C.gray, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color }}>{fmt(value)}</div>
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
                ['Shop',                          wallet.shop_name ?? `#${wallet.shop_id}`],
                ['ID ví',                         `#${wallet.wallet_id}`],
                ['Tổng số dư',                     <b style={{ color: C.blue }}>{fmt(wallet.balance)}</b>],
                ['Đang giữ cho phiên đang chạy',   <b style={{ color: C.orange }}>{fmt(wallet.reserved)}</b>],
                ['Tiền đấu giá (đã đánh dấu)',      <b style={{ color: C.purple }}>{fmt(wallet.auction_fund)}</b>],
                ['Khả dụng (dùng để đặt giá)',      <b style={{ color: C.green, fontSize: 16 }}>{fmt(wallet.available)}</b>],
              ].map(([k, v]) => (
                <tr key={String(k)}>
                  <td style={{ padding: '10px 0', color: C.gray, width: 220 }}>{k}</td>
                  <td style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>{v as any}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={btnStyle(C.green)}  onClick={() => setTab('deposit')}>💳 Nạp tiền</button>
            <button style={btnStyle(C.purple)} onClick={() => setTab('auction_fund')}>🔒 Chuyển vào Tiền đấu giá</button>
            <button style={btnStyle('transparent', C.gray)} onClick={() => setTab('history')}>
              📋 Lịch sử ({total})
            </button>
          </div>
          <div style={{ marginTop: 16, background: C.blueBg, borderRadius: 10, padding: '12px 16px', fontSize: 12, color: C.blue }}>
            <b>💡 Cách hoạt động:</b> Nạp tiền cộng vào Tổng số dư. Khi đặt giá, hệ thống tự giữ tiền trong "Đang giữ cho phiên đang chạy" — thua thì tự hoàn lại, thắng thì trừ thanh toán. "Tiền đấu giá" chỉ là nhãn bạn tự đánh dấu để dễ theo dõi, không ảnh hưởng khả năng đặt giá — Khả dụng vẫn dùng để đặt giá bình thường.
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
              <option value="deposit_pending">Đang chờ xác nhận</option>
              <option value="allocate_auction">Chuyển vào Tiền đấu giá</option>
              <option value="reserve">Giữ tiền cho phiên đấu giá</option>
              <option value="release">Hoàn tiền (thua)</option>
              <option value="charge">Thanh toán (thắng)</option>
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

      {/* ── Nạp tiền (demo — chọn phương thức → mở trang QR) ────────────────── */}
      {tab === 'deposit' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 4px' }}>💳 Nạp tiền vào ví</h3>
          <p style={{ fontSize: 13, color: C.gray, marginBottom: 20 }}>
            Tiền sẽ được cộng vào <b>Tổng số dư</b> sau khi "giả bộ thanh toán xong" ở trang tiếp theo. Tối đa 100,000,000đ/lần.
          </p>

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

            <div>
              <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 8 }}>Chọn phương thức nạp tiền</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {PROVIDERS.map(p => {
                  const cfg = PAYMENT_PROVIDERS[p]
                  const isStarting = starting === p
                  return (
                    <button key={p} onClick={() => handleStartDeposit(p)} disabled={!amount || starting !== null}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderRadius: 10,
                        border: `1.5px solid ${cfg.color}`, background: !amount ? '#F3F4F6' : 'white',
                        color: cfg.color, fontWeight: 700, fontSize: 14, cursor: !amount || starting !== null ? 'default' : 'pointer',
                        opacity: !amount ? 0.5 : 1, minWidth: 140,
                      }}>
                      <span style={{ width: 26, height: 26, borderRadius: 7, background: cfg.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{cfg.name[0]}</span>
                      {isStarting ? 'Đang mở...' : cfg.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tiền đấu giá (nhãn tự đánh dấu — tức thời, không qua admin) ─────── */}
      {tab === 'auction_fund' && wallet && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 4px' }}>🔒 Chuyển vào Tiền đấu giá</h3>
          <p style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>
            Đánh dấu 1 phần <b>Số dư khả dụng</b> là "dành riêng cho đấu giá" để dễ theo dõi — chuyển ngay lập tức, không cần ai duyệt. Đây chỉ là nhãn ghi chú, <b>không khoá tiền khỏi việc đặt giá</b>: Số dư khả dụng vẫn dùng để đặt giá bình thường dù đã đánh dấu hay chưa.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div style={{ background: C.greenBg, border: `1px solid ${C.green}33`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>✅ Số dư khả dụng hiện tại</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmt(wallet.available)}</div>
            </div>
            <div style={{ background: C.purpleBg, border: `1px solid ${C.purple}33`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>🔒 Tiền đấu giá hiện tại</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.purple }}>{fmt(wallet.auction_fund)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 6 }}>
                Số tiền chuyển vào Tiền đấu giá (đ)
                <span style={{ color: C.green, marginLeft: 8, fontSize: 12, fontWeight: 600 }}>Khả dụng: {fmt(wallet.available)}</span>
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {[500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000].filter(v => v <= wallet.available).map(v => (
                  <button key={v} onClick={() => setAuctionAmount(v.toLocaleString('vi-VN'))}
                    style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: `1px solid ${auctionAmount === v.toLocaleString('vi-VN') ? C.purple : C.border}`, background: auctionAmount === v.toLocaleString('vi-VN') ? C.purple : 'transparent', color: auctionAmount === v.toLocaleString('vi-VN') ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                    {v.toLocaleString('vi-VN')}đ
                  </button>
                ))}
                {wallet.available > 0 && (
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
            <button onClick={handleAllocateAuction} disabled={!auctionAmount || allocating}
              style={{ ...btnStyle(!auctionAmount || allocating ? '#9CA3AF' : C.purple), padding: '12px', fontSize: 14, alignSelf: 'flex-start', minWidth: 200 }}>
              {allocating ? '⏳ Đang chuyển...' : '🔒 Chuyển vào Tiền đấu giá'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WalletPage
