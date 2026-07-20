import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import ProductList from '../components/product/ProductList'
import ProductFilter from '../components/product/ProductFilter'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchProducts, fetchCategories, setFilters, resetFilters } from '../store/slices/productSlice'
import { formatCurrency } from '../utils/formatters'
import { getAllSubmissions, resolveImage } from '../utils/bannerAuctionStore'
import { resolveImageAsync } from '../utils/imageDB'
import API from '../services/api'

// ─── Banner ───────────────────────────────────────────────────────────────────
type BannerItem = { src: string; link?: string; title?: string }
const STATIC_BANNERS: BannerItem[] = [
  { src: '/img/banner_admin/1.png' },
  { src: '/img/banner_admin/2.png' },
  { src: '/img/banner_admin/3.png' },
  { src: '/img/banner_admin/4.png' },
]
const AUTO_MS = 4000
const DUR_MS  = 600

const BannerSlider: React.FC = () => {
  const [banners, setBanners] = useState<BannerItem[]>(STATIC_BANNERS)
  const [cur, setCur]     = useState(0)
  const [next, setNext]   = useState<number | null>(null)
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle')
  const [prog, setProg]   = useState(0)
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const busyRef = useRef(false)

  // Load approved home_slider submissions from store
  const loadApproved = useCallback(() => {
    const subs = getAllSubmissions().filter(s => s.position === 'home_slider' && s.status === 'approved')
    // Resolve all image refs (sync for localStorage, async for IDB)
    Promise.all(subs.map(async s => ({
      src: await resolveImageAsync(s.image) || resolveImage(s.image),
      link: s.link,
      title: s.title,
    }))).then(approved => {
      const valid = approved.filter(a => a.src) // bỏ banner có src rỗng (ref bị lỗi)
      // Nếu đã có banner admin hợp lệ thì chỉ show chúng, không kèm static
      setBanners(valid.length > 0 ? valid : STATIC_BANNERS)
    })
  }, [])

  useEffect(() => {
    loadApproved()
    // Tự cập nhật khi admin duyệt banner (localStorage thay đổi từ tab khác)
    window.addEventListener('storage', loadApproved)
    return () => window.removeEventListener('storage', loadApproved)
  }, [loadApproved])

  const go = useCallback((to: number, total: number) => {
    if (busyRef.current || total === 0) return
    busyRef.current = true
    const nxt = (to + total) % total
    setNext(nxt)
    setPhase('out')
    setTimeout(() => {
      setPhase('in')
      setTimeout(() => { setCur(nxt); setNext(null); setPhase('idle'); busyRef.current = false }, DUR_MS)
    }, DUR_MS * 0.6)
  }, [])

  const advance = useCallback(() => go(cur + 1, banners.length), [cur, go, banners.length])

  const resetAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current)
    if (progRef.current) clearInterval(progRef.current)
    setProg(0)
    const step = 50; let elapsed = 0
    progRef.current = setInterval(() => { elapsed += step; setProg(Math.min(100, (elapsed / AUTO_MS) * 100)) }, step)
    autoRef.current = setInterval(() => { elapsed = 0; setProg(0); advance() }, AUTO_MS)
  }, [advance])

  useEffect(() => { resetAuto(); return () => { clearInterval(autoRef.current!); clearInterval(progRef.current!) } }, [resetAuto])

  const handleGo  = (dir: number) => { go(cur + dir, banners.length); resetAuto() }
  const handleDot = (i: number)   => { if (i !== cur) { go(i, banners.length); resetAuto() } }

  const curStyle = (): React.CSSProperties => {
    if (phase === 'out') return { opacity: 0, transform: 'scale(0.94)', filter: 'blur(3px)', transition: `all ${DUR_MS * 0.6}ms cubic-bezier(0.76,0,0.24,1)` }
    if (phase === 'in')  return { opacity: 0, transform: 'scale(0.94)', filter: 'blur(3px)', transition: 'none' }
    return { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)', transition: 'none' }
  }
  const nxtStyle = (): React.CSSProperties => {
    if (phase === 'in') return { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)', transition: `all ${DUR_MS}ms cubic-bezier(0.76,0,0.24,1)` }
    return { opacity: 0, transform: 'scale(1.06)', filter: 'blur(4px)', transition: 'none' }
  }

  const renderBannerImg = (item: BannerItem, style: React.CSSProperties, extraStyle?: React.CSSProperties) => {
    const img = (
      <img src={item.src} alt={item.title || 'Banner'} className="banner-img"
        style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 480, objectFit: 'cover', ...style, ...extraStyle }} />
    )
    if (item.link) {
      const isExternal = item.link.startsWith('http')
      return isExternal
        ? <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', ...style, ...extraStyle, height: 'auto', maxHeight: 'unset' }}>{img}</a>
        : <Link to={item.link} style={{ display: 'block', ...style, ...extraStyle, height: 'auto', maxHeight: 'unset' }}>{img}</Link>
    }
    return img
  }

  const curBanner = banners[cur] ?? STATIC_BANNERS[0]
  const nxtBanner = next !== null ? (banners[next] ?? null) : null

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#0f0f0f', userSelect: 'none' }}>
      {renderBannerImg(curBanner, { position: 'relative', zIndex: 2, willChange: 'transform,opacity' }, curStyle())}
      {nxtBanner && renderBannerImg(nxtBanner, { position: 'absolute', inset: '0', zIndex: 3, willChange: 'transform,opacity' }, nxtStyle())}
      {(['prev', 'next'] as const).map(d => (
        <button key={d} onClick={() => handleGo(d === 'prev' ? -1 : 1)}
          style={{ position: 'absolute', top: '50%', [d === 'prev' ? 'left' : 'right']: 16, transform: 'translateY(-50%)', zIndex: 10, width: 42, height: 42, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1, backdropFilter: 'blur(4px)', transition: 'background 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.35)')}
        >{d === 'prev' ? '‹' : '›'}</button>
      ))}
      <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 10 }}>
        {banners.map((_, i) => (
          <div key={i} onClick={() => handleDot(i)} style={{ width: i === cur ? 24 : 8, height: 8, borderRadius: 4, background: `rgba(255,255,255,${i === cur ? 0.95 : 0.4})`, cursor: 'pointer', transition: 'all 0.35s cubic-bezier(0.76,0,0.24,1)' }} />
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, background: 'rgba(255,255,255,0.8)', width: `${prog}%`, zIndex: 10, transition: 'width 0.05s linear' }} />
    </div>
  )
}

