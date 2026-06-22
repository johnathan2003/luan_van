import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import ProductList from '../components/product/ProductList'
import ProductFilter from '../components/product/ProductFilter'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchProducts, fetchCategories, setFilters } from '../store/slices/productSlice'
import { formatCurrency } from '../utils/formatters'

// ─── Banner ───────────────────────────────────────────────────────────────────
const BANNERS = ['/banner/1.png', '/banner/2.png', '/banner/3.png', '/banner/4.png']
const AUTO_MS = 4000
const DUR_MS  = 600

const BannerSlider: React.FC = () => {
  const [cur, setCur]     = useState(0)
  const [next, setNext]   = useState<number | null>(null)
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle')
  const [prog, setProg]   = useState(0)
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const busyRef = useRef(false)

  const go = useCallback((to: number) => {
    if (busyRef.current) return
    busyRef.current = true
    const nxt = (to + BANNERS.length) % BANNERS.length
    setNext(nxt)
    setPhase('out')
    setTimeout(() => {
      setPhase('in')
      setTimeout(() => { setCur(nxt); setNext(null); setPhase('idle'); busyRef.current = false }, DUR_MS)
    }, DUR_MS * 0.6)
  }, [])

  const advance = useCallback(() => go(cur + 1), [cur, go])

  const resetAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current)
    if (progRef.current) clearInterval(progRef.current)
    setProg(0)
    const step = 50; let elapsed = 0
    progRef.current = setInterval(() => { elapsed += step; setProg(Math.min(100, (elapsed / AUTO_MS) * 100)) }, step)
    autoRef.current = setInterval(() => { elapsed = 0; setProg(0); advance() }, AUTO_MS)
  }, [advance])

  useEffect(() => { resetAuto(); return () => { clearInterval(autoRef.current!); clearInterval(progRef.current!) } }, [resetAuto])

  const handleGo  = (dir: number) => { go(cur + dir); resetAuto() }
  const handleDot = (i: number)   => { if (i !== cur) { go(i); resetAuto() } }

  const curStyle = (): React.CSSProperties => {
    if (phase === 'out') return { opacity: 0, transform: 'scale(0.94)', filter: 'blur(3px)', transition: `all ${DUR_MS * 0.6}ms cubic-bezier(0.76,0,0.24,1)` }
    if (phase === 'in')  return { opacity: 0, transform: 'scale(0.94)', filter: 'blur(3px)', transition: 'none' }
    return { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)', transition: 'none' }
  }
  const nxtStyle = (): React.CSSProperties => {
    if (phase === 'in') return { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)', transition: `all ${DUR_MS}ms cubic-bezier(0.76,0,0.24,1)` }
    return { opacity: 0, transform: 'scale(1.06)', filter: 'blur(4px)', transition: 'none' }
  }

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#0f0f0f', userSelect: 'none' }}>
      <img src={BANNERS[cur]} alt={`Banner ${cur + 1}`} className="banner-img"
        style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 480, objectFit: 'cover', position: 'relative', zIndex: 2, willChange: 'transform,opacity', ...curStyle() }} />
      {next !== null && (
        <img src={BANNERS[next]} alt={`Banner ${next + 1}`} className="banner-img"
          style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 480, objectFit: 'cover', position: 'absolute', inset: 0, zIndex: 3, willChange: 'transform,opacity', ...nxtStyle() }} />
      )}
      {(['prev', 'next'] as const).map(d => (
        <button key={d} onClick={() => handleGo(d === 'prev' ? -1 : 1)}
          style={{ position: 'absolute', top: '50%', [d === 'prev' ? 'left' : 'right']: 16, transform: 'translateY(-50%)', zIndex: 10, width: 42, height: 42, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1, backdropFilter: 'blur(4px)', transition: 'background 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.35)')}
        >{d === 'prev' ? '‹' : '›'}</button>
      ))}
      <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 10 }}>
        {BANNERS.map((_, i) => (
          <div key={i} onClick={() => handleDot(i)} style={{ width: i === cur ? 24 : 8, height: 8, borderRadius: 4, background: `rgba(255,255,255,${i === cur ? 0.95 : 0.4})`, cursor: 'pointer', transition: 'all 0.35s cubic-bezier(0.76,0,0.24,1)' }} />
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, background: 'rgba(255,255,255,0.8)', width: `${prog}%`, zIndex: 10, transition: 'width 0.05s linear' }} />
    </div>
  )
}

