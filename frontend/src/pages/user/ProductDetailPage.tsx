import React, { useEffect, useState, useRef, useCallback } from 'react'
import { trackViewedProduct } from '../../store/searchTrackingStore'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Loading from '../../components/common/Loading'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchProductById } from '../../store/slices/productSlice'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatRating } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'
import { trackMissionEvent } from '../../utils/eventsStore'
import API from '../../services/api'

const C = {
  primary: '#1D4ED8', navy: '#1E3A8A',
  gray: '#64748B', light: '#F1F5F9',
  success: '#16A34A', error: '#DC2626',
  gold: '#F59E0B', orange: '#EA580C',
  purple: '#7C3AED',
}

/* ─── REVIEW STORE (localStorage) ─── */
interface Review {
  id: string
  product_id: number
  rating: number
  comment: string
  image_data_urls: string[]
  video_name?: string
  visibility: 'public' | 'anonymous' | 'shop_only'
  user_name: string
  user_email: string
  created_at: string
}
const REV_KEY = 'buyzo_reviews_v1'
function getAllReviews(): Review[] {
  try { const d = JSON.parse(localStorage.getItem(REV_KEY) || '[]'); return Array.isArray(d) ? d : [] } catch { return [] }
}
function getProductReviews(pid: number) { return getAllReviews().filter(r => r.product_id === pid) }
function saveReview(r: Omit<Review, 'id' | 'created_at'>): Review {
  const all = getAllReviews()
  const newR: Review = { ...r, id: Date.now().toString(), created_at: new Date().toISOString() }
  localStorage.setItem(REV_KEY, JSON.stringify([newR, ...all]))
  return newR
}
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 400; const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('no ctx')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url); resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load fail')) }
    img.src = url
  })
}

/* ─── DELIVERY ─── */
function getDeliveryInfo() {
  const now = new Date()
  const t1 = new Date(now); t1.setDate(t1.getDate() + 1)
  const t2 = new Date(now); t2.setDate(t2.getDate() + 2)
  const fmt = (d: Date) => d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })
  const canToday = now.getHours() < 14
  return { canToday, earliest: canToday ? fmt(t1) : fmt(t2) }
}

/* ─── STARS ─── */
const Stars = ({ val, size = 14, onChange }: { val: number; size?: number; onChange?: (v: number) => void }) => (
  <div style={{ display: 'flex', gap: 2, cursor: onChange ? 'pointer' : 'default' }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} onClick={() => onChange?.(i)} style={{ color: i <= val ? C.gold : '#D1D5DB', fontSize: size, lineHeight: 1 }}>★</span>
    ))}
  </div>
)

/* ─── LIGHTBOX ─── */
const Lightbox = ({ src, onClose }: { src: string; onClose: () => void }) => (
  <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <img src={src} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
    <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', color: 'white', fontSize: 32, cursor: 'pointer', lineHeight: 1 }}>✕</button>
  </div>
)