// ─── Flash Sale (sản phẩm bán chạy thật) ─────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0')
const getFlashEnd = () => {
  const now = new Date(); const end = new Date(now)
  const nextH = Math.ceil((now.getHours() + 0.5) / 2) * 2
  end.setHours(nextH, 0, 0, 0)
  if (end.getTime() - now.getTime() < 60000) end.setHours(end.getHours() + 2)
  return end
}
const useCountdown = (endTime: Date) => {
  const calc = () => { const diff = Math.max(0, endTime.getTime() - Date.now()); return { h: Math.floor(diff/3600000), m: Math.floor((diff%3600000)/60000), s: Math.floor((diff%60000)/1000) } }
  const [tick, setTick] = useState(calc)
  useEffect(() => { const t = setInterval(() => setTick(calc()), 1000); return () => clearInterval(t) }, [endTime])
  return tick
}

const FlashSaleSection: React.FC = () => {
  const [endTime] = useState(getFlashEnd)
  const { h, m, s } = useCountdown(endTime)
  const [items, setItems] = useState<any[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' })

  useEffect(() => {
    API.get('/api/v1/products', { params: { limit: 12, sort: 'popular' } })
      .then(r => setItems(r.data.products ?? []))
      .catch(() => {})
  }, [])

  // Nếu không có sản phẩm thật → không hiện section
  if (items.length === 0) return null

  return (
    <div style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 40%, #b91c1c 100%)', padding: '28px 0', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>⚡</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -0.5, lineHeight: 1.1 }}>FLASH SALE</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>Bán chạy nhất hôm nay</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>Cập nhật sau:</span>
            {[pad(h), pad(m), pad(s)].map((v, i) => (
              <React.Fragment key={i}>
                <div style={{ background: '#1a1a1a', color: '#fff', fontWeight: 800, fontSize: 20, borderRadius: 8, padding: '6px 10px', minWidth: 44, textAlign: 'center', fontVariantNumeric: 'tabular-nums', letterSpacing: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>{v}</div>
                {i < 2 && <span style={{ color: '#fca5a5', fontWeight: 900, fontSize: 20 }}>:</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => scroll(-1)} style={{ position: 'absolute', left: -16, top: '50%', transform: 'translateY(-50%)', zIndex: 5, width: 36, height: 36, borderRadius: '50%', background: '#fff', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.3)', cursor: 'pointer', fontSize: 18, color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={() => scroll(1)}  style={{ position: 'absolute', right: -16, top: '50%', transform: 'translateY(-50%)', zIndex: 5, width: 36, height: 36, borderRadius: '50%', background: '#fff', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.3)', cursor: 'pointer', fontSize: 18, color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          <div ref={scrollRef} style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {items.map((item: any) => (
              <Link key={item.product_id} to={`/products/${item.product_id}`} style={{ textDecoration: 'none', flexShrink: 0, width: 172 }}>
                <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)' }}>
                  <div style={{ position: 'relative', background: '#f3f4f6', height: 148, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.image_urls?.[0]
                      ? <img src={item.image_urls[0]} alt={item.product_name} style={{ width: '100%', height: 148, objectFit: 'cover', display: 'block' }} />
                      : <span style={{ fontSize: 48 }}>📦</span>
                    }
                    <div style={{ position: 'absolute', top: 8, left: 8, background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 11, padding: '3px 8px', borderRadius: 20 }}>⚡ HOT</div>
                  </div>
                  <div style={{ padding: '10px 10px 12px' }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#111', lineHeight: 1.4, marginBottom: 6, height: 32, overflow: 'hidden' }}>{item.product_name}</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#ef4444', margin: '0 0 4px' }}>{formatCurrency(parseFloat(item.price))}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>⭐ {item.rating} · Đã bán {item.sales_count}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Banner quang cao tren BuyZo Mall ─────────────────────────────────────────
const STATIC_MALL_ADS = [
  '/img/banner_admin/mall_main_1.png',
  '/img/banner_admin/mall_main_2.png',
  '/img/banner_admin/mall_main_3.png',
  '/img/banner_admin/mall_main_4.png',
  '/img/banner_admin/mall_main_5.png',
]
const STATIC_MALL_FIXED = '/img/banner_admin/mall_fixed_1.png'
const MALL_AD_AUTO_MS = 3500

type MallAdItem = { src: string; link?: string }

const MallAdBanner: React.FC = () => {
  const [cur,      setCur]      = useState(0)
  const [fixedCur, setFixedCur] = useState(0)
  const [mainAds,  setMainAds]  = useState<MallAdItem[]>(STATIC_MALL_ADS.map(src => ({ src })))
  const [fixedAds, setFixedAds] = useState<MallAdItem[]>([{ src: STATIC_MALL_FIXED }])

  const loadMallAds = useCallback(() => {
    const subs   = getAllSubmissions().filter(s => s.status === 'approved')
    const mains  = subs.filter(s => s.position === 'mall_ads_main')
    const fixeds = subs.filter(s => s.position === 'mall_ads_fixed')

    // Phần 7 (main)
    Promise.all(mains.map(async s => ({ src: await resolveImageAsync(s.image) || resolveImage(s.image), link: s.link })))
      .then(main => {
        const valid = main.filter(m => m.src)
        setMainAds(valid.length > 0 ? valid : STATIC_MALL_ADS.map(src => ({ src })))
      })

    // Phần 3 (fixed) — hỗ trợ nhiều ảnh như phần 7
    Promise.all(fixeds.map(async s => ({ src: await resolveImageAsync(s.image) || resolveImage(s.image), link: s.link })))
      .then(fixed => {
        const valid = fixed.filter(f => f.src)
        setFixedAds(valid.length > 0 ? valid : [{ src: STATIC_MALL_FIXED }])
      })
  }, [])

  useEffect(() => {
    loadMallAds()
    window.addEventListener('storage', loadMallAds)
    return () => window.removeEventListener('storage', loadMallAds)
  }, [loadMallAds])

  // Auto-slide phần 7
  useEffect(() => {
    if (mainAds.length <= 1) return
    const id = setInterval(() => setCur(c => (c + 1) % mainAds.length), MALL_AD_AUTO_MS)
    return () => clearInterval(id)
  }, [mainAds.length])

  // Auto-slide phần 3
  useEffect(() => {
    if (fixedAds.length <= 1) return
    const id = setInterval(() => setFixedCur(c => (c + 1) % fixedAds.length), MALL_AD_AUTO_MS + 500)
    return () => clearInterval(id)
  }, [fixedAds.length])

  const wrapLink = (content: React.ReactNode, link?: string, key?: string | number) =>
    link ? (
      link.startsWith('http') || link.startsWith('//')
        ? <a key={key} href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', position: 'absolute', inset: 0 }}>{content}</a>
        : <Link key={key} to={link} style={{ display: 'block', position: 'absolute', inset: 0 }}>{content}</Link>
    ) : <>{content}</>

  return (
    <div style={{ display: 'flex', gap: 12, width: '100%', height: 400 }}>
      {/* Trái 7 phần - banner chạy (mall_ads_main) */}
      <div style={{ position: 'relative', flex: 7, height: '100%', overflow: 'hidden', borderRadius: 14, background: '#0f0f0f' }}>
        {mainAds.map((ad, i) => (
          <img key={ad.src + i} src={ad.src} alt={`Quang cao ${i + 1}`} className="banner-img"
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              opacity: i === cur ? 1 : 0, transition: 'opacity 0.6s ease',
            }} />
        ))}
        {mainAds[cur]?.link && wrapLink(null, mainAds[cur].link)}
        <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5, zIndex: 2 }}>
          QUẢNG CÁO
        </div>
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 2 }}>
          {mainAds.map((_, i) => (
            <div key={i} onClick={() => setCur(i)} style={{ width: i === cur ? 18 : 6, height: 6, borderRadius: 3, background: `rgba(255,255,255,${i === cur ? 0.95 : 0.4})`, cursor: 'pointer', transition: 'all 0.3s' }} />
          ))}
        </div>
      </div>

      {/* Phải 3 phần - banner center phần 3 (mall_ads_fixed) — hỗ trợ nhiều ảnh */}
      <div style={{ position: 'relative', flex: 3, height: '100%', overflow: 'hidden', borderRadius: 14, background: '#0f0f0f' }}>
        {fixedAds.map((ad, i) => (
          <img key={ad.src + i} src={ad.src} alt={`Banner phần 3 - ${i + 1}`} className="banner-img"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: i === fixedCur ? 1 : 0, transition: 'opacity 0.6s ease' }} />
        ))}
        {fixedAds[fixedCur]?.link && wrapLink(null, fixedAds[fixedCur].link)}
        {fixedAds.length > 1 && (
          <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 2 }}>
            {fixedAds.map((_, i) => (
              <div key={i} onClick={() => setFixedCur(i)} style={{ width: i === fixedCur ? 16 : 6, height: 6, borderRadius: 3, background: `rgba(255,255,255,${i === fixedCur ? 0.95 : 0.4})`, cursor: 'pointer', transition: 'all 0.3s' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── BuyZo Mall ───────────────────────────────────────────────────────────────
const MALL_MOCK = [
  { name: 'LOreal Paris',   promo: 'Ưu đãi đến 50%',   img: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&h=200&fit=crop' },
  { name: 'Unilever',       promo: 'Mua 1 tặng 1',      img: 'https://images.unsplash.com/photo-1526045612212-70caf35c14df?w=200&h=200&fit=crop' },
  { name: 'Samsung',        promo: 'Giảm đến 30%',      img: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=200&h=200&fit=crop' },
  { name: 'Coolmate',       promo: 'Mua 1 tặng 1',      img: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=200&h=200&fit=crop' },
  { name: 'Cocoon',         promo: 'Mua 1 tặng 1',      img: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=200&h=200&fit=crop' },
  { name: 'Vaseline',       promo: 'Combo tiết kiệm',   img: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=200&h=200&fit=crop' },
  { name: 'La Roche-Posay', promo: 'Mua là có quà',     img: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&h=200&fit=crop' },
  { name: 'CeraVe',         promo: 'Mua 1 được 6',      img: 'https://images.unsplash.com/photo-1631730486784-74757276baa5?w=200&h=200&fit=crop' },
]


const STATIC_MALL_BANNER_ADS: MallAdItem[] = [
  { src: '/img/banner_admin/mall_banner_1.png' },
  { src: '/img/banner_admin/mall_banner_2.png' },
  { src: '/img/banner_admin/mall_banner_3.png' },
]

const BuyZoMallSection: React.FC = () => {
  const [apiItems, setApiItems] = useState<any[]>([])

  // Panel trái — Banner Mall (Hình 4): admin upload hoặc fallback ảnh mẫu
  const [mallBannerAds, setMallBannerAds] = useState<MallAdItem[]>(STATIC_MALL_BANNER_ADS)
  const [mallBannerCur, setMallBannerCur] = useState(0)

  const loadMallBannerAds = useCallback(() => {
    const subs = getAllSubmissions().filter(s => s.status === 'approved' && s.position === 'mall_banner')
    Promise.all(subs.map(async s => ({ src: await resolveImageAsync(s.image) || resolveImage(s.image), link: s.link })))
      .then(ads => {
        const valid = ads.filter(a => a.src)
        setMallBannerAds(valid.length > 0 ? valid : STATIC_MALL_BANNER_ADS)
      })
  }, [])

  useEffect(() => {
    loadMallBannerAds()
    window.addEventListener('storage', loadMallBannerAds)
    return () => window.removeEventListener('storage', loadMallBannerAds)
  }, [loadMallBannerAds])

  useEffect(() => {
    if (mallBannerAds.length <= 1) return
    const id = setInterval(() => setMallBannerCur(c => (c + 1) % mallBannerAds.length), 4000)
    return () => clearInterval(id)
  }, [mallBannerAds.length])

  useEffect(() => {
    API.get('/api/v1/products', { params: { limit: 8, sort: 'popular' } })
      .then(r => { const p = r.data.products ?? []; if (p.length > 0) setApiItems(p.slice(0, 8)) })
      .catch(() => {})
  }, [])

  const cells = MALL_MOCK.map((m, i) => {
    const p = apiItems[i]
    return { name: p?.shop_name || m.name, promo: m.promo, img: p?.image_urls?.[0] || m.img, id: p?.product_id ?? null }
  })

  const BORDER = '1px solid #efefef'

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', background: '#fff' }}>

      {/* ── Header bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: BORDER, padding: '0 16px', height: 46, gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 16, borderRight: '1.5px solid #e0e0e0', marginRight: 20, flexShrink: 0 }}>
          <div style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', borderRadius: 6, padding: '3px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12 }}>🏆</span>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 13, letterSpacing: 1 }}>BUYZO MALL</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, flex: 1, alignItems: 'center' }}>
          {[{ icon: '🔄', text: 'Trả Hàng Miễn Phí 30 Ngày' }, { icon: '✅', text: 'Hàng Chính Hãng 100%' }, { icon: '🚚', text: 'Miễn Phí Vận Chuyển' }].map(b => (
            <span key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#4b5563', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {b.icon} {b.text}
            </span>
          ))}
        </div>
        <Link to="/mall" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, color: '#7C3AED', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Xem Tất Cả <span style={{ fontSize: 17, lineHeight: 1 }}>›</span>
        </Link>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex' }}>
        {/* Left panel — Banner Mall (Hình 4) */}
        <div style={{ width: 240, flexShrink: 0, position: 'relative', borderRight: BORDER }}>
          <div style={{ width: 240, height: '100%', minHeight: 320, position: 'relative', overflow: 'hidden', background: '#0f0f0f' }}>
            {mallBannerAds.map((ad, i) => (
              <img key={ad.src + i} src={ad.src} alt={`Banner Mall ${i + 1}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                  opacity: i === mallBannerCur ? 1 : 0, transition: 'opacity 0.6s ease' }} />
            ))}
            {mallBannerAds[mallBannerCur]?.link && (
              <a href={mallBannerAds[mallBannerCur].link} target="_blank" rel="noopener noreferrer"
                style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            )}
          </div>
          {mallBannerAds.length > 1 && (
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
              {mallBannerAds.map((_, i) => (
                <div key={i} onClick={() => setMallBannerCur(i)}
                  style={{ cursor: 'pointer', width: i === mallBannerCur ? 16 : 6, height: 6, borderRadius: 3,
                    background: i === mallBannerCur ? '#fff' : 'rgba(255,255,255,0.45)', transition: 'all 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              ))}
            </div>
          )}
        </div>

        {/* Right 2×4 grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridTemplateRows: 'repeat(2,1fr)' }}>
          {cells.map((c, i) => {
            const isLastRow = i >= 4
            const isFirstCol = i % 4 === 0
            return (
              <Link key={i} to={c.id ? `/products/${c.id}` : '/mall'} style={{
                textDecoration: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '20px 12px 16px',
                borderLeft: isFirstCol ? 'none' : BORDER,
                borderBottom: isLastRow ? 'none' : BORDER,
                gap: 10, background: '#fff', transition: 'background 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = '#faf5ff')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <div style={{ width: 80, height: 80, borderRadius: 10, overflow: 'hidden', background: '#f3f4f6', flexShrink: 0 }}>
                  <img src={c.img} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                </div>
                <div style={{ background: '#f3f4f6', borderRadius: 999, padding: '4px 16px', maxWidth: '100%' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 120, textAlign: 'center' }}>{c.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textAlign: 'center', lineHeight: 1.3 }}>{c.promo}</span>
              </Link>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ─── Sản phẩm mới ────────────────────────────────────────────────────────────
const NewProductsSection: React.FC = () => {
  const [items, setItems] = useState<any[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 210, behavior: 'smooth' })

  useEffect(() => {
    API.get('/api/v1/products', { params: { limit: 12, sort: 'newest' } })
      .then(r => setItems(r.data.products ?? []))
      .catch(() => {})
  }, [])

  if (items.length === 0) return null

  return (
    <div style={{ background: 'var(--bg-page)', padding: '40px 0', borderTop: '1px solid var(--border-subtle)' }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', borderRadius: 20, padding: '4px 12px', marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>🆕</span>
              <span style={{ color: '#059669', fontWeight: 700, fontSize: 12 }}>VỪA ĐƯỢC DUYỆT</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Sản phẩm mới nhất</h2>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => scroll(-1)} style={{ position: 'absolute', left: -16, top: '42%', transform: 'translateY(-50%)', zIndex: 5, width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer', fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={() => scroll(1)}  style={{ position: 'absolute', right: -16, top: '42%', transform: 'translateY(-50%)', zIndex: 5, width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer', fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          <div ref={scrollRef} style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {items.map((item: any) => (
              <Link key={item.product_id} to={`/products/${item.product_id}`} style={{ textDecoration: 'none', flexShrink: 0, width: 180 }}>
                <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 28px rgba(5,150,105,0.14)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
                  <div style={{ background: 'var(--bg-highlight, #f3f4f6)', height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {item.image_urls?.[0]
                      ? <img src={item.image_urls[0]} alt={item.product_name} style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
                      : <span style={{ fontSize: 48 }}>📦</span>
                    }
                    <div style={{ position: 'absolute', top: 8, left: 8, background: '#059669', color: '#fff', fontWeight: 800, fontSize: 10, padding: '3px 8px', borderRadius: 20 }}>🆕 MỚI</div>
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    {item.shop_name && <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, marginBottom: 4 }}>{item.shop_name}</div>}
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 6, height: 34, overflow: 'hidden' }}>{item.product_name}</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#059669', margin: 0 }}>{formatCurrency(parseFloat(item.price))}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────
const Home: React.FC = () => {
  const dispatch = useAppDispatch()
  const [searchParams] = useSearchParams()
  const { products, categories, filters, loading, total, pages, page } = useAppSelector(s => s.product)

  // filterMountedRef: ngăn useEffect[filters] chạy lần render đầu tiên
  const filterMountedRef = useRef(false)

  // On mount: luôn fetch trực tiếp + sync lại Redux filters
  useEffect(() => {
    dispatch(fetchCategories())
    const search = searchParams.get('search')
    const params = { page: 1, limit: 12, sort: 'popular' as const, ...(search ? { search } : {}) }
    dispatch(resetFilters(search ? { search } : undefined))  // sync filters state
    dispatch(fetchProducts(params))                          // luôn fetch, không phụ thuộc cascade
  }, [])

  // Fetch khi filter thay đổi SAU lần mount đầu
  useEffect(() => {
    if (!filterMountedRef.current) { filterMountedRef.current = true; return }
    dispatch(fetchProducts(filters))
  }, [filters, dispatch])

  const handleFilterChange = (key: string, value: any) => {
    dispatch(setFilters({ [key]: value, page: 1 }))
  }

  const productSectionRef = useRef<HTMLDivElement>(null)

  const scrollToProducts = () => {
    productSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      {/* Banner */}
      <div style={{ padding: '16px 0' }}>
        <div className="container"><BannerSlider /></div>
      </div>

      {/* Category quick-filter (lọc tại chỗ) */}
      <div className="section-surface" style={{ padding: '20px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            <button type="button" className="btn btn-primary btn-sm"
              onClick={() => { dispatch(setFilters({ category_id: undefined })); scrollToProducts() }}
              style={{ borderRadius: 'var(--radius-full)', flexShrink: 0 }}>
              Tất cả
            </button>
            {categories.map(cat => (
              <button key={cat.category_id} type="button"
                onClick={() => { dispatch(setFilters({ category_id: cat.category_id, page: 1 })); scrollToProducts() }}
                style={{ flexShrink: 0, padding: '10px 20px', borderRadius: 'var(--radius-full)', border: '1.5px solid var(--border-subtle)', background: filters.category_id === cat.category_id ? 'var(--primary, #7C3AED)' : 'var(--bg-highlight, var(--bg-page))', color: filters.category_id === cat.category_id ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                onMouseEnter={e => { if (filters.category_id !== cat.category_id) { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.background = 'var(--bg-card)' } }}
                onMouseLeave={e => { if (filters.category_id !== cat.category_id) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-highlight, var(--bg-page))' } }}>
                {cat.icon_url || ''} {cat.category_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Flash Sale */}
      <FlashSaleSection />

      {/* Banner quảng cáo trên BuyZo Mall */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '20px 0 0' }}>
        <div className="container"><MallAdBanner /></div>
      </div>

      {/* BuyZo Mall */}
      <div style={{ background: 'var(--bg-page)', padding: '24px 0 32px' }}>
        <div className="container">
          <BuyZoMallSection />
        </div>
      </div>

      {/* Sản phẩm mới nhất */}
      <NewProductsSection />

      {/* Sản phẩm nổi bật + Bộ lọc — cùng 1 section */}
      <div ref={productSectionRef} id="products-section" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-page)' }}>
        <div className="container" style={{ paddingTop: 48, paddingBottom: 56 }}>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.12)', borderRadius: 20, padding: '4px 12px', marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>🌟</span>
                <span style={{ color: '#d97706', fontWeight: 700, fontSize: 12 }}>NỔI BẬT</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Sản phẩm nổi bật</h2>
            </div>
            {total > 0 && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
                Tìm thấy <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> sản phẩm
              </p>
            )}
          </div>

          {/* Filter sidebar + Product grid */}
          <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

            {/* Filter sidebar */}
            <div style={{ width: 230, flexShrink: 0, position: 'sticky', top: 80 }}>
              <ProductFilter
                categories={categories}
                filters={filters}
                onChange={handleFilterChange}
              />
            </div>

            {/* Products + pagination */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <ProductList products={products} loading={loading} />

              {/* Pagination */}
              {pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32, flexWrap: 'wrap' }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => dispatch(setFilters({ page: page - 1 }))}
                    style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--border-subtle)', background: 'var(--bg-card)', color: page <= 1 ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>
                    ← Truoc
                  </button>
                  {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                    const p = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= pages - 3 ? pages - 6 + i : page - 3 + i
                    return (
                      <button key={p}
                        onClick={() => dispatch(setFilters({ page: p }))}
                        style={{ width: 38, height: 38, borderRadius: 8, border: page === p ? 'none' : '1.5px solid var(--border-subtle)', background: page === p ? 'var(--primary, #7C3AED)' : 'var(--bg-card)', color: page === p ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: page === p ? 700 : 400, fontSize: 14 }}>
                        {p}
                      </button>
                    )
                  })}
                  <button
                    disabled={page >= pages}
                    onClick={() => dispatch(setFilters({ page: page + 1 }))}
                    style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--border-subtle)', background: 'var(--bg-card)', color: page >= pages ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? 0.5 : 1 }}>
                    Sau →
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Features */}
      <div className="section-surface" style={{ padding: '48px 0', marginBottom: 32, borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, textAlign: 'center' }}>
            {[
              { icon: '🚚', title: 'Giao hàng nhanh',    desc: 'Vận chuyển toàn quốc, giao trong 2-5 ngày' },
              { icon: '🔒', title: 'Thanh toán an toàn', desc: 'MoMo, VNPay, Chuyển khoản, COD' },
              { icon: '🔄', title: 'Đổi trả dễ dàng',    desc: '7 ngày đổi trả nếu sản phẩm lỗi' },
              { icon: '🎧', title: 'Hỗ trợ 24/7',        desc: 'CSKH sẵn sàng hỗ trợ bạn mọi lúc' },
            ].map(f => (
              <div key={f.title} style={{ padding: '24px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-highlight, var(--gray-50))', border: '1px solid var(--border-subtle)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default Home
