/**
 * 🏆 Đấu giá vị trí Banner & Flash Sale — chỉ Shop được vào đặt giá
 * Shop đặt giá để giành quyền hiển thị banner/sản phẩm của mình ở các vị trí "hot"
 * trên Trang chủ (banner slider đầu trang, banner BuyZo Mall, khu Flash Sale...).
 * Phiên đấu giá có thời hạn, giá cao nhất khi hết giờ sẽ thắng.
 * Toàn bộ là mock/demo — lưu localStorage, chưa có backend thực.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { shopService } from '../../services/shopService'
import {
  BANNER_POSITIONS, BannerPositionKey, BannerAuctionSession,
  getAllActiveSessions, getMinNextBid, placeBid, msUntilEnd, formatCountdown, getHistory, injectFakeBid,
  getPendingWinsForShop, confirmWin, sweepExpiredWins, getShopCooldownRemaining, payWin,
  submitBanner, getSubmissionByHistoryId, BannerSubmission, BANNER_IMAGE_SPECS, ImageSpec,
} from '../../utils/bannerAuctionStore'
import {
  FLASH_SLOTS, FlashSlotKey, FlashAuctionSession,
  getAllActiveSessions as getAllActiveFlashSessions, getMinNextBid as getMinNextFlashBid, placeBid as placeFlashBid,
  msUntilEnd as msUntilFlashEnd, formatCountdown as formatFlashCountdown, getHistory as getFlashHistory, injectFakeBid as injectFakeFlashBid,
  getPendingWinsForShop as getPendingFlashWinsForShop, confirmWin as confirmFlashWin, sweepExpiredWins as sweepExpiredFlashWins,
  getShopCooldownRemaining as getFlashShopCooldownRemaining, payWin as payFlashWin,
  submitFlashProduct, getFlashSubmissionByHistoryId, FlashSubmission, FLASH_IMAGE_SPEC,
} from '../../utils/flashSaleAuctionStore'

// ── Helper kiểm tra ảnh upload (kích thước file + tỉ lệ khung hình) theo spec ─
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = reject
    img.src = dataUrl
  })
}

async function validateImageFile(file: File, spec: ImageSpec): Promise<{ ok: boolean; error?: string; dataUrl?: string }> {
  const sizeKB = file.size / 1024
  if (sizeKB > spec.maxKB) {
    return { ok: false, error: `Ảnh quá lớn (${Math.round(sizeKB).toLocaleString('vi-VN')}KB) — tối đa ${spec.maxKB.toLocaleString('vi-VN')}KB.` }
  }
  const dataUrl = await readFileAsDataUrl(file)
  try {
    const { w, h } = await getImageDims(dataUrl)
    const ratio = w / h
    const diff = Math.abs(ratio - spec.ratio) / spec.ratio
    if (diff > spec.tolerance) {
      return { ok: false, error: `Tỉ lệ ảnh chưa đúng (${w}×${h}px) — yêu cầu tỉ lệ ${spec.ratioLabel} (≈${spec.recommendedW}×${spec.recommendedH}px).` }
    }
  } catch {
    // không đọc được kích thước ảnh thật — vẫn chấp nhận, chỉ kiểm tra dung lượng
  }
  return { ok: true, dataUrl }
}

interface PendingWin {
  type: 'banner' | 'flash'
  session: BannerAuctionSession | FlashAuctionSession
}

const C = { green: '#16A34A', dark: '#14532D', tint: '#F0FDF4', gray: '#64748B', warning: '#D97706', error: '#DC2626' }

// làm tròn số tiền cho đẹp mắt (50k nếu <1tr, 100k nếu lớn hơn)
function niceRound(n: number): number {
  const unit = n < 1_000_000 ? 50_000 : 100_000
  return Math.round(n / unit) * unit
}

// sinh 6 mức giá gợi ý tăng dần dựa theo mức giá tối thiểu kế tiếp (đã tính theo giá các shop khác vừa gọi)
function getSuggestedAmounts(minNext: number): number[] {
  const multipliers = [1, 1.5, 2, 3, 5, 8]
  const amounts: number[] = []
  let prev = 0
  for (const m of multipliers) {
    let amount = niceRound(minNext * m)
    if (amount <= prev) amount = prev + 50_000
    amounts.push(amount)
    prev = amount
  }
  return amounts
}

interface ShopProduct {
  product_id: number
  product_name: string
  price: number
  image_urls?: string[]
}

const BannerAuctionPage: React.FC = () => {
  const [shopName, setShopName] = useState('Shop của tôi')
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [sessions, setSessions] = useState<Partial<Record<BannerPositionKey, BannerAuctionSession>> | null>(null)
  const [flashSessions, setFlashSessions] = useState<Partial<Record<FlashSlotKey, FlashAuctionSession>> | null>(null)
  const [now, setNow] = useState(Date.now())
  const [flashProductInputs, setFlashProductInputs] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'banner' | 'flash' | 'history'>('banner')
  const [pendingWins, setPendingWins] = useState<PendingWin[]>([])
  const [payConfirm, setPayConfirm] = useState<PendingWin | null>(null)
  const [submitTarget, setSubmitTarget] = useState<PendingWin | null>(null)
  const [bannerForm, setBannerForm] = useState<{ title: string; link: string; image: string }>({ title: '', link: '', image: '' })
  const [bannerImgError, setBannerImgError] = useState('')
  const [flashForm, setFlashForm] = useState<{ productName: string; price: string; image: string }>({ productName: '', price: '', image: '' })
  const [flashImgError, setFlashImgError] = useState('')

  useEffect(() => {
    shopService.getMyShop().then(r => setShopName(r.data.shop_name)).catch(() => {})
    shopService.getProducts().then(r => setProducts(r.data.products || [])).catch(() => {})
  }, [])

  const refresh = () => setSessions({ ...getAllActiveSessions() })
  const refreshFlash = () => setFlashSessions({ ...getAllActiveFlashSessions() })
  const refreshPendingWins = () => {
    // tự huỷ các phiên đã thắng nhưng quá hạn thanh toán (1 giờ) — vị trí sẽ tự mở lại phiên đấu giá mới
    const expiredBanner = sweepExpiredWins()
    const expiredFlash = sweepExpiredFlashWins()
    ;[...expiredBanner, ...expiredFlash].forEach(h => {
      if (h.winner?.shopName === shopName) {
        toast.error('⏰ Đã hết hạn thanh toán cho vị trí thắng đấu giá. Kết quả đã bị huỷ và vị trí sẽ được đấu giá lại.')
      }
    })
    const banner: PendingWin[] = getPendingWinsForShop(shopName).map(session => ({ type: 'banner', session }))
    const flash: PendingWin[] = getPendingFlashWinsForShop(shopName).map(session => ({ type: 'flash', session }))
    setPendingWins([...banner, ...flash])
  }

  useEffect(() => {
    refresh()
    refreshFlash()
    refreshPendingWins()
    const t = setInterval(() => { setNow(Date.now()); refresh(); refreshFlash(); refreshPendingWins() }, 1000)
    return () => clearInterval(t)
  }, [shopName])

  // mô phỏng các shop khác đang liên tục gọi giá — cho phiên "chạy chạy" sống động
  useEffect(() => {
    const t = setInterval(() => {
      BANNER_POSITIONS.forEach(def => {
        if (Math.random() < 0.6) injectFakeBid(def.key)
      })
      FLASH_SLOTS.forEach(def => {
        if (Math.random() < 0.6) injectFakeFlashBid(def.key)
      })
      refresh()
      refreshFlash()
    }, 3500)
    return () => clearInterval(t)
  }, [])

  const history = useMemo(() => getHistory(), [tab, now])
  const flashHistory = useMemo(() => getFlashHistory(), [tab, now])

  if (!sessions || !flashSessions) return null

  const handleBid = (position: BannerPositionKey, amount: number) => {
    const result = placeBid(position, shopName, amount, '🔥')
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Đặt giá ${amount.toLocaleString('vi-VN')}đ thành công! Bạn đang dẫn đầu phiên đấu giá này.`)
    refresh()
  }

  const handleFlashBid = (slot: FlashSlotKey, amount: number) => {
    const productId = flashProductInputs[slot]
    const product = products.find(p => String(p.product_id) === productId)
    if (!product) {
      toast.error('Vui lòng chọn sản phẩm muốn đấu giá')
      return
    }
    const result = placeFlashBid(slot, shopName, product.product_name, amount, product.image_urls?.[0])
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Đặt giá ${amount.toLocaleString('vi-VN')}đ thành công! Sản phẩm của bạn đang dẫn đầu phiên đấu giá này.`)
    refreshFlash()
  }

  const handleConfirmWin = (win: PendingWin, accept: boolean) => {
    if (win.type === 'banner') confirmWin(win.session.id, accept)
    else confirmFlashWin(win.session.id, accept)
    toast[accept ? 'success' : 'info'](accept
      ? '✅ Đã xác nhận! Vào tab "Lịch sử phiên" để thanh toán số tiền thắng đấu giá trong vòng 1 giờ.'
      : 'Bạn đã từ chối nhận vị trí thắng đấu giá này.')
    refreshPendingWins()
  }

  const handlePayWin = (type: 'banner' | 'flash', h: BannerAuctionSession | FlashAuctionSession) => {
    const ok = type === 'banner' ? payWin(h.id) : payFlashWin(h.id)
    setPayConfirm(null)
    if (!ok) {
      toast.error('Không thể thanh toán — phiên đã quá hạn hoặc không còn hợp lệ.')
      refreshPendingWins()
      return
    }
    toast.success(`💰 Thanh toán ${h.winner!.amount.toLocaleString('vi-VN')}đ thành công! Vị trí sẽ được lên lịch hiển thị.`)
    refresh()
    refreshFlash()
    refreshPendingWins()
  }

  const openSubmitModal = (type: 'banner' | 'flash', h: BannerAuctionSession | FlashAuctionSession) => {
    if (type === 'banner') {
      setBannerForm({ title: '', link: '', image: '' })
      setBannerImgError('')
    } else {
      const winner = (h as FlashAuctionSession).winner
      setFlashForm({ productName: winner?.productName || '', price: '', image: '' })
      setFlashImgError('')
    }
    setSubmitTarget({ type, session: h })
  }

  const handleBannerImageFile = async (file: File) => {
    if (!submitTarget) return
    const position = (submitTarget.session as BannerAuctionSession).position
    const spec = BANNER_IMAGE_SPECS[position]
    const result = await validateImageFile(file, spec)
    if (!result.ok) {
      setBannerImgError(result.error || 'Ảnh không hợp lệ.')
      return
    }
    setBannerImgError('')
    setBannerForm(f => ({ ...f, image: result.dataUrl! }))
  }

  const handleFlashImageFile = async (file: File) => {
    const result = await validateImageFile(file, FLASH_IMAGE_SPEC)
    if (!result.ok) {
      setFlashImgError(result.error || 'Ảnh không hợp lệ.')
      return
    }
    setFlashImgError('')
    setFlashForm(f => ({ ...f, image: result.dataUrl! }))
  }

  const handleSubmitBanner = () => {
    if (!submitTarget) return
    if (!bannerForm.title.trim() || !bannerForm.image) {
      toast.error('Vui lòng nhập tiêu đề và chọn hình ảnh banner đúng yêu cầu.')
      return
    }
    if (bannerImgError) {
      toast.error(bannerImgError)
      return
    }
    const result = submitBanner(submitTarget.session.id, { title: bannerForm.title.trim(), link: bannerForm.link.trim() || undefined, image: bannerForm.image })
    if (!result) {
      toast.error('Không thể đăng banner — vui lòng thử lại.')
      return
    }
    toast.success('📢 Đã gửi banner cho Admin duyệt!')
    setSubmitTarget(null)
    refresh()
  }

  const handleSubmitFlash = () => {
    if (!submitTarget) return
    const priceNum = Number(flashForm.price.replace(/[^\d]/g, ''))
    if (!flashForm.productName.trim() || !priceNum || priceNum <= 0 || !flashForm.image) {
      toast.error('Vui lòng nhập đầy đủ tên sản phẩm, giá tiền và hình ảnh đúng yêu cầu.')
      return
    }
    if (flashImgError) {
      toast.error(flashImgError)
      return
    }
    const result = submitFlashProduct(submitTarget.session.id, {
      productName: flashForm.productName.trim(),
      price: priceNum,
      productImage: flashForm.image,
    })
    if (!result) {
      toast.error('Không thể đăng sản phẩm — vui lòng thử lại.')
      return
    }
    toast.success('📦 Đã gửi sản phẩm cho Admin duyệt!')
    setSubmitTarget(null)
    refreshFlash()
  }

  // hiển thị trạng thái xác nhận/thanh toán cho 1 dòng lịch sử — kèm nút "Thanh toán" nếu là shop thắng và đã xác nhận điều khoản
  const renderPaymentCell = (h: BannerAuctionSession | FlashAuctionSession, type: 'banner' | 'flash') => {
    if (!h.winner) return <span style={{ color: C.gray }}>—</span>
    const isMine = h.winner.shopName === shopName
    if (h.confirmation === 'paid') {
      if (!isMine) return <span className="badge badge-success">Đã thanh toán</span>
      const submission = type === 'banner' ? getSubmissionByHistoryId(h.id) : getFlashSubmissionByHistoryId(h.id)
      const postLabel = type === 'banner' ? '📢 Đăng banner' : '📦 Đăng sản phẩm'
      if (!submission || submission.status === 'rejected') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {submission?.status === 'rejected' && (
              <span style={{ fontSize: 11, color: C.error }}>❌ Bị từ chối{submission.rejectReason ? `: ${submission.rejectReason}` : ''}</span>
            )}
            <button onClick={() => openSubmitModal(type, h)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#1D4ED8', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {submission?.status === 'rejected' ? `🔁 Đăng lại` : postLabel}
            </button>
          </div>
        )
      }
      if (submission.status === 'pending') {
        return <span className="badge badge-warning">Đã đăng — chờ duyệt</span>
      }
      return <span className="badge badge-success">✅ Đã duyệt</span>
    }
    if (h.confirmation === 'confirmed') {
      if (isMine) {
        return (
          <button onClick={() => setPayConfirm({ type, session: h })}
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: C.green, color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            💳 Thanh toán {h.winner.amount.toLocaleString('vi-VN')}đ
          </button>
        )
      }
      return <span style={{ fontSize: 12, color: C.warning }}>Chờ shop thanh toán</span>
    }
    if (h.confirmation === 'pending') {
      return <span style={{ fontSize: 12, color: C.warning }}>Chờ xác nhận</span>
    }
    if (h.confirmation === 'declined') {
      return <span style={{ fontSize: 12, color: C.gray }}>Đã từ chối</span>
    }
    if (h.confirmation === 'expired') {
      return <span style={{ fontSize: 12, color: C.error }}>Quá hạn — đã huỷ</span>
    }
    return <span style={{ color: C.gray }}>—</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.dark }}>🏆 Đấu giá vị trí Banner & Flash Sale</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
          Đặt giá để giành quyền hiển thị banner hoặc sản phẩm của shop bạn ở các vị trí hot trên Trang chủ. Giá cao nhất khi hết giờ sẽ thắng phiên.
        </p>
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 8 }}>
        {([['banner', 'Đấu giá banner'], ['flash', 'Đấu giá Flash Sale'], ['history', 'Lịch sử phiên']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: tab === key ? C.green : C.tint, color: tab === key ? 'white' : C.gray,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'banner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {BANNER_POSITIONS.map(def => {
            const session = sessions[def.key]
            if (!session) {
              return (
                <div key={def.key} className="card" style={{ padding: 20, opacity: 0.75 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>{def.label}</span>
                  </div>
                  <div style={{ borderRadius: 12, background: C.tint, padding: '20px 16px', textAlign: 'center', color: C.gray, fontSize: 13 }}>
                    🔒 Vị trí đang tạm khoá bởi Admin — chưa có phiên đấu giá nào được mở.
                  </div>
                </div>
              )
            }
            const remaining = msUntilEnd(session)
            const highest = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
            const minNext = getMinNextBid(def.key)
            const youAreLeading = highest?.shopName === shopName
            const urgent = remaining < 60_000
            const cooldownMs = getShopCooldownRemaining(def.key, shopName)
            const cooldownSec = Math.ceil(cooldownMs / 1000)

            return (
              <div key={def.key} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>{def.label}</span>
                  {youAreLeading && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#DCFCE7', color: C.green }}>Bạn đang dẫn đầu</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Khối 1 — Hình ảnh vị trí banner (dạng banner thật, kéo dài ngang) */}
                  <div style={{
                    aspectRatio: '16 / 6', borderRadius: 12, overflow: 'hidden', position: 'relative',
                    background: '#0f0f0f', display: 'flex', alignItems: 'flex-end',
                  }}>
                    <img src={def.previewImage} alt={def.label}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'relative', zIndex: 2, width: '100%', padding: '10px 14px',
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', color: 'white',
                    }}>
                      <p style={{ fontSize: 12, opacity: 0.9 }}>{def.description}</p>
                      <p style={{ fontSize: 12, marginTop: 2 }}>Giá khởi điểm: <strong>{def.basePrice.toLocaleString('vi-VN')}đ</strong></p>
                    </div>
                  </div>

                  {/* Khối 2 — Giá đang đấu (live, fake data chạy liên tục) */}
                  <div style={{
                    borderRadius: 12, border: `1px solid ${C.tint}`, background: C.tint,
                    padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.error, animation: 'pulseDot 1.2s infinite' }} />
                      <p style={{ fontSize: 11, color: C.gray, fontWeight: 700, textTransform: 'uppercase' }}>Đấu giá banner</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                      <p style={{ fontSize: 28, fontWeight: 800, color: C.green, lineHeight: 1.1 }}>
                        {highest ? highest.amount.toLocaleString('vi-VN') + 'đ' : 'Chưa có lượt đặt'}
                      </p>
                      <span style={{ fontSize: 12, color: C.gray, whiteSpace: 'nowrap' }}>
                        Còn lại: <strong style={{ color: urgent ? C.error : C.dark }}>{formatCountdown(remaining)}</strong>
                      </span>
                    </div>
                    {highest && (
                      <div style={{
                        background: 'white', border: `1.5px solid ${C.green}`, borderRadius: 8,
                        padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2,
                      }}>
                        <p style={{ fontSize: 10, color: C.green, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>👑 Đang dẫn đầu</p>
                        <p style={{ fontSize: 15, fontWeight: 800, color: C.dark }}>{highest.bannerImage} {highest.shopName}</p>
                      </div>
                    )}
                    <p style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{session.bids.length} lượt gọi giá</p>
                    <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                      {session.bids.slice(0, 6).map(b => (
                        <div key={b.id} style={{ fontSize: 12, color: C.gray, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.bannerImage} {b.shopName}</span>
                          <span style={{ fontWeight: 700, color: C.dark, flexShrink: 0 }}>{b.amount.toLocaleString('vi-VN')}đ</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Khối 3 — Shop nhập giá muốn đấu */}
                  <div style={{
                    borderRadius: 12, border: '1px solid var(--border-subtle)',
                    padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <label style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>Chọn mức giá muốn đấu</label>
                    <p style={{ fontSize: 11, color: C.gray, marginTop: -6 }}>
                      {cooldownMs > 0
                        ? <>⏱ Đã đặt giá lượt trước — chờ <strong style={{ color: C.warning }}>{cooldownSec}s</strong> để đặt lượt tiếp theo</>
                        : 'Giá sẽ tự nâng theo các shop khác đã gọi giá — mỗi lượt đặt giá cách lượt kế tiếp 10s'}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {getSuggestedAmounts(minNext).map(amount => (
                        <button key={amount} onClick={() => handleBid(def.key, amount)} disabled={remaining <= 0 || cooldownMs > 0}
                          style={{
                            padding: '10px 6px', background: C.green, color: 'white', border: 'none', borderRadius: 8,
                            fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (remaining <= 0 || cooldownMs > 0) ? 0.5 : 1,
                          }}>
                          {amount.toLocaleString('vi-VN')}đ
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'flash' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {products.length === 0 && (
            <div className="card" style={{ padding: 16, fontSize: 13, color: C.warning }}>
              ⚠️ Shop chưa có sản phẩm nào. Vui lòng thêm sản phẩm trước khi tham gia đấu giá Flash Sale.
            </div>
          )}
          {FLASH_SLOTS.map(def => {
            const session = flashSessions[def.key]
            if (!session) {
              return (
                <div key={def.key} className="card" style={{ padding: 20, opacity: 0.75 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>⚡ {def.label}</span>
                  </div>
                  <div style={{ borderRadius: 12, background: C.tint, padding: '20px 16px', textAlign: 'center', color: C.gray, fontSize: 13 }}>
                    🔒 Vị trí đang tạm khoá bởi Admin — chưa có phiên đấu giá nào được mở.
                  </div>
                </div>
              )
            }
            const remaining = msUntilFlashEnd(session)
            const highest = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
            const minNext = getMinNextFlashBid(def.key)
            const youAreLeading = highest?.shopName === shopName
            const urgent = remaining < 60_000
            const selectedProductId = flashProductInputs[def.key]
            const cooldownMs = getFlashShopCooldownRemaining(def.key, shopName)
            const cooldownSec = Math.ceil(cooldownMs / 1000)

            return (
              <div key={def.key} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>⚡ {def.label}</span>
                  {youAreLeading && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#DCFCE7', color: C.green }}>Bạn đang dẫn đầu</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Khối 1 — Sản phẩm đang dẫn đầu (mô phỏng vị trí Flash Sale) */}
                  <div style={{
                    borderRadius: 12, overflow: 'hidden', position: 'relative',
                    background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 40%, #b91c1c 100%)',
                    padding: 14, display: 'flex', alignItems: 'center', gap: 14, minHeight: 96,
                  }}>
                    {highest?.productImage ? (
                      <img src={highest.productImage} alt={highest.productName}
                        style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#fff' }} />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: 10, background: 'rgba(255,255,255,0.12)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>⚡</div>
                    )}
                    <div style={{ color: 'white', minWidth: 0 }}>
                      <p style={{ fontSize: 12, opacity: 0.85 }}>{def.description}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {highest ? highest.productName : 'Chưa có sản phẩm nào đấu giá'}
                      </p>
                      <p style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>Giá khởi điểm: <strong>{def.basePrice.toLocaleString('vi-VN')}đ</strong></p>
                    </div>
                  </div>

                  {/* Khối 2 — Giá đang đấu (live, fake data chạy liên tục) */}
                  <div style={{
                    borderRadius: 12, border: `1px solid ${C.tint}`, background: C.tint,
                    padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.error, animation: 'pulseDot 1.2s infinite' }} />
                      <p style={{ fontSize: 11, color: C.gray, fontWeight: 700, textTransform: 'uppercase' }}>Đấu giá Flash Sale</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                      <p style={{ fontSize: 28, fontWeight: 800, color: C.green, lineHeight: 1.1 }}>
                        {highest ? highest.amount.toLocaleString('vi-VN') + 'đ' : 'Chưa có lượt đặt'}
                      </p>
                      <span style={{ fontSize: 12, color: C.gray, whiteSpace: 'nowrap' }}>
                        Còn lại: <strong style={{ color: urgent ? C.error : C.dark }}>{formatFlashCountdown(remaining)}</strong>
                      </span>
                    </div>
                    {highest && (
                      <div style={{
                        background: 'white', border: `1.5px solid ${C.green}`, borderRadius: 8,
                        padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2,
                      }}>
                        <p style={{ fontSize: 10, color: C.green, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>👑 Đang dẫn đầu</p>
                        <p style={{ fontSize: 15, fontWeight: 800, color: C.dark }}>{highest.shopName} — {highest.productName}</p>
                      </div>
                    )}
                    <p style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{session.bids.length} lượt gọi giá</p>
                    <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                      {session.bids.slice(0, 6).map(b => (
                        <div key={b.id} style={{ fontSize: 12, color: C.gray, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.shopName} — {b.productName}</span>
                          <span style={{ fontWeight: 700, color: C.dark, flexShrink: 0 }}>{b.amount.toLocaleString('vi-VN')}đ</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Khối 3 — Shop chọn sản phẩm + nhập giá muốn đấu */}
                  <div style={{
                    borderRadius: 12, border: '1px solid var(--border-subtle)',
                    padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <label style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>Chọn sản phẩm để đấu giá</label>
                    <select
                      className="input"
                      value={selectedProductId || ''}
                      onChange={e => setFlashProductInputs(s => ({ ...s, [def.key]: e.target.value }))}
                    >
                      <option value="">-- Chọn sản phẩm của shop --</option>
                      {products.map(p => (
                        <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.price?.toLocaleString('vi-VN')}đ)</option>
                      ))}
                    </select>
                    <p style={{ fontSize: 11, color: C.gray, marginTop: -2 }}>
                      {cooldownMs > 0
                        ? <>⏱ Đã đặt giá lượt trước — chờ <strong style={{ color: C.warning }}>{cooldownSec}s</strong> để đặt lượt tiếp theo</>
                        : 'Giá sẽ tự nâng theo các shop khác đã gọi giá — mỗi lượt đặt giá cách lượt kế tiếp 10s'}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {getSuggestedAmounts(minNext).map(amount => (
                        <button key={amount} onClick={() => handleFlashBid(def.key, amount)} disabled={remaining <= 0 || !selectedProductId || cooldownMs > 0}
                          style={{
                            padding: '10px 6px', background: C.green, color: 'white', border: 'none', borderRadius: 8,
                            fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (remaining <= 0 || !selectedProductId || cooldownMs > 0) ? 0.5 : 1,
                          }}>
                          {amount.toLocaleString('vi-VN')}đ
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'history' && (
        <div className="card" style={{ padding: 0 }}>
          {(history.length === 0 && flashHistory.length === 0) ? (
            <p style={{ textAlign: 'center', padding: 32, color: C.gray }}>Chưa có phiên đấu giá nào kết thúc</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 12, color: C.gray, borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: 12 }}>Loại</th>
                  <th style={{ padding: 12 }}>Vị trí</th>
                  <th style={{ padding: 12 }}>Thời gian</th>
                  <th style={{ padding: 12 }}>Số lượt đặt</th>
                  <th style={{ padding: 12 }}>Shop thắng</th>
                  <th style={{ padding: 12 }}>Giá thắng</th>
                  <th style={{ padding: 12 }}>Thanh toán</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const def = BANNER_POSITIONS.find(d => d.key === h.position)!
                  return (
                    <tr key={h.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                      <td style={{ padding: 12 }}><span className="badge badge-success">Banner</span></td>
                      <td style={{ padding: 12, fontWeight: 600 }}>{def.label}</td>
                      <td style={{ padding: 12, color: C.gray }}>{new Date(h.startedAt).toLocaleString('vi-VN')} → {new Date(h.endsAt).toLocaleString('vi-VN')}</td>
                      <td style={{ padding: 12 }}>{h.bids.length}</td>
                      <td style={{ padding: 12 }}>{h.winner ? `${h.winner.bannerImage} ${h.winner.shopName}` : <span style={{ color: C.gray }}>Không có ai đặt giá</span>}</td>
                      <td style={{ padding: 12, fontWeight: 700, color: C.green }}>{h.winner ? h.winner.amount.toLocaleString('vi-VN') + 'đ' : '—'}</td>
                      <td style={{ padding: 12 }}>{renderPaymentCell(h, 'banner')}</td>
                    </tr>
                  )
                })}
                {flashHistory.map(h => {
                  const def = FLASH_SLOTS.find(d => d.key === h.slot)!
                  return (
                    <tr key={h.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                      <td style={{ padding: 12 }}><span className="badge badge-error">Flash Sale</span></td>
                      <td style={{ padding: 12, fontWeight: 600 }}>{def.label}</td>
                      <td style={{ padding: 12, color: C.gray }}>{new Date(h.startedAt).toLocaleString('vi-VN')} → {new Date(h.endsAt).toLocaleString('vi-VN')}</td>
                      <td style={{ padding: 12 }}>{h.bids.length}</td>
                      <td style={{ padding: 12 }}>{h.winner ? `${h.winner.shopName} — ${h.winner.productName}` : <span style={{ color: C.gray }}>Không có ai đặt giá</span>}</td>
                      <td style={{ padding: 12, fontWeight: 700, color: C.green }}>{h.winner ? h.winner.amount.toLocaleString('vi-VN') + 'đ' : '—'}</td>
                      <td style={{ padding: 12 }}>{renderPaymentCell(h, 'flash')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Popup chúc mừng thắng đấu giá + điều khoản chờ shop xác nhận */}
      {pendingWins.length > 0 && (() => {
        const win = pendingWins[0]
        const isBanner = win.type === 'banner'
        const bannerSession = win.session as BannerAuctionSession
        const flashSession = win.session as FlashAuctionSession
        const label = isBanner
          ? BANNER_POSITIONS.find(d => d.key === bannerSession.position)?.label
          : FLASH_SLOTS.find(d => d.key === flashSession.slot)?.label
        const winner = win.session.winner!
        const productLine = !isBanner ? (winner as any).productName : undefined
        const paymentDeadline = win.session.paymentDeadline ? new Date(win.session.paymentDeadline).getTime() : 0
        const paymentRemaining = Math.max(0, paymentDeadline - now)
        const paymentUrgent = paymentRemaining < 10 * 60 * 1000 // dưới 10 phút

        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, maxWidth: 460, width: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40 }}>🎉</div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: C.dark, marginTop: 6 }}>Chúc mừng! Bạn đã thắng đấu giá</h2>
                <p style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>
                  {isBanner ? 'Vị trí banner: ' : 'Vị trí Flash Sale: '}<strong>{label}</strong>
                </p>
              </div>

              <div style={{ background: C.tint, borderRadius: 10, padding: 14, fontSize: 13, color: C.dark }}>
                <p>Giá thắng cuối cùng: <strong style={{ color: C.green }}>{winner.amount.toLocaleString('vi-VN')}đ</strong></p>
                {productLine && <p style={{ marginTop: 4 }}>Sản phẩm đăng ký: <strong>{productLine}</strong></p>}
              </div>

              <div style={{
                background: paymentUrgent ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${paymentUrgent ? C.error : C.warning}`,
                borderRadius: 10, padding: 14, textAlign: 'center',
              }}>
                <p style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>⏳ Thời gian thanh toán còn lại</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: paymentUrgent ? C.error : C.warning, marginTop: 2 }}>
                  {formatCountdown(paymentRemaining)}
                </p>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Chính sách đấu giá & thanh toán</p>
                <ul style={{ fontSize: 12, color: C.gray, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>Sau khi xác nhận, shop có <strong>1 giờ</strong> để hoàn tất thanh toán số tiền thắng đấu giá.</li>
                  <li><strong>Nếu không thanh toán trong vòng 1 giờ</strong>, kết quả đấu giá sẽ <strong>tự động bị huỷ</strong> và vị trí sẽ được mở phiên <strong>đấu giá lại từ đầu</strong>.</li>
                  <li>Vị trí hiển thị sẽ được kích hoạt ngay sau khi shop hoàn tất thanh toán.</li>
                  <li>BuyZo có quyền thu hồi vị trí nếu nội dung banner/sản phẩm vi phạm chính sách hiển thị.</li>
                  <li>Số tiền đã thanh toán không được hoàn lại nếu shop tự ý huỷ sau khi đã thanh toán.</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => handleConfirmWin(win, false)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: C.gray, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Từ chối
                </button>
                <button onClick={() => handleConfirmWin(win, true)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: C.green, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Tôi đồng ý & Xác nhận
                </button>
              </div>
              {pendingWins.length > 1 && (
                <p style={{ textAlign: 'center', fontSize: 11, color: C.gray }}>Còn {pendingWins.length - 1} vị trí khác đang chờ xác nhận</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Popup xác nhận thanh toán — bấm "Thanh toán" ở Lịch sử phiên sẽ hiện bảng này để shop xác nhận trước khi chốt */}
      {payConfirm && (() => {
        const isBanner = payConfirm.type === 'banner'
        const bannerSession = payConfirm.session as BannerAuctionSession
        const flashSession = payConfirm.session as FlashAuctionSession
        const label = isBanner
          ? BANNER_POSITIONS.find(d => d.key === bannerSession.position)?.label
          : FLASH_SLOTS.find(d => d.key === flashSession.slot)?.label
        const winner = payConfirm.session.winner!
        const productLine = !isBanner ? (winner as any).productName : undefined
        const deadline = payConfirm.session.paymentDeadline ? new Date(payConfirm.session.paymentDeadline).getTime() : 0
        const remaining = Math.max(0, deadline - now)

        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1001,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36 }}>💳</div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: C.dark, marginTop: 4 }}>Xác nhận thanh toán</h2>
                <p style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>
                  {isBanner ? 'Vị trí banner: ' : 'Vị trí Flash Sale: '}<strong>{label}</strong>
                </p>
              </div>

              <div style={{ background: C.tint, borderRadius: 10, padding: 14, fontSize: 13, color: C.dark, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: C.gray }}>Số tiền cần thanh toán</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: C.green, marginTop: 2 }}>{winner.amount.toLocaleString('vi-VN')}đ</p>
                {productLine && <p style={{ marginTop: 6, fontSize: 12 }}>Sản phẩm đăng ký: <strong>{productLine}</strong></p>}
                {remaining > 0 && (
                  <p style={{ marginTop: 6, fontSize: 11, color: C.gray }}>Thời gian còn lại: <strong style={{ color: C.warning }}>{formatCountdown(remaining)}</strong></p>
                )}
              </div>

              <p style={{ fontSize: 12, color: C.gray, textAlign: 'center' }}>
                Sau khi xác nhận, khoản thanh toán sẽ được ghi nhận và vị trí sẽ được lên lịch hiển thị. Hành động này không thể hoàn tác.
              </p>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setPayConfirm(null)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: C.gray, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Huỷ
                </button>
                <button onClick={() => handlePayWin(payConfirm.type, payConfirm.session)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: C.green, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Xác nhận thanh toán
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Popup đăng banner / đăng sản phẩm sau khi thanh toán thành công — chờ Admin duyệt */}
      {submitTarget && (() => {
        const isBanner = submitTarget.type === 'banner'
        const bannerSession = submitTarget.session as BannerAuctionSession
        const flashSession = submitTarget.session as FlashAuctionSession
        const label = isBanner
          ? BANNER_POSITIONS.find(d => d.key === bannerSession.position)?.label
          : FLASH_SLOTS.find(d => d.key === flashSession.slot)?.label
        const bannerSpec = isBanner ? BANNER_IMAGE_SPECS[bannerSession.position] : null

        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1002,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, maxWidth: 460, width: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36 }}>{isBanner ? '📢' : '📦'}</div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: C.dark, marginTop: 4 }}>
                  {isBanner ? 'Đăng banner hiển thị' : 'Đăng sản phẩm Flash Sale'}
                </h2>
                <p style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>Vị trí: <strong>{label}</strong></p>
              </div>

              {isBanner ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Tiêu đề banner *</label>
                    <input value={bannerForm.title} onChange={e => setBannerForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="VD: Sale hè rộn ràng — giảm tới 50%"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Liên kết (không bắt buộc)</label>
                    <input value={bannerForm.link} onChange={e => setBannerForm(f => ({ ...f, link: e.target.value }))}
                      placeholder="VD: /shops/123"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Hình ảnh banner *</label>
                    <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerImageFile(f) }}
                      style={{ width: '100%', fontSize: 13 }} />
                    <p style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>
                      📐 Yêu cầu ảnh: tỉ lệ <strong>{bannerSpec!.ratioLabel}</strong> (khuyến nghị {bannerSpec!.recommendedW}×{bannerSpec!.recommendedH}px), dung lượng tối đa <strong>{bannerSpec!.maxKB.toLocaleString('vi-VN')}KB</strong>.
                    </p>
                    {bannerImgError && (
                      <p style={{ fontSize: 11, color: C.error, marginTop: 4 }}>⚠️ {bannerImgError}</p>
                    )}
                    {bannerForm.image && (
                      <img src={bannerForm.image} alt="preview" style={{ marginTop: 8, width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8 }} />
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Tên sản phẩm *</label>
                    <input value={flashForm.productName} onChange={e => setFlashForm(f => ({ ...f, productName: e.target.value }))}
                      placeholder="VD: Tai nghe Bluetooth Pro Max"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Giá bán hiển thị Flash Sale (đ) *</label>
                    <input value={flashForm.price} onChange={e => setFlashForm(f => ({ ...f, price: e.target.value.replace(/[^\d]/g, '') }))}
                      placeholder="VD: 199000"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Hình ảnh sản phẩm *</label>
                    <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFlashImageFile(f) }}
                      style={{ width: '100%', fontSize: 13 }} />
                    <p style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>
                      📐 Yêu cầu ảnh: tỉ lệ <strong>{FLASH_IMAGE_SPEC.ratioLabel}</strong> (khuyến nghị {FLASH_IMAGE_SPEC.recommendedW}×{FLASH_IMAGE_SPEC.recommendedH}px), dung lượng tối đa <strong>{FLASH_IMAGE_SPEC.maxKB.toLocaleString('vi-VN')}KB</strong>.
                    </p>
                    {flashImgError && (
                      <p style={{ fontSize: 11, color: C.error, marginTop: 4 }}>⚠️ {flashImgError}</p>
                    )}
                    {flashForm.image && (
                      <img src={flashForm.image} alt="preview" style={{ marginTop: 8, width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8 }} />
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: C.gray, textAlign: 'center' }}>Sản phẩm này sẽ được gửi cho Admin duyệt để hiển thị tại khu Flash Sale.</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setSubmitTarget(null)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: C.gray, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Huỷ
                </button>
                <button onClick={isBanner ? handleSubmitBanner : handleSubmitFlash}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#1D4ED8', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Gửi cho Admin duyệt
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default BannerAuctionPage