// ─── Flash Sale ───────────────────────────────────────────────────────────────
interface FlashItem { id: number; name: string; image: string; price: number; originalPrice: number; sold: number; total: number }

const FLASH_ITEMS: FlashItem[] = [
  { id:1,  name:'Tai nghe Sony WH-1000XM5', image:'https://placehold.co/180x180/1a1a2e/ffffff?text=Sony',       price:4990000,  originalPrice:8490000,  sold:312, total:400 },
  { id:2,  name:'Apple Watch Series 9 GPS',  image:'https://placehold.co/180x180/1c1c1e/ffffff?text=Watch',      price:7990000,  originalPrice:11990000, sold:89,  total:150 },
  { id:3,  name:'Giay Nike Air Max 270',     image:'https://placehold.co/180x180/111827/ffffff?text=Nike',       price:1490000,  originalPrice:2990000,  sold:201, total:250 },
  { id:4,  name:'Dau goi Pantene 900ml',     image:'https://placehold.co/180x180/1e3a5f/ffffff?text=Pantene',   price:99000,    originalPrice:185000,   sold:543, total:600 },
  { id:5,  name:'Robot hut bui Xiaomi G10',  image:'https://placehold.co/180x180/1a1a2e/e2e8f0?text=Xiaomi',   price:2990000,  originalPrice:5490000,  sold:67,  total:100 },
  { id:6,  name:'Sua rua mat CeraVe 236ml',  image:'https://placehold.co/180x180/e2e8f0/1a1a2e?text=CeraVe',   price:245000,   originalPrice:395000,   sold:880, total:1000},
  { id:7,  name:'Bep tu Sunhouse SHB 9100',  image:'https://placehold.co/180x180/374151/ffffff?text=Sunhouse', price:1190000,  originalPrice:2200000,  sold:44,  total:80  },
  { id:8,  name:'Nuoc hoa Dior Sauvage 100ml',image:'https://placehold.co/180x180/0f172a/ffffff?text=Dior',    price:2290000,  originalPrice:3800000,  sold:156, total:200 },
]

const getFlashEnd = () => {
  const now = new Date(); const h = now.getHours(); const end = new Date(now)
  const nextH = Math.ceil((h + 0.5) / 2) * 2
  end.setHours(nextH, 0, 0, 0)
  if (end.getTime() - now.getTime() < 60000) end.setHours(end.getHours() + 2)
  return end
}
const pad = (n: number) => String(n).padStart(2, '0')

const useCountdown = (endTime: Date) => {
  const calc = () => { const diff = Math.max(0, endTime.getTime() - Date.now()); return { h: Math.floor(diff/3600000), m: Math.floor((diff%3600000)/60000), s: Math.floor((diff%60000)/1000) } }
  const [tick, setTick] = useState(calc)
  useEffect(() => { const t = setInterval(() => setTick(calc()), 1000); return () => clearInterval(t) }, [endTime])
  return tick
}