/* ─── REVIEW FORM ─── */
const ReviewForm = ({ productId, userEmail, userName, onSaved }: { productId: number; userEmail: string; userName: string; onSaved: () => void }) => {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'anonymous' | 'shop_only'>('public')
  const [saving, setSaving] = useState(false)
  const [imgFiles, setImgFiles] = useState<File[]>([])
  const [imgPreviews, setImgPreviews] = useState<string[]>([])
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const vidRef = useRef<HTMLInputElement>(null)

  useEffect(() => { return () => { imgPreviews.forEach(u => URL.revokeObjectURL(u)); if (videoPreview) URL.revokeObjectURL(videoPreview) } }, [])

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - imgFiles.length)
    if (!files.length) return
    const newFiles = [...imgFiles, ...files].slice(0, 5)
    imgPreviews.forEach(u => URL.revokeObjectURL(u))
    setImgFiles(newFiles); setImgPreviews(newFiles.map(f => URL.createObjectURL(f)))
    e.target.value = ''
  }
  const removeImg = (idx: number) => {
    URL.revokeObjectURL(imgPreviews[idx])
    setImgFiles(p => p.filter((_, i) => i !== idx)); setImgPreviews(p => p.filter((_, i) => i !== idx))
  }
  const handleVidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    if (videoPreview) URL.revokeObjectURL(videoPreview)
    setVideoFile(f); setVideoPreview(URL.createObjectURL(f)); e.target.value = ''
  }
  const removeVideo = () => { if (videoPreview) URL.revokeObjectURL(videoPreview); setVideoFile(null); setVideoPreview(null) }
  const reset = () => {
    imgPreviews.forEach(u => URL.revokeObjectURL(u)); if (videoPreview) URL.revokeObjectURL(videoPreview)
    setComment(''); setRating(5); setImgFiles([]); setImgPreviews([]); setVideoFile(null); setVideoPreview(null)
  }
  const submit = async () => {
    if (!comment.trim()) return
    setSaving(true)
    try {
      let image_data_urls: string[] = []
      try { image_data_urls = await Promise.all(imgFiles.map(fileToDataUrl)) } catch { image_data_urls = [] }
      saveReview({ product_id: productId, rating, comment: comment.trim(), image_data_urls, video_name: videoFile?.name, visibility, user_name: userName, user_email: userEmail })
      reset(); onSaved()
    } catch {
      try { saveReview({ product_id: productId, rating, comment: comment.trim(), image_data_urls: [], video_name: videoFile?.name, visibility, user_name: userName, user_email: userEmail }); reset(); onSaved() } catch { alert('Không thể lưu đánh giá. Vui lòng thử lại.') }
    } finally { setSaving(false) }
  }

  const btnS = (active: boolean): React.CSSProperties => ({
    fontSize: 12, padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
    border: active ? `1.5px solid ${C.primary}` : '1.5px solid var(--gray-200)',
    background: active ? '#DBEAFE' : 'white', color: active ? C.primary : C.gray,
    fontWeight: active ? 700 : 400, transition: 'all 0.15s',
  })
  const addBox: React.CSSProperties = { width: 80, height: 80, borderRadius: 10, border: '2px dashed #CBD5E1', background: '#F8FAFC', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: C.gray, fontSize: 11, flexShrink: 0 }

  return (
    <div style={{ background: 'white', border: '1.5px solid var(--gray-200)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <p style={{ fontWeight: 700, color: C.navy, marginBottom: 14, fontSize: 15 }}>Viết đánh giá của bạn</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: C.gray }}>Chất lượng:</span>
        <Stars val={rating} size={24} onChange={setRating} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{rating}/5</span>
      </div>
      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..." rows={3}
        style={{ width: '100%', borderRadius: 10, border: '1.5px solid var(--gray-200)', padding: '10px 14px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 12, color: C.gray, marginBottom: 8 }}>📷 Thêm ảnh / video (tối đa 5 ảnh · 1 video)</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {imgPreviews.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              <img src={src} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1.5px solid var(--gray-200)' }} />
              <button onClick={() => removeImg(i)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#EF4444', color: 'white', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
            </div>
          ))}
          {videoPreview && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <video src={videoPreview} controls style={{ width: 140, height: 90, objectFit: 'cover', borderRadius: 10, border: '1.5px solid var(--gray-200)', background: '#000', display: 'block' }} />
              <button onClick={removeVideo} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#EF4444', color: 'white', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
            </div>
          )}
          {imgFiles.length < 5 && (
            <button onClick={() => imgRef.current?.click()} style={addBox}
              onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#CBD5E1')}>
              <span style={{ fontSize: 22 }}>📷</span><span>Thêm ảnh</span>
            </button>
          )}
          {!videoFile && (
            <button onClick={() => vidRef.current?.click()} style={addBox}
              onMouseEnter={e => (e.currentTarget.style.borderColor = C.purple)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#CBD5E1')}>
              <span style={{ fontSize: 22 }}>🎬</span><span>Thêm video</span>
            </button>
          )}
          <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImgChange} />
          <input ref={vidRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVidChange} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['public', 'anonymous', 'shop_only'] as const).map(v => {
            const labels: Record<string,string> = { public: '🌐 Công khai', anonymous: '🥷 Ẩn danh', shop_only: '🔒 Chỉ shop thấy' }
            return <button key={v} onClick={() => setVisibility(v)} style={btnS(visibility === v)}>{labels[v]}</button>
          })}
        </div>
        <button onClick={submit} disabled={!comment.trim() || saving} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: comment.trim() ? C.primary : '#CBD5E1', color: 'white', fontWeight: 700, fontSize: 14, cursor: comment.trim() ? 'pointer' : 'not-allowed' }}>
          {saving ? 'Đang lưu...' : 'Gửi đánh giá'}
        </button>
      </div>
    </div>
  )
}

