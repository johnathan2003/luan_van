/**
 * SlotAuctionDetailPage.tsx — Chi tiết 1 phiên đấu giá Flash Sale / Top sản phẩm
 * ---------------------------------------------------------------------------
 * Route: /shop/slot-auctions/:family/:auctionId — đây chính là trang mà
 * action_url trong thông báo "mở phiên đấu giá mới" trỏ tới.
 *
 * GET  /api/v1/slots/{family}/auctions/{id}
 * POST /api/v1/slots/{family}/auctions/{id}/bid
 * POST /api/v1/slots/{family}/auctions/{id}/pay-remaining
 * POST /api/v1/slots/upload-image
 * POST /api/v1/slots/{family}/auctions/{id}/submit
 * GET  /api/v1/wallet/me
 * GET  /api/v1/products?shop_id=&limit=100   (chọn sản phẩm để nộp nội dung)
 */
import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import API from '../../services/api'

interface Bid {
  bid_id: number
  auction_id: number
  shop_id: number
  shop_name: string | null
  amount: number
  product_id: number | null
  product_name: string | null
  created_at: string
}
interface Auction {
  auction_id: number
  slot_id: number
  slot_name: string | null
  slot_preview_image_url: string | null
  announced_at: string | null
  start_time: string
  end_time: string
  image_width: number | null
  image_height: number | null
  image_format: string | null
  content_rules: string | null
  start_price: number
  current_price: number
  end_price: number | null
  status: string
  winner_shop_id: number | null
  winner_shop: string | null
  winner_product_id: number | null
  win_type: string | null
  deposit_amount: number | null
  payment_deadline: string | null
  final_paid_at: string | null
  submission_image_url: string | null
  submission_title: string | null
  submission_link: string | null
  submission_status: string | null
  review_deadline: string | null
  reject_reason: string | null
  activates_at: string | null
  submission_attempts: number
  bids: Bid[]
}
const MAX_BUYOUT_SUBMISSIONS = 3
const BUYOUT_LOCK_MS = 6 * 3_600_000
interface Wallet { balance: number; reserved: number; available: number; shop_id: number }
interface MyProduct { product_id: number; product_name: string; image_urls: string[] | null }

const C = {
  purple: '#7C3AED', purpleBg: 'rgba(124,58,237,0.08)',
  green: '#16A34A', greenBg: 'rgba(22,163,74,0.08)',
  orange: '#EA580C', orangeBg: 'rgba(234,88,12,0.08)',
  red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: 'rgba(37,99,235,0.08)',
  gray: 'var(--text-secondary)', border: 'var(--border-subtle)', card: 'var(--bg-card)',
}
const FAMILY_LABEL: Record<string, string> = { flash: '⚡ Flash Sale', top: '🚀 Top sản phẩm (boost tìm kiếm/danh mục)' }