const FlashSaleSection: React.FC = () => {
  const [endTime] = useState(getFlashEnd)
  const { h, m, s } = useCountdown(endTime)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' })

  return (
    <div style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 40%, #b91c1c 100%)', padding: '28px 0', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>⚡</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -0.5, lineHeight: 1.1 }}>FLASH SALE</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>Gia sock - So luong co han</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>Ket thuc sau:</span>
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
            {FLASH_ITEMS.map(item => {
              const pct  = Math.round((1 - item.price / item.originalPrice) * 100)
              const sold = Math.round((item.sold / item.total) * 100)
              return (
                <Link key={item.id} to={`/products/${item.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: 172 }}>
                  <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)' }}>
                    <div style={{ position: 'relative', background: '#f3f4f6' }}>
                      <img src={item.image} alt={item.name} style={{ width: '100%', height: 148, objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', top: 8, left: 8, background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 13, padding: '3px 8px', borderRadius: 20 }}>-{pct}%</div>
                    </div>
                    <div style={{ padding: '10px 10px 12px' }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#111', lineHeight: 1.4, marginBottom: 6, height: 32, overflow: 'hidden' }}>{item.name}</p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', margin: '0 0 2px' }}>{formatCurrency(item.price)}</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through', margin: '0 0 8px' }}>{formatCurrency(item.originalPrice)}</p>
                      <div style={{ background: '#fee2e2', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${sold}%`, background: 'linear-gradient(to right, #ef4444, #dc2626)', borderRadius: 4 }} />
                      </div>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0', textAlign: 'right' }}>Da ban {item.sold}/{item.total}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Banner quang cao tren BuyZo Mall ─────────────────────────────────────────
const MALL_ADS = [
  encodeURI('/banner_thueQC/ChatGPT Image Jun 19, 2026, 01_09_11 PM.png'),
  encodeURI('/banner_thueQC/ChatGPT Image Jun 19, 2026, 01_28_18 PM.png'),
  encodeURI('/banner_thueQC/ChatGPT Image Jun 19, 2026, 01_31_52 PM.png'),
]
const MALL_AD_AUTO_MS = 3500

const MALL_AD_FIXED = '/banner/4.png'

const MallAdBanner: React.FC = () => {
  const [cur, setCur] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setCur(c => (c + 1) % MALL_ADS.length), MALL_AD_AUTO_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ display: 'flex', gap: 12, width: '100%', height: 400 }}>
      {/* Trai 7 phan - banner chay */}
      <div style={{ position: 'relative', flex: 7, height: '100%', overflow: 'hidden', borderRadius: 14, background: '#0f0f0f' }}>
        {MALL_ADS.map((src, i) => (
          <img key={src} src={src} alt={`Quang cao ${i + 1}`} className="banner-img"
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              opacity: i === cur ? 1 : 0, transition: 'opacity 0.6s ease',
            }} />
        ))}
        <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5 }}>
          QUẢNG CÁO
        </div>
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
          {MALL_ADS.map((_, i) => (
            <div key={i} onClick={() => setCur(i)} style={{ width: i === cur ? 18 : 6, height: 6, borderRadius: 3, background: `rgba(255,255,255,${i === cur ? 0.95 : 0.4})`, cursor: 'pointer', transition: 'all 0.3s' }} />
          ))}
        </div>
      </div>

      {/* Phai 3 phan - hinh co dinh */}
      <div style={{ position: 'relative', flex: 3, height: '100%', overflow: 'hidden', borderRadius: 14, background: '#0f0f0f' }}>
        <img src={MALL_AD_FIXED} alt="Quang cao co dinh" className="banner-img"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  )
}

// ─── BuyZo Mall ───────────────────────────────────────────────────────────────
const BRANDS = [
  { name: 'Apple',    icon: '🍎', bg: '#1c1c1e', color: '#fff' },
  { name: 'Samsung',  icon: '📱', bg: '#1428A0', color: '#fff' },
  { name: 'Nike',     icon: '👟', bg: '#111',    color: '#fff' },
  { name: 'Adidas',   icon: '⚽', bg: '#000',    color: '#fff' },
  { name: 'Sony',     icon: '🎧', bg: '#0a0a0a', color: '#fff' },
  { name: "L'Oreal",  icon: '💄', bg: '#b71c1c', color: '#fff' },
  { name: 'Unilever', icon: '🧴', bg: '#1a237e', color: '#fff' },
  { name: 'Xiaomi',   icon: '⚡', bg: '#ff6900', color: '#fff' },
]