/* ─── REVIEW CARD ─── */
const ReviewCard = ({ r }: { r: Review }) => {
  const isAnon = r.visibility === 'anonymous'
  const isShopOnly = r.visibility === 'shop_only'
  const dt = new Date(r.created_at).toLocaleDateString('vi-VN')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [playingVideo, setPlayingVideo] = useState(false)
  const images = r.image_data_urls?.length ? r.image_data_urls : []
  return (
    <>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: isAnon ? '#F1F5F9' : 'linear-gradient(135deg,#1E3A8A,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            {isAnon ? '🥷' : r.user_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 13, color: C.navy, margin: 0 }}>
              {isAnon ? 'Người dùng ẩn danh' : r.user_name}
              {isShopOnly && <span style={{ marginLeft: 6, fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 10 }}>Chỉ shop thấy</span>}
            </p>
            <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>{dt}</p>
          </div>
          <div style={{ marginLeft: 'auto' }}><Stars val={r.rating} size={13} /></div>
        </div>
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.65, margin: '0 0 12px 0' }}>{r.comment}</p>
        {(images.length > 0 || r.video_name) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {images.map((src, i) => (
              <div key={i} onClick={() => setLightbox(src)} style={{ width: 90, height: 90, borderRadius: 10, overflow: 'hidden', flexShrink: 0, cursor: 'zoom-in', border: '1px solid var(--gray-200)', transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
            {r.video_name && (
              <div style={{ flexShrink: 0 }}>
                {!playingVideo ? (
                  <div onClick={() => setPlayingVideo(true)} style={{ width: 140, height: 90, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(135deg,#1E1B4B,#312E81)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--gray-200)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                      <span style={{ color: 'white', fontSize: 18, marginLeft: 3 }}>▶</span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, maxWidth: 120, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px' }}>{r.video_name}</span>
                  </div>
                ) : (
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--gray-200)', width: 280 }}>
                    <div style={{ background: '#1E1B4B', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>🎬</span>
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.video_name}</span>
                    </div>
                    <div style={{ background: '#0F0F1A', padding: '18px 0', textAlign: 'center' }}>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>📽️ Video không khả dụng sau khi tải lại trang</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/* ─── PRODUCT CARD ─── */
const ProductCard = ({ p, onClick }: { p: any; onClick: () => void }) => (
  <div onClick={onClick} style={{ background: 'white', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--gray-200)', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}>
    <div style={{ aspectRatio: '1', background: '#F8FAFC', overflow: 'hidden' }}>
      <img src={getImageUrl(p.image_urls?.[0] || '/images/placeholder.png')} alt={p.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
    <div style={{ padding: '10px 12px' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 4, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{p.product_name}</p>
      <p style={{ fontSize: 15, fontWeight: 800, color: '#E11D48', margin: 0 }}>{formatCurrency(p.price)}</p>
      {p.rating && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}><Stars val={Math.round(Number(p.rating))} size={11} /><span style={{ fontSize: 11, color: C.gray }}>({p.total_reviews ?? 0})</span></div>}
    </div>
  </div>
)

/* ════════════ MAIN PAGE ════════════ */
const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { selectedProduct: product, loading } = useAppSelector(s => s.product)
  const { add } = useCart()
  const { isAuthenticated, user } = useAuth()
  const [qty, setQty] = useState(1)
  const [imgIdx, setImgIdx] = useState(0)
  const [addedMsg, setAddedMsg] = useState(false)
  const [vouchers, setVouchers] = useState<any[]>([])
  const [showAllVouchers, setShowAllVouchers] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewFilter, setReviewFilter] = useState<0|1|2|3|4|5>(0)
  const [shopProducts, setShopProducts] = useState<any[]>([])
  const [recommended, setRecommended] = useState<any[]>([])
  const [recLoadingMore, setRecLoadingMore] = useState(false)
  const [recLoopLoading, setRecLoopLoading] = useState(false)
  const recPageRef      = useRef(1)
  const recPagesRef     = useRef(1)
  const recFetchingRef  = useRef(false)
  const recCancelRef    = useRef(false)
  const recSentinelRef  = useRef<HTMLDivElement>(null)
  const recCatIdRef     = useRef<number | null>(null)
  const recProductIdRef = useRef<number | null>(null)

  useEffect(() => { if (id) { dispatch(fetchProductById(Number(id))); trackMissionEvent('view_product') } }, [id, dispatch])

  // Track sản phẩm đã xem >= 4 giây (chưa mua)
  useEffect(() => {
    if (!product) return
    const timer = setTimeout(() => {
      trackViewedProduct({
        product_id: product.product_id,
        product_name: product.product_name,
        price: String(product.price),
        image_url: (product as any).image_urls?.[0] ?? null,
        shop_name: (product as any).shop_name ?? undefined,
      })
    }, 4000)
    return () => clearTimeout(timer)
  }, [product])
  useEffect(() => { if (id) setReviews(getProductReviews(Number(id))) }, [id])
  useEffect(() => {
    API.get('/api/v1/vouchers/platform').then(r => setVouchers((r.data?.vouchers || r.data || []).slice(0, 6))).catch(() => setVouchers([]))
  }, [])
  useEffect(() => {
    if (!product) return
    if (product.shop_id) {
      API.get('/api/v1/products', { params: { shop_id: product.shop_id, limit: 8 } }).then(r => {
        const list: any[] = r.data?.products || r.data?.items || r.data || []
        setShopProducts(list.filter(p => p.product_id !== product.product_id).slice(0, 6))
      }).catch(() => {})
    }
    const catId = (product as any).category_id
    if (catId) {
      // Reset infinite scroll state
      recCatIdRef.current     = catId
      recProductIdRef.current = product.product_id
      recPageRef.current      = 1
      recPagesRef.current     = 1
      recFetchingRef.current  = false
      setRecommended([])
      setRecLoadingMore(false)
      setRecLoopLoading(false)

      API.get('/api/v1/products', { params: { category_id: catId, limit: 8, sort: 'top_rated', page: 1 } }).then(r => {
        const list: any[] = r.data?.products || r.data?.items || []
        setRecommended(list.filter((p: any) => p.product_id !== product.product_id))
        recPageRef.current  = r.data?.page  ?? 1
        recPagesRef.current = r.data?.pages ?? 1
      }).catch(() => {})
    }
  }, [product])

  // ── Infinite scroll cho Gợi ý ──────────────────────────────────────────────
  const recSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

  const loadMoreRecommended = useCallback(async () => {
    if (recFetchingRef.current || !recCatIdRef.current) return
    recFetchingRef.current = true

    const isLoop   = recPageRef.current >= recPagesRef.current
    const nextPage = isLoop ? 1 : recPageRef.current + 1

    try {
      if (isLoop) {
        recCancelRef.current = false
        setRecLoopLoading(true)
        setRecLoadingMore(false)
        await recSleep(3000)
        if (recCancelRef.current) { recCancelRef.current = false; recFetchingRef.current = false; return }
        setRecLoopLoading(false)
      } else {
        setRecLoadingMore(true)
      }
      const res = await API.get('/api/v1/products', {
        params: { category_id: recCatIdRef.current, limit: 8, sort: 'top_rated', page: nextPage }
      })
      const list: any[] = res.data?.products || []
      const filtered = list.filter((p: any) => p.product_id !== recProductIdRef.current)
      setRecommended(prev => [...prev, ...filtered])
      recPageRef.current  = res.data?.page  ?? nextPage
      recPagesRef.current = res.data?.pages ?? 1
      setRecLoadingMore(false)
    } catch {
      setRecLoadingMore(false)
      setRecLoopLoading(false)
    } finally {
      recFetchingRef.current = false
    }
  }, [])

  // Phải phụ thuộc vào recommended.length để effect chạy lại sau khi sentinel xuất hiện trong DOM
  useEffect(() => {
    const sentinel = recSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMoreRecommended() },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMoreRecommended, recommended.length])

  const handleAddToCart = async () => { if (!isAuthenticated) { navigate('/login'); return }; await add(product!.product_id, qty); setAddedMsg(true); setTimeout(() => setAddedMsg(false), 2000) }
  const handleBuyNow = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    await add(product!.product_id, qty)
    navigate('/checkout', {
      state: {
        cartItems: [{
          cart_id: 0,
          product_id: product!.product_id,
          product_name: product!.product_name,
          product_image: (product as any).image_urls?.[0] ?? (product as any).image_url ?? '',
          price: Number(product!.price),
          quantity: qty,
          shop_id: (product as any).shop_id ?? 0,
          shop_name: (product as any).shop_name ?? 'Shop',
        }]
      }
    })
  }

  if (loading) return <Loading />
  if (!product) return (
    <div className="container" style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
      <p style={{ color: C.gray }}>Sản phẩm không tồn tại</p>
      <Link to="/products" className="btn btn-primary" style={{ marginTop: 16 }}>Quay lại mua sắm</Link>
    </div>
  )

  const images = product.image_urls?.length ? product.image_urls : ['/images/placeholder.png']
  const ratingNum = Math.round(Number(product.rating) || 0)
  const inStock = product.stock_quantity > 0
  const delivery = getDeliveryInfo()
  const starCounts = [5,4,3,2,1].map(s => ({ star: s, count: reviews.filter(r => r.rating === s).length }))
  const visibleReviews = reviewFilter === 0 ? reviews : reviews.filter(r => r.rating === reviewFilter)

  const SectionTitle = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
    <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, marginBottom: 20, paddingBottom: 10, borderBottom: `2px solid ${C.light}`, display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon} {children}
    </h2>
  )

  const arrowBtn: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 36, height: 36, borderRadius: '50%', border: 'none',
    background: 'rgba(255,255,255,0.88)', cursor: 'pointer', fontSize: 22, fontWeight: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)', zIndex: 2,
  }

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: C.gray, marginBottom: 20 }}>
          <Link to="/" style={{ color: C.gray, textDecoration: 'none' }}>Trang chủ</Link>
          <span>/</span>
          <Link to="/products" style={{ color: C.gray, textDecoration: 'none' }}>Sản phẩm</Link>
          {(product as any).category_name && (<><span>/</span><span>{(product as any).category_name}</span></>)}
          <span>/</span>
          <span style={{ color: C.navy, fontWeight: 500 }}>{product.product_name}</span>
        </div>

        {/* ── 2-COL ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start', marginBottom: 40 }}>

          {/* ── IMAGE GALLERY ── */}
          <div>
            {/* Main image */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <div style={{ borderRadius: 16, overflow: 'hidden', aspectRatio: '1', background: 'var(--gray-100)', boxShadow: '0 4px 20px rgba(0,0,0,0.10)' }}>
                <img src={getImageUrl(images[imgIdx])} alt={product.product_name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.2s' }} />
              </div>
              {/* Counter */}
              {images.length > 1 && (
                <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, backdropFilter: 'blur(4px)' }}>
                  {imgIdx + 1} / {images.length}
                </div>
              )}
              {/* Prev */}
              {images.length > 1 && imgIdx > 0 && (
                <button onClick={() => setImgIdx(i => i - 1)} style={{ ...arrowBtn, left: 10 }}>‹</button>
              )}
              {/* Next */}
              {images.length > 1 && imgIdx < images.length - 1 && (
                <button onClick={() => setImgIdx(i => i + 1)} style={{ ...arrowBtn, right: 10 }}>›</button>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}>
                {images.map((img, i) => (
                  <div key={i} onClick={() => setImgIdx(i)} style={{
                    flexShrink: 0, width: 80, height: 80, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s',
                    border: i === imgIdx ? `2.5px solid ${C.primary}` : '2.5px solid transparent',
                    boxShadow: i === imgIdx ? `0 0 0 1px ${C.primary}` : 'none',
                    opacity: i === imgIdx ? 1 : 0.55,
                  }}
                    onMouseEnter={e => { if (i !== imgIdx) (e.currentTarget as HTMLDivElement).style.opacity = '0.85' }}
                    onMouseLeave={e => { if (i !== imgIdx) (e.currentTarget as HTMLDivElement).style.opacity = '0.55' }}>
                    <img src={getImageUrl(img)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── INFO ── */}
          <div>
            {(product as any).category_name && (
              <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: C.primary, background: '#DBEAFE', padding: '3px 10px', borderRadius: 20, marginBottom: 10 }}>{(product as any).category_name}</span>
            )}
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, lineHeight: 1.4, marginBottom: 10 }}>{product.product_name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <Stars val={ratingNum} size={16} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.gold }}>{formatRating(product.rating)}</span>
              <span style={{ fontSize: 13, color: C.gray }}>({product.total_reviews} đánh giá)</span>
              <span style={{ fontSize: 13, color: C.gray }}>· Đã bán {product.sales_count?.toLocaleString('vi-VN') ?? 0}</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#E11D48', marginBottom: 16, letterSpacing: '-0.03em' }}>{formatCurrency(product.price)}</div>

            {/* Voucher */}
            <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#C2410C', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>🎁 Voucher &amp; Khuyến mãi</p>
              {vouchers.length === 0 ? <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>Không có voucher khả dụng</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(showAllVouchers ? vouchers : vouchers.slice(0, 2)).map((v: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: '#C2410C', color: 'white', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>VOUCHER</span>
                      <span style={{ fontSize: 13, color: '#374151' }}>{v.description || v.name || `Giảm ${v.discount_value ?? ''}${v.discount_type === 'percentage' ? '%' : 'đ'}`}</span>
                    </div>
                  ))}
                  {vouchers.length > 2 && (
                    <button onClick={() => setShowAllVouchers(x => !x)} style={{ fontSize: 12, color: '#C2410C', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontWeight: 600 }}>
                      {showAllVouchers ? '▲ Thu gọn' : `▼ Xem thêm ${vouchers.length - 2} voucher`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Giao hàng */}
            <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '12px 14px', marginBottom: 18 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: C.success, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>🚚 Thông tin giao hàng</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: C.success, color: 'white', padding: '2px 8px', borderRadius: 6, flexShrink: 0, marginTop: 1 }}>NHANH</span>
                  <span style={{ fontSize: 13, color: '#374151' }}>{delivery.canToday ? '⚡ Có thể giao trong 24 giờ nếu đặt trước 14:00 hôm nay' : '⚡ Đặt ngay để nhận hàng sớm nhất'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#60A5FA', color: 'white', padding: '2px 8px', borderRadius: 6, flexShrink: 0, marginTop: 1 }}>SỚM</span>
                  <span style={{ fontSize: 13, color: '#374151' }}>📅 Giao sớm nhất vào <strong>{delivery.earliest}</strong></span>
                </div>
                <span style={{ fontSize: 12, color: C.success }}>✓ Đổi trả miễn phí 15 ngày · ✓ Hàng chính hãng</span>
              </div>
            </div>

            {/* Qty */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <span style={{ fontSize: 14, color: C.gray, fontWeight: 500 }}>Số lượng:</span>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--gray-200)', borderRadius: 10, overflow: 'hidden' }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 38, height: 38, border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: C.gray }}>−</button>
                <span style={{ width: 44, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock_quantity, q + 1))} style={{ width: 38, height: 38, border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: C.gray }}>+</button>
              </div>
              <span style={{ fontSize: 13, color: inStock ? C.success : C.error, fontWeight: 600 }}>{inStock ? `Còn ${product.stock_quantity} sp` : 'Hết hàng'}</span>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
              <button onClick={handleAddToCart} disabled={!inStock} className="btn btn-outline btn-lg" style={{ flex: 1 }}>{addedMsg ? '✓ Đã thêm!' : 'Thêm vào giỏ'}</button>
              <button onClick={handleBuyNow} disabled={!inStock} className="btn btn-primary btn-lg" style={{ flex: 1 }}>Mua ngay</button>
            </div>

            {/* Shop card */}
            {(product as any).shop_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '8px 12px' }}>
                <Link to={`/shops/${product.shop_id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg,#1E3A8A,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏪</div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: C.navy, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(product as any).shop_name}</p>
                    {(product as any).shop_rating && <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>⭐ {(product as any).shop_rating} · Xem shop</p>}
                  </div>
                </Link>
                <button onClick={() => { if (!isAuthenticated) { navigate('/login'); return }; navigate(`/chat?shop=${product.shop_id}`) }}
                  style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.navy}`, background: 'white', color: C.navy, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  💬 Nhắn tin
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── MÔ TẢ ── */}
        {product.description && (
          <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 16, padding: 28, marginBottom: 28 }}>
            <SectionTitle icon="📋">Mô tả sản phẩm</SectionTitle>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap' }}>{product.description}</div>
          </div>
        )}

        {/* ── ĐÁNH GIÁ ── */}
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 16, padding: 28, marginBottom: 28 }}>
          <SectionTitle icon="⭐">Đánh giá sản phẩm</SectionTitle>
          <div style={{ display: 'flex', gap: 40, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, fontWeight: 900, color: C.gold, lineHeight: 1 }}>
                {reviews.length > 0 ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : (Number(product.rating) || 0).toFixed(1)}
              </div>
              <Stars val={ratingNum} size={20} />
              <p style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>{reviews.length + (product.total_reviews ?? 0)} đánh giá</p>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              {starCounts.map(({ star, count }) => {
                const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                return (
                  <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: C.gray, width: 40, flexShrink: 0 }}>{star} sao</span>
                    <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: pct + '%', height: '100%', background: C.gold, borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: C.gray, width: 20, textAlign: 'right' }}>{count}</span>
                  </div>
                )
              })}
            </div>
            <div>
              {isAuthenticated && (
                <button onClick={() => setShowReviewForm(v => !v)} style={{ padding: '10px 20px', borderRadius: 10, border: `1.5px solid ${C.primary}`, background: showReviewForm ? C.primary : 'white', color: showReviewForm ? 'white' : C.primary, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  ✏️ Viết đánh giá
                </button>
              )}
            </div>
          </div>
          {showReviewForm && isAuthenticated && (
            <ReviewForm productId={Number(id)} userEmail={(user as any)?.email || ''} userName={(user as any)?.full_name || (user as any)?.username || 'Bạn'} onSaved={() => { setReviews(getProductReviews(Number(id))); setShowReviewForm(false) }} />
          )}
          {reviews.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {([0,5,4,3,2,1] as const).map(s => {
                const cnt = s === 0 ? reviews.length : reviews.filter(r => r.rating === s).length
                const active = reviewFilter === s
                return (
                  <button key={s} onClick={() => setReviewFilter(s)} style={{ fontSize: 13, padding: '5px 14px', borderRadius: 20, cursor: 'pointer', border: active ? `1.5px solid ${C.primary}` : '1.5px solid var(--gray-200)', background: active ? '#DBEAFE' : 'white', color: active ? C.primary : C.gray, fontWeight: active ? 700 : 400 }}>
                    {s === 0 ? `Tất cả (${cnt})` : `${s} ⭐ (${cnt})`}
                  </button>
                )
              })}
            </div>
          )}
          {visibleReviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.gray }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
              <p>Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
            </div>
          ) : (
            visibleReviews.map(r => <ReviewCard key={r.id} r={r} />)
          )}
        </div>

        {/* ── SẢN PHẨM KHÁC ── */}
        {shopProducts.length > 0 && (
          <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 16, padding: 28, marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <SectionTitle icon="🏪">Sản phẩm khác của shop</SectionTitle>
              <Link to={`/shops/${product.shop_id}`} style={{ fontSize: 13, color: C.primary, fontWeight: 600, textDecoration: 'none' }}>Xem tất cả →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
              {shopProducts.map((p: any) => <ProductCard key={p.product_id} p={p} onClick={() => navigate(`/products/${p.product_id}`)} />)}
            </div>
          </div>
        )}

        {/* ── GỢI Ý ── */}
        {recommended.length > 0 && (
          <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 16, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <SectionTitle icon="✨">Gợi ý cho bạn</SectionTitle>
              <Link to="/products" style={{ fontSize: 13, color: C.primary, fontWeight: 600, textDecoration: 'none' }}>Xem thêm →</Link>
            </div>

            {/* Grid sản phẩm — key dùng index tránh trùng khi loop */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
              {recommended.map((p: any, idx) => (
                <ProductCard key={`${p.product_id}-${idx}`} p={p} onClick={() => navigate(`/products/${p.product_id}`)} />
              ))}
            </div>

            {/* Loop loading (hết trang → chuẩn bị load lại) */}
            {recLoopLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '24px 0', color: C.gray }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #e5e7eb', borderTopColor: C.primary, animation: 'recSpin 0.7s linear infinite' }} />
                <span style={{ fontSize: 13 }}>Đang làm mới danh sách…</span>
                <style>{`@keyframes recSpin { to { transform: rotate(360deg) } }`}</style>
              </div>
            )}

            {/* Load trang kế bình thường */}
            {recLoadingMore && !recLoopLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '20px 0', color: C.gray }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #e5e7eb', borderTopColor: C.primary, animation: 'recSpin 0.7s linear infinite' }} />
                <span style={{ fontSize: 13 }}>Đang tải thêm gợi ý…</span>
              </div>
            )}

            {/* Sentinel — IntersectionObserver kích hoạt khi kéo đến đây */}
            <div ref={recSentinelRef} style={{ height: 1 }} />
          </div>
        )}

      </div>
    </div>
  )
}

export default ProductDetailPage