function fmt(n: number) { return Number(n || 0).toLocaleString('vi-VN') + 'đ' }
function fmtDate(s: string) { return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

function useCountdown(target: string | null) {
  const [ms, setMs] = useState(() => target ? Math.max(0, new Date(target).getTime() - Date.now()) : 0)
  useEffect(() => {
    if (!target) { setMs(0); return }
    const update = () => setMs(Math.max(0, new Date(target).getTime() - Date.now()))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [target])
  return ms
}
function fmtMs(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const SlotAuctionDetailPage: React.FC = () => {
  const { family = 'flash', auctionId } = useParams<{ family: string; auctionId: string }>()
  const navigate = useNavigate()

  const [auction, setAuction] = useState<Auction | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [products, setProducts] = useState<MyProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [bidInput, setBidInput] = useState('')
  const [bidProductId, setBidProductId] = useState<number | ''>('')
  const [placing, setPlacing] = useState(false)
  const [paying, setPaying] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await API.get(`/api/v1/slots/${family}/auctions/${auctionId}`)
      setAuction(r.data)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Không tìm thấy phiên đấu giá')
    }
  }, [family, auctionId])

  const loadWallet = useCallback(async () => {
    try {
      const r = await API.get('/api/v1/wallet/me')
      setWallet(r.data)
      const p = await API.get('/api/v1/products', { params: { shop_id: r.data.shop_id, limit: 100 } })
      setProducts(p.data.products || [])
    } catch { /* not a shop owner */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([load(), loadWallet()]).finally(() => setLoading(false))
  }, [load, loadWallet])

  const endMs = useCountdown(auction?.status === 'active' || auction?.status === 'upcoming' ? auction.end_time : null)
  const payMs = useCountdown(auction?.payment_deadline && !auction.final_paid_at ? auction.payment_deadline : null)
  const reviewMs = useCountdown(auction?.review_deadline && auction.submission_status === 'pending' ? auction.review_deadline : null)

  const myShopId = wallet?.shop_id ?? null
  const isWinner = auction != null && myShopId != null && auction.winner_shop_id === myShopId
  const minBid = auction ? auction.current_price + Math.max(1000, Math.round(auction.current_price * 0.05)) : 0

  // Sản phẩm được chọn ngay từ lần bid đầu tiên — nếu shop mình đã có bid
  // trong phiên này thì lấy product_id từ đó (không cho đổi giữa chừng).
  const myFirstBid = auction && myShopId != null
    ? [...auction.bids].reverse().find(b => b.shop_id === myShopId)
    : undefined
  const myLockedProductId = myFirstBid?.product_id ?? null
  const myLockedProductName = myFirstBid?.product_name ?? null

  // Mua đứt bị khoá trong 6h cuối trước end_time.
  const buyoutLocked = auction?.status === 'active' && auction.end_price != null && endMs > 0 && endMs < BUYOUT_LOCK_MS

  const handleBid = async () => {
    if (!auction) return
    const raw = parseInt(bidInput.replace(/[^\d]/g, ''))
    if (!raw || raw <= auction.current_price) { toast.error(`Giá phải cao hơn ${fmt(auction.current_price)}`); return }
    if (wallet && raw > wallet.available) { toast.error('Số dư khả dụng không đủ'); return }
    const productId = myLockedProductId ?? bidProductId
    if (!productId) { toast.error('Chọn sản phẩm muốn quảng bá trước khi đặt giá'); return }
    setPlacing(true)
    try {
      const r = await API.post(`/api/v1/slots/${family}/auctions/${auctionId}/bid`, { amount: raw, product_id: productId })
      if (r.data.buyout) toast.success('🎉 Bạn đã MUA ĐỨT vị trí này!')
      else if (r.data.buyout_locked) toast.success(`✅ Đặt giá ${fmt(raw)} thành công! (Đã đạt endPrice nhưng đang trong 6h khoá mua đứt nên chỉ tính là 1 bid thường)`)
      else toast.success(`✅ Đặt giá ${fmt(raw)} thành công!`)
      setBidInput('')
      await Promise.all([load(), loadWallet()])
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Không thể đặt giá')
    } finally {
      setPlacing(false)
    }
  }

  const handlePayRemaining = async () => {
    setPaying(true)
    try {
      await API.post(`/api/v1/slots/${family}/auctions/${auctionId}/pay-remaining`)
      toast.success('✅ Đã thanh toán đủ — giờ hãy nộp nội dung bên dưới')
      await Promise.all([load(), loadWallet()])
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Thanh toán thất bại')
    } finally {
      setPaying(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: C.gray }}>Đang tải...</div>
  if (!auction) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <p style={{ color: C.gray }}>Không tìm thấy phiên đấu giá.</p>
      <Link to="/shop/slot-auctions" style={{ color: C.purple }}>← Về danh sách</Link>
    </div>
  )

  const remaining = auction.deposit_amount != null ? auction.current_price - auction.deposit_amount : 0

  return (
    <div style={{ maxWidth: 760 }}>
      <Link to="/shop/slot-auctions" style={{ color: C.gray, fontSize: 12, textDecoration: 'none' }}>← Danh sách phiên đấu giá</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '10px 0 16px' }}>
        <div>
          <span style={{ background: C.purpleBg, color: C.purple, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{FAMILY_LABEL[family]}</span>
          <h2 style={{ margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            {auction.slot_name || `Slot #${auction.slot_id}`}
            {auction.slot_preview_image_url && (
              <button onClick={() => setShowPreview(true)}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 999, padding: '3px 10px', fontSize: 12, color: C.blue, cursor: 'pointer', fontWeight: 600 }}>
                🖼️ Xem vị trí
              </button>
            )}
          </h2>
        </div>
        {isWinner && <span style={{ background: C.greenBg, color: C.green, borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>👑 Bạn đang/đã thắng phiên này</span>}
      </div>

      {/* Quy định nội dung */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13 }}>📋 Quy định nội dung / ảnh</p>
        <div style={{ fontSize: 13, color: C.gray, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(auction.image_width && auction.image_height) && <span>Kích thước ảnh: <b>{auction.image_width}×{auction.image_height}</b>{auction.image_format ? ` · Định dạng: ${auction.image_format}` : ''}</span>}
          <span style={{ whiteSpace: 'pre-wrap' }}>{auction.content_rules || 'Chưa có quy định riêng — vui lòng dùng ảnh sản phẩm rõ ràng, không vi phạm chính sách sàn.'}</span>
        </div>
      </div>

      {/* Giá + thời gian */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: C.gray }}>Giá hiện tại</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.purple }}>{fmt(auction.current_price)}</div>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>Khởi điểm {fmt(auction.start_price)}{auction.end_price != null ? ` · endPrice (mua đứt) ${fmt(auction.end_price)}` : ''}</div>
        </div>
        {(auction.status === 'active' || auction.status === 'upcoming') && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: endMs < 5 * 60_000 ? C.red : C.purple, fontVariantNumeric: 'tabular-nums' }}>
              {auction.status === 'upcoming' ? 'Sắp mở' : (endMs === 0 ? 'Đã kết thúc' : fmtMs(endMs))}
            </div>
            <div style={{ fontSize: 11, color: C.gray }}>{auction.status === 'upcoming' ? `Bắt đầu ${fmtDate(auction.start_time)}` : 'còn lại'}</div>
          </div>
        )}
      </div>

      {/* Đặt giá */}
      {auction.status === 'active' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          {/* Chọn sản phẩm — chỉ 1 lần, khoá lại sau bid đầu tiên */}
          {myLockedProductId ? (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: C.gray }}>
              Sản phẩm quảng bá đã chọn: <b style={{ color: C.purple }}>{myLockedProductName || `#${myLockedProductId}`}</b> (không thể đổi trong phiên này)
            </p>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <select value={bidProductId} onChange={e => setBidProductId(e.target.value ? Number(e.target.value) : '')}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }}>
                <option value="">— Chọn sản phẩm muốn quảng bá trước khi đặt giá —</option>
                {products.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
              </select>
              <p style={{ fontSize: 11, color: C.gray, margin: '4px 0 0' }}>Sản phẩm chọn ở lần bid đầu tiên sẽ được giữ nguyên cho cả phiên.</p>
            </div>
          )}

          {buyoutLocked && (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: C.orange, background: C.orangeBg, borderRadius: 8, padding: '8px 12px' }}>
              🔒 Đang trong 6 tiếng cuối trước khi kết thúc — mua đứt (đạt endPrice) bị khoá, mọi mức giá chỉ tính là bid thường để tránh cắt ngang phiên vào phút chót.
            </p>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {[0, 5, 10, 20].map(pct => {
              const val = Math.round(auction.current_price * (1 + pct / 100) / 1000) * 1000 || minBid
              const formatted = val.toLocaleString('vi-VN')
              return (
                <button key={pct} onClick={() => setBidInput(formatted)}
                  style={{ padding: '4px 9px', fontSize: 11, borderRadius: 6, border: `1px solid ${bidInput === formatted ? C.purple : C.border}`, background: bidInput === formatted ? C.purple : 'transparent', color: bidInput === formatted ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                  {pct === 0 ? 'Giá hiện tại' : `+${pct}%`}<br /><span style={{ opacity: 0.75 }}>{formatted}đ</span>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="text" value={bidInput}
              onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setBidInput(raw ? Number(raw).toLocaleString('vi-VN') : '') }}
              placeholder={auction.end_price != null ? `Cao hơn ${fmt(auction.current_price)}, hoặc ${fmt(auction.end_price)} để mua đứt` : `Cao hơn ${fmt(auction.current_price)}`}
              style={{ flex: 1, padding: '9px 13px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }} />
            <button onClick={handleBid} disabled={placing || !bidInput || (!myLockedProductId && !bidProductId)}
              style={{ background: placing || !bidInput ? '#9CA3AF' : C.purple, color: 'white', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: placing || !bidInput ? 'default' : 'pointer' }}>
              {placing ? '⏳...' : '🏹 Đặt giá'}
            </button>
          </div>
          {wallet && <p style={{ fontSize: 12, color: C.gray, margin: '8px 0 0' }}>Số dư khả dụng: <b style={{ color: C.green }}>{fmt(wallet.available)}</b> — <Link to="/shop/wallet" style={{ color: C.purple }}>Nạp thêm</Link></p>}
          <p style={{ fontSize: 11, color: C.gray, margin: '6px 0 0' }}>Bước giá gợi ý theo bội số 5%, bạn có thể nhập số tự do miễn cao hơn giá hiện tại.</p>
        </div>
      )}

      {/* Cọc 20% + trả nốt 80% */}
      {isWinner && auction.status === 'ended' && auction.win_type === 'bid' && !auction.final_paid_at && (
        <div style={{ background: C.orangeBg, border: `1px solid ${C.orange}44`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, color: C.orange, fontSize: 14 }}>💰 Cần thanh toán nốt {fmt(remaining)}</p>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: C.gray }}>
            Đã cọc {fmt(auction.deposit_amount || 0)} (20%) ngay khi thắng. Còn <b style={{ color: C.red }}>{fmtMs(payMs)}</b> để trả nốt 80%
            — trễ hạn sẽ mất luôn tiền cọc, tính 1 lần vi phạm (đủ 3 lần bị khoá đấu giá).
          </p>
          <button onClick={handlePayRemaining} disabled={paying || payMs === 0}
            style={{ background: paying || payMs === 0 ? '#9CA3AF' : C.orange, color: 'white', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: paying || payMs === 0 ? 'default' : 'pointer' }}>
            {paying ? '⏳...' : `✅ Thanh toán ${fmt(remaining)}`}
          </button>
        </div>
      )}

      {/* Đã bị huỷ do quá hạn */}
      {auction.status === 'forfeited' && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}44`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 700, color: C.red, fontSize: 13 }}>
            {auction.win_type === 'buyout'
              ? `❌ Phiên đã bị huỷ do quá hạn 6 tiếng nộp/duyệt nội dung (hoặc hết ${MAX_BUYOUT_SUBMISSIONS} lần nộp) — tiền mua đứt không được hoàn lại.`
              : '❌ Phiên đã bị huỷ do quá hạn thanh toán 30 phút — tiền cọc không được hoàn lại.'}
          </p>
        </div>
      )}

      {/* Nộp nội dung */}
      {isWinner && auction.final_paid_at && auction.submission_status !== 'approved' && (
        <SubmitContentSection
          family={family} auctionId={Number(auctionId)} auction={auction} onSubmitted={load}
          productName={myLockedProductName || products.find(p => p.product_id === auction.winner_product_id)?.product_name || null}
        />
      )}

      {/* Chờ duyệt */}
      {isWinner && auction.submission_status === 'pending' && (
        <div style={{ background: C.blueBg, border: `1px solid ${C.blue}44`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 700, color: C.blue, fontSize: 13 }}>⏳ Đang chờ admin duyệt — còn {fmtMs(reviewMs)} trong hạn phản hồi 6 tiếng.</p>
        </div>
      )}

      {/* Đã duyệt / đã live */}
      {isWinner && auction.submission_status === 'approved' && (
        <div style={{ background: C.greenBg, border: `1px solid ${C.green}44`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 700, color: C.green, fontSize: 13 }}>
            {auction.status === 'live'
              ? '🎉 Đã lên hệ thống!'
              : `✅ Đã duyệt — sẽ tự động lên hệ thống lúc 0:00 ${auction.activates_at ? `(${fmtDate(auction.activates_at)})` : 'ngày kế tiếp'}.`}
          </p>
          {auction.status === 'live' && (
            <Link to={family === 'flash' ? '/' : `/products/${auction.winner_product_id}`} style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>
              {family === 'flash' ? 'Xem ở khu Flash Sale trang chủ →' : 'Xem sản phẩm →'}
            </Link>
          )}
        </div>
      )}

      {/* Lịch sử đặt giá */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
        <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 13 }}>📜 {auction.bids?.length ?? 0} lượt đặt giá</p>
        {(auction.bids ?? []).length === 0 ? (
          <p style={{ color: C.gray, fontSize: 13 }}>Chưa có ai đặt giá.</p>
        ) : (
          <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {auction.bids.map((b, i) => (
              <div key={b.bid_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${C.border}`, background: i === 0 ? C.purpleBg : b.shop_id === myShopId ? C.greenBg : 'transparent' }}>
                <span style={{ fontSize: 13 }}>
                  {i === 0 && '👑 '}{b.shop_name || `Shop #${b.shop_id}`}
                  {b.shop_id === myShopId && <span style={{ background: C.greenBg, color: C.green, borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>Bạn</span>}
                </span>
                <span style={{ fontWeight: 700, color: i === 0 ? C.purple : undefined }}>{fmt(b.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPreview && auction.slot_preview_image_url && (
        <div onClick={() => setShowPreview(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          <img src={auction.slot_preview_image_url} alt="Hướng dẫn vị trí" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

// ── Nộp nội dung (chỉ còn ảnh — sản phẩm đã chốt từ lúc đặt giá) ─────────────
const SubmitContentSection: React.FC<{
  family: string; auctionId: number; auction: Auction; onSubmitted: () => void; productName: string | null
}> = ({ family, auctionId, auction, onSubmitted, productName }) => {
  const [title, setTitle] = useState(auction.submission_title || '')
  const [link, setLink] = useState(auction.submission_link || '')
  const [preview, setPreview] = useState(auction.submission_image_url || '')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isBuyout = auction.win_type === 'buyout'
  const attemptsRemaining = isBuyout ? Math.max(0, MAX_BUYOUT_SUBMISSIONS - (auction.submission_attempts || 0)) : null

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f)); e.target.value = ''
  }

  const handleSubmit = async () => {
    if (!file && !auction.submission_image_url) { toast.error('Chọn ảnh nội dung'); return }
    setSubmitting(true)
    try {
      let imageUrl = auction.submission_image_url || ''
      if (file) {
        setUploading(true)
        const fd = new FormData()
        fd.append('file', file)
        const up = await API.post('/api/v1/slots/upload-image', fd, {
          transformRequest: (data, headers) => { if (headers) delete (headers as any)['Content-Type']; return data },
        })
        imageUrl = up.data?.url
        setUploading(false)
      }
      await API.post(`/api/v1/slots/${family}/auctions/${auctionId}/submit`, {
        image_url: imageUrl, title, link,
      })
      toast.success('✅ Đã nộp nội dung — chờ admin duyệt trong 6 giờ')
      onSubmitted()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Nộp nội dung thất bại')
    } finally {
      setSubmitting(false); setUploading(false)
    }
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.green}44`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, color: C.green, fontSize: 14 }}>📤 Nộp nội dung quảng bá</p>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: C.gray }}>Sản phẩm: <b style={{ color: C.purple }}>{productName || `#${auction.winner_product_id}`}</b> (đã chốt từ lúc đặt giá)</p>
      {isBuyout && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: attemptsRemaining && attemptsRemaining <= 1 ? C.red : C.orange }}>
          ⏳ Còn <b>{attemptsRemaining}/{MAX_BUYOUT_SUBMISSIONS}</b> lần nộp trong hạn 6 tiếng kể từ lúc thanh toán — hết hạn hoặc hết lượt sẽ bị huỷ vị trí.
        </p>
      )}
      {auction.submission_status === 'rejected' && (
        <p style={{ margin: '0 0 10px', color: C.red, fontSize: 12 }}>❌ Nội dung trước bị từ chối{auction.reject_reason ? `: ${auction.reject_reason}` : ''} — vui lòng nộp lại.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <label style={{ width: 100, height: 100, borderRadius: 8, border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}>
            {preview ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: C.gray, textAlign: 'center' }}>🖼️<br />Chọn ảnh</span>}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề (tùy chọn)" style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="Link khi bấm vào (tùy chọn)" style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
          </div>
        </div>
        <button onClick={handleSubmit} disabled={submitting || attemptsRemaining === 0}
          style={{ alignSelf: 'flex-start', padding: '9px 20px', background: submitting || attemptsRemaining === 0 ? '#9CA3AF' : C.green, color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: submitting || attemptsRemaining === 0 ? 'default' : 'pointer' }}>
          {uploading ? '⏳ Đang tải ảnh...' : submitting ? '⏳ Đang nộp...' : attemptsRemaining === 0 ? 'Hết lượt nộp' : '✅ Nộp nội dung'}
        </button>
      </div>
    </div>
  )
}

export default SlotAuctionDetailPage