interface MallItem { id: number; brand: string; name: string; image: string; price: number; originalPrice: number; rating: number; sold: string }
const MALL_ITEMS: MallItem[] = [
  { id:10, brand:'Apple',   name:'iPhone 15 Pro Max 256GB Titan Tu Nhien', image:'https://placehold.co/200x200/1c1c1e/ffffff?text=iPhone15', price:28990000, originalPrice:32990000, rating:4.9, sold:'1.2k' },
  { id:11, brand:'Samsung', name:'Galaxy S24 Ultra 512GB',                 image:'https://placehold.co/200x200/1428A0/ffffff?text=S24Ultra', price:24990000, originalPrice:29990000, rating:4.8, sold:'890'  },
  { id:12, brand:'Nike',    name:'Air Max 270 React - Den/Trang',          image:'https://placehold.co/200x200/111827/ffffff?text=AirMax',   price:2990000,  originalPrice:3990000,  rating:4.7, sold:'3.4k' },
  { id:13, brand:'Sony',    name:'PlayStation 5 Slim Disc Edition',        image:'https://placehold.co/200x200/0a0a0a/ffffff?text=PS5',      price:13990000, originalPrice:15990000, rating:5.0, sold:'567'  },
  { id:14, brand:'Adidas',  name:'Ultra Boost 22 Running Shoes',           image:'https://placehold.co/200x200/222/ffffff?text=UBoost',     price:3490000,  originalPrice:4990000,  rating:4.6, sold:'2.1k' },
  { id:15, brand:'Xiaomi',  name:'Redmi Note 13 Pro 5G 256GB',             image:'https://placehold.co/200x200/ff6900/ffffff?text=Xiaomi',  price:5990000,  originalPrice:7490000,  rating:4.5, sold:'4.8k' },
]

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <span style={{ color: '#f59e0b', fontSize: 11 }}>
    {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
    <span style={{ color: '#6b7280', marginLeft: 3 }}>{rating}</span>
  </span>
)

