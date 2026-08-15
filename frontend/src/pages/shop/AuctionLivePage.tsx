/**
 * AuctionLivePage.tsx — Đấu giá banner real-time (kết nối API + Socket.io)
 * ---------------------------------------------------------------------------
 * GET  /api/v1/banners/auctions?status=active
 * POST /api/v1/banners/auctions/{id}/bid
 * GET  /api/v1/wallet/me  (hiển thị số dư)
 * Socket.io: room "banner_auction", events: banner:bid_update, banner:auction_opened, banner:auction_ended
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'react-toastify'
import { io, Socket } from 'socket.io-client'
import API from '../../services/api'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuctionBid {
  bid_id: number
  auction_id: number
  shop_id: number
  shop_name: string
  amount: number
  status: string
  created_at: string
}
interface Auction {
  auction_id: number
  slot_id: number
  slot_name: string | null
  slot_position: string | null
  start_time: string
  end_time: string
  status: string
  start_price: number
  current_price: number
  end_price: number | null
  winner_shop_id: number | null
  winner_shop: string | null
  win_type: 'buyout' | 'bid' | null
  bid_count: number | null
  bids: AuctionBid[]
  deposit_amount: number | null
  payment_deadline: string | null
  final_paid_at: string | null
  // Nội dung banner nộp sau khi thắng — xem POST /auctions/{id}/submit
  banner_image_url?: string | null
  banner_title?: string | null
  banner_link?: string | null
  banner_status?: 'pending' | 'approved' | 'rejected' | null
  banner_reject_reason?: string | null
  submission_attempts?: number
  review_deadline?: string | null
  activates_at?: string | null
}
const MAX_BANNER_BUYOUT_SUBMISSIONS = 10
const BUYOUT_LOCK_MS = 6 * 3_600_000
interface Wallet {
  balance: number
  reserved: number
  available: number
}

// ── Colors ─────────────────────────────────────────────────────────────────────
const C = {
  purple:   '#7C3AED',
  purpleBg: 'rgba(124,58,237,0.08)',
  green:    '#16A34A',
  greenBg:  'rgba(22,163,74,0.08)',
  orange:   '#EA580C',
  orangeBg: 'rgba(234,88,12,0.08)',
  red:      '#DC2626',
  blue:     '#2563EB',
  gray:     'var(--text-secondary)',
  border:   'var(--border-subtle)',
  card:     'var(--bg-card)',
}

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

function useCountdown(endTime: string) {
  const [ms, setMs] = useState(() => Math.max(0, new Date(endTime).getTime() - Date.now()))
  useEffect(() => {
    const update = () => setMs(Math.max(0, new Date(endTime).getTime() - Date.now()))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [endTime])
  return ms
}

function fmtMs(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ── Nộp ảnh banner sau khi thắng đấu giá ────────────────────────────────────
const BannerSubmitSection: React.FC<{
  auction: Auction
  onSubmitted: (auctionId: number, patch: Partial<Auction>) => void
}> = ({ auction, onSubmitted }) => {
  const [title, setTitle]       = useState(auction.banner_title || '')
  const [link, setLink]         = useState(auction.banner_link || '')
  const [preview, setPreview]   = useState(auction.banner_image_url || '')
  const [file, setFile]         = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [open, setOpen] = useState(!auction.banner_status || auction.banner_status === 'rejected')

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (!file && !auction.banner_image_url) { toast.error('Vui lòng chọn ảnh banner'); return }
    setSubmitting(true)
    try {
      let imageUrl = auction.banner_image_url || ''
      if (file) {
        setUploading(true)
        const fd = new FormData()
        fd.append('file', file)
        const up = await API.post('/api/v1/banners/upload-image', fd, {
          transformRequest: (data, headers) => { if (headers) delete (headers as any)['Content-Type']; return data },
        })
        imageUrl = up.data?.url
        setUploading(false)
      }
      const res = await API.post(`/api/v1/banners/auctions/${auction.auction_id}/submit`, {
        image_url: imageUrl, title, link,
      })
      toast.success('✅ Đã nộp banner — chờ admin duyệt')
      onSubmitted(auction.auction_id, {
        banner_image_url: res.data.banner_image_url,
        banner_title: res.data.banner_title,
        banner_link: res.data.banner_link,
        banner_status: res.data.banner_status,
        banner_reject_reason: res.data.banner_reject_reason,
        submission_attempts: res.data.submission_attempts,
        review_deadline: res.data.review_deadline,
      })
      setOpen(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Nộp banner thất bại')
    } finally {
      setSubmitting(false)
      setUploading(false)
    }
  }

  const statusBadge = () => {
    if (auction.banner_status === 'approved') {
      return auction.activates_at
        ? <span style={{ background: C.greenBg, color: C.green, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>✅ Đã duyệt — lên trang chủ lúc 0:00 ({new Date(auction.activates_at).toLocaleDateString('vi-VN')})</span>
        : <span style={{ background: C.greenBg, color: C.green, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>✅ Đã duyệt</span>
    }
    if (auction.banner_status === 'pending')  return <span style={{ background: C.orangeBg, color: C.orange, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>⏳ Đang chờ admin duyệt</span>
    if (auction.banner_status === 'rejected') return <span style={{ background: '#FEE2E2', color: C.red, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>❌ Bị từ chối{auction.banner_reject_reason ? `: ${auction.banner_reject_reason}` : ''}</span>
    return null
  }

  const isBuyout = auction.win_type === 'buyout'
  const attemptsRemaining = isBuyout ? Math.max(0, MAX_BANNER_BUYOUT_SUBMISSIONS - (auction.submission_attempts || 0)) : null

  return (
    <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, background: C.greenBg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: open ? 12 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: C.green }}>🏆 Bạn đã thắng phiên này</span>
          {statusBadge()}
        </div>
        {(!open && (!auction.banner_status || auction.banner_status === 'rejected')) && attemptsRemaining !== 0 && (
          <button onClick={() => setOpen(true)} style={{ padding: '6px 14px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            📤 Nộp ảnh banner
          </button>
        )}
      </div>

      {isBuyout && auction.banner_status !== 'approved' && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: attemptsRemaining && attemptsRemaining <= 2 ? C.red : C.orange }}>
          ⏳ Còn <b>{attemptsRemaining}/{MAX_BANNER_BUYOUT_SUBMISSIONS}</b> lần nộp trong hạn 6 tiếng kể từ lúc thanh toán — hết hạn hoặc hết lượt sẽ bị huỷ vị trí.
        </p>
      )}

      {open && attemptsRemaining !== 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <label style={{
            width: 140, height: 90, borderRadius: 8, border: `2px dashed ${C.border}`, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
          }}>
            {preview
              ? <img src={preview.startsWith('blob:') || preview.startsWith('http') ? preview : preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 11, color: C.gray, textAlign: 'center' }}>🖼️<br />Chọn ảnh</span>}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 200 }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề banner (tùy chọn)"
              style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="Link khi bấm vào banner (tùy chọn)"
              style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
            <button onClick={handleSubmit} disabled={submitting}
              style={{ alignSelf: 'flex-start', padding: '8px 18px', background: submitting ? '#9CA3AF' : C.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: submitting ? 'default' : 'pointer' }}>
              {uploading ? '⏳ Đang tải ảnh...' : submitting ? '⏳ Đang nộp...' : '✅ Nộp banner'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Trả nốt 80% sau khi thắng thường (win_type='bid') ──────────────────────
const PayRemainingSection: React.FC<{
  auction: Auction
  onPaid: (auctionId: number, patch: Partial<Auction>) => void
}> = ({ auction, onPaid }) => {
  const [paying, setPaying] = useState(false)
  const payMs = useCountdown(auction.payment_deadline || new Date().toISOString())
  const remaining = auction.deposit_amount != null ? auction.current_price - auction.deposit_amount : 0

  const handlePay = async () => {
    setPaying(true)
    try {
      const r = await API.post(`/api/v1/banners/auctions/${auction.auction_id}/pay-remaining`)
      toast.success('✅ Đã thanh toán đủ — giờ hãy nộp ảnh banner')
      onPaid(auction.auction_id, { final_paid_at: r.data.final_paid_at })
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Thanh toán thất bại')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, background: C.orangeBg }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, color: C.orange, fontSize: 14 }}>💰 Cần thanh toán nốt {fmt(remaining)}</p>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.gray }}>
        Đã cọc {fmt(auction.deposit_amount || 0)} (20%) ngay khi thắng. Còn <b style={{ color: C.red }}>{fmtMs(payMs)}</b> để trả nốt 80%
        — trễ hạn sẽ mất trắng luôn phần này (không thả tiền lại), tính 1 lần vi phạm (đủ 3 lần bị khoá đấu giá).
      </p>
      <button onClick={handlePay} disabled={paying || payMs === 0}
        style={{ background: paying || payMs === 0 ? '#9CA3AF' : C.orange, color: 'white', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: paying || payMs === 0 ? 'default' : 'pointer' }}>
        {paying ? '⏳...' : `✅ Thanh toán ${fmt(remaining)}`}
      </button>
    </div>
  )
}

// ── Single auction card ───────────────────────────────────────────────────────
const AuctionCard: React.FC<{
  auction: Auction
  wallet: Wallet | null
  myShopId: number | null
  onBidPlaced: (auctionId: number, newAuction: Partial<Auction>) => void
  onBannerUpdated: (auctionId: number, patch: Partial<Auction>) => void
}> = ({ auction, wallet, myShopId, onBidPlaced, onBannerUpdated }) => {
  const ms = useCountdown(auction.end_time)
  const [bidInput, setBidInput] = useState('')
  const [placing, setPlacing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const minBid = auction.current_price + 1000
  const isWinning = myShopId != null && auction.winner_shop_id === myShopId
  const buyoutLocked = auction.status === 'active' && auction.end_price != null && ms > 0 && ms < BUYOUT_LOCK_MS

  const handleBid = async () => {
    const raw = parseInt(bidInput.replace(/[^\d]/g, ''))
    if (!raw || raw < minBid) { toast.error(`Giá tối thiểu là ${fmt(minBid)}`); return }
    if (wallet && raw > wallet.available) { toast.error('Số dư khả dụng không đủ'); return }
    setPlacing(true)
    try {
      const r = await API.post(`/api/v1/banners/auctions/${auction.auction_id}/bid`, { amount: raw })
      if (r.data.buyout) toast.success('🎉 Bạn đã MUA ĐỨT vị trí banner này!')
      else if (r.data.buyout_locked) toast.success(`✅ Đặt giá ${fmt(raw)} thành công! (Đã đạt endPrice nhưng đang trong 6h khoá mua đứt nên chỉ tính là 1 bid thường)`)
      else toast.success(`✅ Đặt giá ${fmt(raw)} thành công!`)
      setBidInput('')
      onBidPlaced(auction.auction_id, { current_price: raw, winner_shop_id: myShopId ?? undefined as any, winner_shop: '(bạn)' })
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Không thể đặt giá'
      toast.error(msg)
    } finally {
      setPlacing(false)
    }
  }

  const isUrgent = ms < 5 * 60_000 && ms > 0
  const timerColor = ms === 0 ? C.gray : isUrgent ? C.red : C.purple

  return (
    <div style={{
      background: C.card, border: `1px solid ${isWinning ? C.green : C.border}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: isWinning ? `0 0 0 2px ${C.green}44` : undefined,
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{auction.slot_name || `Slot #${auction.slot_id}`}</span>
            {isWinning && <span style={{ background: C.greenBg, color: C.green, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>👑 Đang dẫn đầu</span>}
            <span style={{ background: C.purpleBg, color: C.purple, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{auction.slot_position}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
            <span style={{ color: C.gray }}>Giá hiện tại: <b style={{ color: C.purple }}>{fmt(auction.current_price)}</b></span>
            {auction.end_price != null && <span style={{ color: C.gray }}>endPrice (mua đứt): <b>{fmt(auction.end_price)}</b></span>}
            {auction.winner_shop && <span style={{ color: C.gray }}>Đang dẫn: <b>{auction.winner_shop}</b></span>}
          </div>
        </div>

        {/* Countdown */}
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: timerColor, fontVariantNumeric: 'tabular-nums' }}>
            {ms === 0 ? 'Đã kết thúc' : (isUrgent ? '🔥 ' : '⏱ ') + fmtMs(ms)}
          </div>
          <div style={{ fontSize: 11, color: C.gray }}>
            {ms > 0 ? 'còn lại' : `Kết thúc ${new Date(auction.end_time).toLocaleString('vi-VN')}`}
          </div>
        </div>
      </div>

      {/* Bid form */}
      {ms > 0 && (
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          {buyoutLocked && (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: C.orange, background: C.orangeBg, borderRadius: 8, padding: '8px 12px' }}>
              🔒 Đang trong 6 tiếng cuối trước khi kết thúc — mua đứt (đạt endPrice) bị khoá, mọi mức giá chỉ tính là bid thường.
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Quick amounts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {[0, 5_000, 10_000, 50_000, 100_000].map(extra => {
                const val = minBid + extra
                const formatted = val.toLocaleString('vi-VN')
                return (
                  <button key={extra} onClick={() => setBidInput(formatted)}
                    style={{ padding: '4px 9px', fontSize: 11, borderRadius: 6, border: `1px solid ${bidInput === formatted ? C.purple : C.border}`, background: bidInput === formatted ? C.purple : 'transparent', color: bidInput === formatted ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                    {extra === 0 ? 'Tối thiểu' : `+${(extra/1000).toFixed(0)}k`}
                    <br /><span style={{ opacity: 0.75 }}>{val.toLocaleString('vi-VN')}đ</span>
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              value={bidInput}
              onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setBidInput(raw ? Number(raw).toLocaleString('vi-VN') : '') }}
              placeholder={`Tối thiểu ${fmt(minBid)}`}
              style={{ padding: '9px 13px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' }}
            />
            {wallet && (
              <div style={{ fontSize: 12, color: C.gray }}>
                Số dư khả dụng: <b style={{ color: C.green }}>{fmt(wallet.available)}</b>
              </div>
            )}
          </div>
          <button
            onClick={handleBid}
            disabled={placing || !bidInput}
            style={{ background: placing || !bidInput ? '#9CA3AF' : C.purple, color: 'white', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: placing || !bidInput ? 'default' : 'pointer', flexShrink: 0, alignSelf: 'flex-end' }}>
            {placing ? '⏳ Đang đặt...' : '🏹 Đặt giá'}
          </button>
          </div>
        </div>
      )}

      {/* Bid list (collapsible) */}
      <div style={{ padding: '10px 20px' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.purple, fontSize: 12, fontWeight: 600, padding: 0 }}>
          {expanded ? '▲' : '▼'} {auction.bids?.length ?? 0} lượt đặt giá
        </button>
        {expanded && (
          <div style={{ marginTop: 10, maxHeight: 240, overflowY: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
            {(auction.bids ?? []).length === 0 ? (
              <p style={{ padding: 14, color: C.gray, fontSize: 13, textAlign: 'center' }}>Chưa có ai đặt giá.</p>
            ) : (
              auction.bids.map((bid, i) => (
                <div key={bid.bid_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 14px', borderBottom: `1px solid ${C.border}`,
                  background: i === 0 ? C.purpleBg : bid.shop_id === myShopId ? C.greenBg : 'transparent',
                }}>
                  <span style={{ fontSize: 13 }}>
                    {i === 0 && '👑 '}
                    {bid.shop_name}
                    {bid.shop_id === myShopId && <span style={{ background: C.greenBg, color: C.green, borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>Bạn</span>}
                    <span style={{ fontSize: 11, color: C.gray, marginLeft: 6 }}>({bid.status})</span>
                  </span>
                  <span style={{ fontWeight: 700, color: i === 0 ? C.purple : undefined }}>{fmt(bid.amount)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Cần trả nốt 80% (chỉ win_type='bid' — buyout đã trả đủ 100% ngay) */}
      {isWinning && auction.status === 'ended' && auction.win_type === 'bid' && !auction.final_paid_at && (
        <PayRemainingSection auction={auction} onPaid={onBannerUpdated} />
      )}

      {/* Bị huỷ do quá hạn / hết lượt nộp */}
      {auction.status === 'forfeited' && (
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, background: '#FEE2E2' }}>
          <p style={{ margin: 0, fontWeight: 700, color: C.red, fontSize: 13 }}>
            {auction.win_type === 'buyout'
              ? `❌ Phiên đã bị huỷ do quá hạn 6 tiếng nộp/duyệt nội dung (hoặc hết ${MAX_BANNER_BUYOUT_SUBMISSIONS} lần nộp) — tiền mua đứt không được hoàn lại.`
              : '❌ Phiên đã bị huỷ do quá hạn thanh toán 30 phút — tiền đã giữ không được hoàn lại.'}
          </p>
        </div>
      )}

      {/* Nộp ảnh banner — chỉ hiện khi đã trả đủ tiền và bạn là người thắng */}
      {auction.status === 'ended' && isWinning && auction.final_paid_at && (
        <BannerSubmitSection auction={auction} onSubmitted={onBannerUpdated} />
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
const AuctionLivePage: React.FC = () => {
  const [auctions, setAuctions]   = useState<Auction[]>([])
  const [wallet,   setWallet]     = useState<Wallet | null>(null)
  const [myShopId, setMyShopId]   = useState<number | null>(null)
  const [loading,  setLoading]    = useState(true)
  const [status,   setStatus]     = useState<'active' | 'upcoming' | 'ended' | 'all'>('active')
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadAuctions = useCallback(async (s = status) => {
    try {
      const r = await API.get('/api/v1/banners/auctions', { params: { status: s } })
      setAuctions(r.data.auctions)
    } catch { /* ignore */ }
  }, [status])

  const loadWallet = useCallback(async () => {
    try {
      const r = await API.get('/api/v1/wallet/me')
      setWallet(r.data)
      setMyShopId(r.data.shop_id)
    } catch { /* not a shop owner — silently skip */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadAuctions(status), loadWallet()]).finally(() => setLoading(false))
  }, [status])

  // ── Socket.io ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const sock = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    })
    socketRef.current = sock

    sock.on('connect', () => {
      setConnected(true)
      sock.emit('banner_join', {})
    })
    sock.on('disconnect', () => setConnected(false))
    sock.on('connect_error', () => setConnected(false))

    // Real-time bid update
    sock.on('banner:bid_update', (data: {
      auction_id: number; shop_id: number; shop_name: string; amount: number; current_price: number; timestamp: string; bid_id: number
    }) => {
      setAuctions(prev => prev.map(a => {
        if (a.auction_id !== data.auction_id) return a
        // Thêm bid mới vào đầu list, update giá
        const newBid: AuctionBid = {
          bid_id: data.bid_id,
          auction_id: data.auction_id,
          shop_id: data.shop_id,
          shop_name: data.shop_name,
          amount: data.amount,
          status: 'active',
          created_at: data.timestamp,
        }
        const bids = [newBid, ...a.bids.map(b => b.shop_id === data.shop_id && b.status === 'active' ? { ...b, status: 'outbid' } : b)]
        return { ...a, current_price: data.current_price, winner_shop_id: data.shop_id, winner_shop: data.shop_name, bids }
      }))

      // Reload ví để cập nhật số dư
      if (data.shop_id === myShopId) {
        loadWallet()
      }

      toast.info(`📢 ${data.shop_name} vừa đặt ${fmt(data.amount)}`, { autoClose: 2500 })
    })

    // New auction opened
    sock.on('banner:auction_opened', (data: { auction_id: number; slot_name: string; end_time: string }) => {
      toast.success(`🆕 Phiên đấu giá mới: ${data.slot_name}`, { autoClose: 4000 })
      loadAuctions(status)
    })

    // Auction ended
    sock.on('banner:auction_ended', (data: { auction_id: number; winner_shop_id: number; final_price: number }) => {
      toast.info(`🏁 Phiên #${data.auction_id} đã kết thúc`, { autoClose: 4000 })
      setAuctions(prev => prev.map(a =>
        a.auction_id === data.auction_id ? { ...a, status: 'ended' } : a
      ))
    })

    return () => {
      sock.emit('banner_leave', {})
      sock.disconnect()
      socketRef.current = null
    }
  }, [myShopId, status])

  // ── Bid placed callback ─────────────────────────────────────────────────────
  const handleBidPlaced = useCallback((auctionId: number, _partial: Partial<Auction>) => {
    // Reload cả ví lẫn auction detail để đồng bộ
    loadWallet()
    // socket sẽ tự cập nhật state qua banner:bid_update
  }, [loadWallet])

  // ── Banner submitted callback ───────────────────────────────────────────────
  const handleBannerUpdated = useCallback((auctionId: number, patch: Partial<Auction>) => {
    setAuctions(prev => prev.map(a => a.auction_id === auctionId ? { ...a, ...patch } : a))
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────
  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px', borderRadius: 8, border: `1px solid ${active ? C.purple : C.border}`,
    background: active ? C.purple : 'transparent', color: active ? 'white' : C.gray,
    cursor: 'pointer', fontWeight: 600, fontSize: 13,
  })

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>🎯 Đấu giá Banner Real-time</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: connected ? C.green : C.gray }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? C.green : '#9CA3AF', display: 'inline-block' }} />
          {connected ? 'Đang kết nối live' : 'Ngoại tuyến'}
        </div>
      </div>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 16 }}>
        Đặt giá để shop của bạn xuất hiện ở vị trí banner. Kết quả cập nhật real-time.
      </p>

      {/* Wallet summary */}
      {wallet && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { l: 'Số dư khả dụng', v: wallet.available, c: C.green },
            { l: 'Đang giữ',       v: wallet.reserved,  c: C.orange },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ background: 'rgba(0,0,0,0.03)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.gray }}>{l}:</span>
              <span style={{ fontWeight: 700, color: c }}>{fmt(v)}</span>
            </div>
          ))}
          <a href="/shop/wallet" style={{ background: C.purpleBg, border: `1px solid ${C.purple}33`, borderRadius: 10, padding: '10px 16px', color: C.purple, fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            💳 Nạp tiền
          </a>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={btnStyle(status === 'active')}   onClick={() => setStatus('active')}>🟢 Đang mở</button>
        <button style={btnStyle(status === 'upcoming')} onClick={() => setStatus('upcoming')}>⏳ Sắp mở</button>
        <button style={btnStyle(status === 'ended')}    onClick={() => setStatus('ended')}>🏁 Đã kết thúc</button>
        <button style={btnStyle(status === 'all')}      onClick={() => setStatus('all')}>📋 Tất cả</button>
        <button onClick={() => loadAuctions(status)}
          style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.gray, cursor: 'pointer', fontSize: 12 }}>
          🔄 Làm mới
        </button>
      </div>

      {/* Auction list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.gray }}>Đang tải...</div>
      ) : auctions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
          <p style={{ color: C.gray }}>
            {status === 'active' ? 'Không có phiên đấu giá nào đang mở.' : 'Chưa có phiên đấu giá nào.'}
          </p>
          <p style={{ fontSize: 12, color: C.gray }}>Admin sẽ mở phiên sớm — hãy quay lại sau.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {auctions.map(a => (
            <AuctionCard
              key={a.auction_id}
              auction={a}
              wallet={wallet}
              myShopId={myShopId}
              onBidPlaced={handleBidPlaced}
              onBannerUpdated={handleBannerUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default AuctionLivePage
