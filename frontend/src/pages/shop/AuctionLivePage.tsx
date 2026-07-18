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
  winner_shop_id: number | null
  winner_shop: string | null
  bid_count: number | null
  bids: AuctionBid[]
}
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

// ── Single auction card ───────────────────────────────────────────────────────
const AuctionCard: React.FC<{
  auction: Auction
  wallet: Wallet | null
  myShopId: number | null
  onBidPlaced: (auctionId: number, newAuction: Partial<Auction>) => void
}> = ({ auction, wallet, myShopId, onBidPlaced }) => {
  const ms = useCountdown(auction.end_time)
  const [bidInput, setBidInput] = useState('')
  const [placing, setPlacing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const minBid = auction.current_price + 1000
  const isWinning = myShopId != null && auction.winner_shop_id === myShopId

  const handleBid = async () => {
    const raw = parseInt(bidInput.replace(/[^\d]/g, ''))
    if (!raw || raw < minBid) { toast.error(`Giá tối thiểu là ${fmt(minBid)}`); return }
    if (wallet && raw > wallet.available) { toast.error('Số dư khả dụng không đủ'); return }
    setPlacing(true)
    try {
      const r = await API.post(`/api/v1/banners/auctions/${auction.auction_id}/bid`, { amount: raw })
      toast.success(`✅ Đặt giá ${fmt(raw)} thành công!`)
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
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span style={{ color: C.gray }}>Giá hiện tại: <b style={{ color: C.purple }}>{fmt(auction.current_price)}</b></span>
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
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
const AuctionLivePage: React.FC = () => {
  const [auctions, setAuctions]   = useState<Auction[]>([])
  const [wallet,   setWallet]     = useState<Wallet | null>(null)
  const [myShopId, setMyShopId]   = useState<number | null>(null)
  const [loading,  setLoading]    = useState(true)
  const [status,   setStatus]     = useState<'active' | 'upcoming' | 'all'>('active')
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
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default AuctionLivePage