const BuyZoMallSection: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' })

  return (
    <div style={{ background: 'var(--bg-page)', padding: '48px 0' }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)', borderRadius: 20, padding: '4px 14px', marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>🏆</span>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>BUYZO MALL</span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px', lineHeight: 1.2 }}>
              Hang chinh hang <span style={{ color: '#7C3AED' }}>100%</span>
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>San pham tu cac thuong hieu lon, duoc xac nhan chinh hang boi BuyZo</p>
          </div>
          <Link to="/mall" style={{ padding: '9px 22px', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', color: '#fff', borderRadius: 24, fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(124,58,237,0.35)', flexShrink: 0 }}>Kham pha Mall →</Link>
        </div>

        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', marginBottom: 28, paddingBottom: 6, scrollbarWidth: 'none' }}>
          {BRANDS.map(b => (
            <button key={b.name}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '12px 18px', borderRadius: 12, background: 'var(--bg-card)', border: '1.5px solid var(--border-subtle)', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s', minWidth: 80 }}
              onMouseEnter={e => { e.currentTarget.style.background = b.bg; e.currentTarget.style.borderColor = 'transparent'; const s = e.currentTarget.querySelectorAll('span'); s[1] && ((s[1] as HTMLElement).style.color = b.color) }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; const s = e.currentTarget.querySelectorAll('span'); s[1] && ((s[1] as HTMLElement).style.color = 'var(--text-primary)') }}>
              <span style={{ fontSize: 24 }}>{b.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', transition: 'color 0.2s' }}>{b.name}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          {[{ icon: '✅', text: 'Hang chinh hang 100%' }, { icon: '🔄', text: 'Doi tra 30 ngay' }, { icon: '🛡️', text: 'Bao hanh chinh hang' }, { icon: '🚚', text: 'Giao hang uu tien' }].map(b => (
            <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 20, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
              <span>{b.icon}</span>{b.text}
            </div>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={() => scroll(-1)} style={{ position: 'absolute', left: -18, top: '42%', transform: 'translateY(-50%)', zIndex: 5, width: 38, height: 38, borderRadius: '50%', background: 'var(--bg-card)', border: '1.5px solid var(--border-subtle)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', cursor: 'pointer', fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={() => scroll(1)}  style={{ position: 'absolute', right: -18, top: '42%', transform: 'translateY(-50%)', zIndex: 5, width: 38, height: 38, borderRadius: '50%', background: 'var(--bg-card)', border: '1.5px solid var(--border-subtle)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', cursor: 'pointer', fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          <div ref={scrollRef} style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
            {MALL_ITEMS.map(item => {
              const pct = Math.round((1 - item.price / item.originalPrice) * 100)
              return (
                <Link key={item.id} to={`/products/${item.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: 200 }}>
                  <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-5px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(124,58,237,0.18)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#7C3AED' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)' }}>
                    <div style={{ position: 'relative', background: 'var(--bg-highlight, #f3f4f6)' }}>
                      <img src={item.image} alt={item.name} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', top: 8, left: 8, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', color: '#fff', fontWeight: 800, fontSize: 10, padding: '3px 7px', borderRadius: 20 }}>🏆 MALL</div>
                      {pct > 0 && <div style={{ position: 'absolute', top: 8, right: 8, background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 11, padding: '3px 7px', borderRadius: 20 }}>-{pct}%</div>}
                    </div>
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.brand}</div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 8, height: 36, overflow: 'hidden' }}>{item.name}</p>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary, #7C3AED)' }}>{formatCurrency(item.price)}</span>
                        {item.originalPrice > item.price && <span style={{ fontSize: 11, color: 'var(--text-secondary)', textDecoration: 'line-through' }}>{formatCurrency(item.originalPrice)}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Stars rating={item.rating} />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Da ban {item.sold}</span>
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', background: 'rgba(124,58,237,0.07)', borderRadius: 6, border: '1px solid rgba(124,58,237,0.2)' }}>
                        <span style={{ fontSize: 11 }}>✅</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED' }}>Chinh hang BuyZo dam bao</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
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

  // On mount: pick up ?search= from URL (e.g. from navbar search)
  useEffect(() => {
    dispatch(fetchCategories())
    const search = searchParams.get('search')
    if (search) {
      dispatch(setFilters({ search }))
    } else {
      dispatch(fetchProducts({ page: 1, limit: 12, sort: 'popular' }))
    }
  }, [])

  useEffect(() => {
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
              Tat ca
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

      {/* Banner quang cao tren BuyZo Mall */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '20px 0 0' }}>
        <div className="container"><MallAdBanner /></div>
      </div>

      {/* BuyZo Mall */}
      <div>
        <BuyZoMallSection />
      </div>

      {/* San pham noi bat + Bo loc — cung 1 section */}
      <div ref={productSectionRef} id="products-section" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-page)' }}>
        <div className="container" style={{ paddingTop: 48, paddingBottom: 56 }}>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.12)', borderRadius: 20, padding: '4px 12px', marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>🌟</span>
                <span style={{ color: '#d97706', fontWeight: 700, fontSize: 12 }}>NOI BAT</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>San pham noi bat</h2>
            </div>
            {total > 0 && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
                Tim thay <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> san pham
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
              { icon: '🚚', title: 'Giao hang nhanh',    desc: 'Van chuyen toan quoc, giao trong 2-5 ngay' },
              { icon: '🔒', title: 'Thanh toan an toan', desc: 'MoMo, VNPay, Chuyen khoan, COD' },
              { icon: '🔄', title: 'Doi tra de dang',    desc: '7 ngay doi tra neu san pham loi' },
              { icon: '🎧', title: 'Ho tro 24/7',        desc: 'CSKH san sang ho tro ban moi luc' },
            ].map(f => (
              <div key={f.title} style={{ padding: '24px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-highlight, var(--gray-50))', border: '1px solid var(--border-subtle)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)', fontSize: 15 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
export default Home

