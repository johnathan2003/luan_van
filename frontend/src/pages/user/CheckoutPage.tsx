import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { formatCurrency } from '../../utils/formatters'
import { voucherService } from '../../services/voucherService'
import { getXu, spendXu, grantPostPurchaseGifts, type PostPurchaseGift } from '../../utils/eventsStore'
import { orderService } from '../../services/orderService'
import { useAppDispatch } from '../../store/hooks'
import { clearCart } from '../../store/slices/cartSlice'

// ─── Voucher auto-apply helpers ────────────────────────────────────────────────
import type { VoucherLite } from '../../types/voucher'

const isVoucherEligible = (v: VoucherLite, subtotal: number) => {
  if (subtotal <= 0) return false
  if (v.status !== 'active') return false
  if (v.valid_to && new Date(v.valid_to) < new Date()) return false
  if (v.max_uses != null && v.current_uses >= v.max_uses) return false
  if (v.min_order_value && subtotal < Number(v.min_order_value)) return false
  return true
}

const voucherDiscountAmount = (v: VoucherLite, subtotal: number) => {
  if (v.discount_type === 'percentage') {
    let d = subtotal * (Number(v.discount_value) / 100)
    if (v.max_discount) d = Math.min(d, Number(v.max_discount))
    return Math.round(d)
  }
  return Math.min(Number(v.discount_value), subtotal)
}

// Chi chon 1 ma cao nhat (voucher san cong don voi 1 ma shop cao nhat)
const pickBestVoucher = (vouchers: VoucherLite[], subtotal: number): { voucher: VoucherLite; amount: number } | null => {
  const eligible = vouchers.filter(v => isVoucherEligible(v, subtotal))
  if (eligible.length === 0) return null
  return eligible
    .map(v => ({ voucher: v, amount: voucherDiscountAmount(v, subtotal) }))
    .sort((a, b) => b.amount - a.amount)[0]
}

// ─── Cart items từ CartPage (navigate state) ─────────────────────────────────
interface OrderItem {
  id: number; shopId: number; shopName: string; shopIcon: string
  name: string; variant: string; image: string
  price: number; originalPrice: number; quantity: number
}

// ─── Types cho provinces API ──────────────────────────────────────────────────
interface ProvinceItem { code: number; name: string }
interface DistrictItem { code: number; name: string }
interface WardItem    { code: number; name: string }
const GEO_API = 'https://provinces.open-api.vn/api'

const PAYMENT_METHODS = [
  { id: 'cod',         icon: '💵', label: 'Thanh toan khi nhan hang (COD)', sub: 'Tra tien mat khi nhan duoc hang' },
  { id: 'vnpay',       icon: '🏦', label: 'Thanh toan VNPay',               sub: 'Chuyen khoan qua ATM / Internet Banking / VNPay' },
  { id: 'momo',        icon: '🟣', label: 'Vi MoMo',                        sub: 'Thanh toan nhanh qua vi MoMo' },
  { id: 'credit_card', icon: '💳', label: 'The tin dung / Ghi no',          sub: 'Visa, Mastercard, JCB' },
]

// ─── Form types ───────────────────────────────────────────────────────────────
interface AddressForm {
  name: string; phone: string; province: string
  district: string; ward: string; street: string; note: string
}

const EMPTY_FORM: AddressForm = { name: '', phone: '', province: '', district: '', ward: '', street: '', note: '' }

const ERR_BORDER = '1.5px solid #EF4444'
const DEF_BORDER = '1.5px solid var(--border-subtle)'

// ─── Inline SVGs ──────────────────────────────────────────────────────────────
const ICheck  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>
const IEdit   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11,4H4a2,2,0,0,0-2,2V18a2,2,0,0,0,2,2H16a2,2,0,0,0,2-2V11"/><path d="M18.5,2.5a2.121,2.121,0,0,1,3,3L12,15l-4,1,1-4Z"/></svg>
const ITruck  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>

// ─── Steps indicator ──────────────────────────────────────────────────────────
const Steps: React.FC<{ current: number }> = ({ current }) => {
  const steps = ['Dia chi giao hang', 'Xac nhan & Thanh toan', 'Hoan thanh']
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, gap: 0 }}>
      {steps.map((s, i) => {
        const done    = i < current
        const active  = i === current
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none',
                background: done ? '#16A34A' : active ? 'var(--primary, #7C3AED)' : 'var(--border-subtle)',
                color: done || active ? '#fff' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, flexShrink: 0,
                boxShadow: active ? '0 0 0 4px rgba(124,58,237,0.18)' : 'none',
                transition: 'all 0.25s',
              }}>
                {done ? <ICheck /> : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? 'var(--primary, #7C3AED)' : done ? '#16A34A' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < current ? '#16A34A' : 'var(--border-subtle)', margin: '0 8px', marginBottom: 22, minWidth: 48, transition: 'background 0.3s' }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Field helper ─────────────────────────────────────────────────────────────
const inputStyle = (err?: boolean): React.CSSProperties => ({
  width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, outline: 'none',
  border: err ? ERR_BORDER : DEF_BORDER,
  background: 'var(--bg-surface, var(--bg-page))', color: 'var(--text-primary)',
  boxSizing: 'border-box',
})
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 5, display: 'block' }
const errStyle:   React.CSSProperties = { fontSize: 12, color: '#EF4444', marginTop: 4 }

// ─── Main ─────────────────────────────────────────────────────────────────────
const CheckoutPage: React.FC = () => {
  const navigate  = useNavigate()
  const location  = useLocation()
  const dispatch  = useAppDispatch()

  // Nhận cart items từ CartPage qua navigate state
  const cartItems = (location.state as any)?.cartItems as Array<{
    cart_id: number; product_id: number; product_name?: string
    product_image?: string; price: number; quantity: number
    shop_id?: number; shop_name?: string
  }> | undefined

  // Map sang OrderItem format
  const ORDER_ITEMS: OrderItem[] = (cartItems || []).map(i => ({
    id: i.product_id,
    shopId: i.shop_id ?? 0,
    shopName: i.shop_name ?? 'Shop',
    shopIcon: '🏪',
    name: i.product_name ?? `San pham #${i.product_id}`,
    variant: '',
    image: i.product_image ?? '',
    price: i.price,
    originalPrice: i.price,
    quantity: i.quantity,
  }))
  const [step,   setStep]   = useState(0)   // 0=address 1=confirm 2=done
  const [form,   setForm]   = useState<AddressForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<AddressForm>>({})
  const [payment, setPayment] = useState('cod')

  // ─── Provinces API state ──────────────────────────────────────────────────
  const [provinces,  setProvinces]  = useState<ProvinceItem[]>([])
  const [districts,  setDistricts]  = useState<DistrictItem[]>([])
  const [wards,      setWards]      = useState<WardItem[]>([])
  const [provinceCode, setProvinceCode] = useState<number | null>(null)
  const [districtCode, setDistrictCode] = useState<number | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)

  useEffect(() => {
    fetch(`${GEO_API}/p/`)
      .then(r => r.json())
      .then((data: ProvinceItem[]) => setProvinces(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (provinceCode == null) { setDistricts([]); setWards([]); return }
    setGeoLoading(true)
    fetch(`${GEO_API}/p/${provinceCode}?depth=2`)
      .then(r => r.json())
      .then((data: { districts: DistrictItem[] }) => setDistricts(data.districts || []))
      .catch(() => setDistricts([]))
      .finally(() => setGeoLoading(false))
  }, [provinceCode])

  useEffect(() => {
    if (districtCode == null) { setWards([]); return }
    setGeoLoading(true)
    fetch(`${GEO_API}/d/${districtCode}?depth=2`)
      .then(r => r.json())
      .then((data: { wards: WardItem[] }) => setWards(data.wards || []))
      .catch(() => setWards([]))
      .finally(() => setGeoLoading(false))
  }, [districtCode])
  const [placing, setPlacing] = useState(false)
  const [orderId, setOrderId] = useState(() => 'BZ' + Date.now().toString().slice(-8))
  const [orderError, setOrderError] = useState<string | null>(null)
  const [myVouchers, setMyVouchers] = useState<VoucherLite[]>([])
  // undefined = chua khoi tao (cho data), null = nguoi dung chon "khong dung voucher"
  const [platformVoucherId, setPlatformVoucherId] = useState<number | null | undefined>(undefined)
  const [shopVoucherIds, setShopVoucherIds]       = useState<Record<number, number | null | undefined>>({})
  // dung xu BuyZo de tru vao tien (1 xu = 1 dong)
  const [useXu, setUseXu] = useState(false)
  const [xuBalance, setXuBalance] = useState(() => getXu())
  const [appliedXu, setAppliedXu] = useState(0) // so xu da thuc su tru khi dat hang xong
  const [postGifts, setPostGifts] = useState<PostPurchaseGift[]>([]) // qua tang hau mai sau khi dat hang

  useEffect(() => {
    voucherService.getMyVouchers()
      .then(res => setMyVouchers(res.data.vouchers || []))
      .catch(() => {})
  }, [])

  const set = (k: keyof AddressForm, v: string) => {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'province') { next.district = ''; next.ward = '' }
      if (k === 'district') { next.ward = '' }
      return next
    })
    setErrors(e => ({ ...e, [k]: '' }))
  }

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = e.target.selectedOptions[0]
    const code = opt ? Number(opt.dataset.code) : null
    set('province', e.target.value)
    setProvinceCode(code)
    setDistrictCode(null)
    setDistricts([])
    setWards([])
  }

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = e.target.selectedOptions[0]
    const code = opt ? Number(opt.dataset.code) : null
    set('district', e.target.value)
    setDistrictCode(code)
    setWards([])
  }

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    set('ward', e.target.value)
  }

  // ── Validate step 1 ──
  const validate = () => {
    const e: Partial<AddressForm> = {}
    if (!form.name.trim())     e.name     = 'Vui long nhap ho va ten'
    if (!/^(0|\+84)[3-9]\d{8}$/.test(form.phone.trim())) e.phone = 'So dien thoai khong hop le'
    if (!form.province)        e.province = 'Vui long chon tinh/thanh'
    if (!form.district)        e.district = 'Vui long chon quan/huyen'
    if (!form.ward)            e.ward     = 'Vui long chon phuong/xa'
    if (!form.street.trim())   e.street   = 'Vui long nhap dia chi cu the'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const subtotal   = ORDER_ITEMS.reduce((s, i) => s + i.price * i.quantity, 0)
  const origTotal  = ORDER_ITEMS.reduce((s, i) => s + i.originalPrice * i.quantity, 0)
  const saved      = origTotal - subtotal

  // ── Voucher: goi y tot nhat ban dau, nguoi dung co the doi y theo so thich ──
  const orderShopIds = [...new Set(ORDER_ITEMS.map(i => i.shopId))]
  const shopSubtotal = (sid: number) => ORDER_ITEMS.filter(i => i.shopId === sid).reduce((s, i) => s + i.price * i.quantity, 0)

  const eligiblePlatformVouchers = myVouchers
    .filter(v => v.source === 'platform' && isVoucherEligible(v, subtotal))
    .map(v => ({ voucher: v, amount: voucherDiscountAmount(v, subtotal) }))
    .sort((a, b) => b.amount - a.amount)

  const eligibleShopVouchers = (sid: number, shopName: string) => {
    const sSubtotal = shopSubtotal(sid)
    return myVouchers
      .filter(v => v.source === 'shop' && v.shop_name === shopName && isVoucherEligible(v, sSubtotal))
      .map(v => ({ voucher: v, amount: voucherDiscountAmount(v, sSubtotal) }))
      .sort((a, b) => b.amount - a.amount)
  }

  // Khoi tao lan dau bang voucher giam nhieu nhat — chi 1 lan, sau do de nguoi dung tu chon
  useEffect(() => {
    if (myVouchers.length === 0) return
    setPlatformVoucherId(prev => prev !== undefined ? prev : (eligiblePlatformVouchers[0]?.voucher.voucher_id ?? null))
    setShopVoucherIds(prev => {
      const next = { ...prev }
      orderShopIds.forEach(sid => {
        if (next[sid] !== undefined) return
        const info = ORDER_ITEMS.find(i => i.shopId === sid)!
        next[sid] = eligibleShopVouchers(sid, info.shopName)[0]?.voucher.voucher_id ?? null
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myVouchers])

  const platformSelected = platformVoucherId ? myVouchers.find(v => v.voucher_id === platformVoucherId) || null : null
  const platformAmount   = platformSelected ? voucherDiscountAmount(platformSelected, subtotal) : 0
  const platformBest     = platformSelected ? { voucher: platformSelected, amount: platformAmount } : null

  const shopBests = orderShopIds
    .map(sid => {
      const info = ORDER_ITEMS.find(i => i.shopId === sid)!
      const vid  = shopVoucherIds[sid]
      if (!vid) return null
      const v = myVouchers.find(vv => vv.voucher_id === vid)
      if (!v) return null
      return { sid, shopName: info.shopName, voucher: v, amount: voucherDiscountAmount(v, shopSubtotal(sid)) }
    })
    .filter((x): x is { sid: number; shopName: string; voucher: VoucherLite; amount: number } => x !== null)

  const voucherDiscount = platformAmount + shopBests.reduce((s, x) => s + x.amount, 0)

  const shipping     = subtotal >= 500000 ? 0 : 30000
  const preXuTotal   = subtotal - voucherDiscount + shipping
  // toi da duoc dung = nho hon giua so xu dang co va tong tien con phai tra (1 xu = 1 dong)
  const maxXuUsable  = Math.max(0, Math.min(xuBalance, preXuTotal))
  const xuToApply    = useXu ? maxXuUsable : 0
  const grandTotal   = preXuTotal - xuToApply

  const fullAddress = form.province
    ? `${form.street}, ${form.ward}, ${form.district}, ${form.province}`
    : ''

  const handlePlaceOrder = async () => {
    setPlacing(true)
    setOrderError(null)
    try {
      // Build payload theo CheckoutData
      const shippingAddress = `${form.street}, ${form.ward}, ${form.district}, ${form.province}`
      const selectedVoucherCode =
        platformSelected?.code ??
        shopBests[0]?.voucher.code ??
        undefined

      const payload = {
        items: ORDER_ITEMS.map(i => ({ product_id: i.id, quantity: i.quantity })),
        shipping_address: shippingAddress,
        recipient_name:  form.name,
        recipient_phone: form.phone,
        payment_method:  payment as any,
        voucher_code:    selectedVoucherCode,
        note:            form.note || undefined,
      }

      const res = await orderService.create(payload)
      const createdOrder = res.data?.data ?? res.data
      const realOrderId  = createdOrder?.order_id
        ? String(createdOrder.order_id)
        : 'BZ' + Date.now().toString().slice(-8)

      setOrderId(realOrderId)

      // Trừ xu nếu dùng
      if (xuToApply > 0) {
        spendXu(xuToApply)
        setXuBalance(getXu())
      }
      setAppliedXu(xuToApply)

      // Quà tặng sự kiện
      const shopNames = [...new Set(ORDER_ITEMS.map(i => i.shopName))]
      setPostGifts(grantPostPurchaseGifts(shopNames))

      // Xóa giỏ hàng
      dispatch(clearCart())

      setStep(2)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || 'Đặt hàng thất bại, vui lòng thử lại'
      setOrderError(msg)
    } finally {
      setPlacing(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: SUCCESS
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 2) return (
    <div className="page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
      <div style={{ textAlign: 'center', maxWidth: 560, padding: '0 16px' }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
          Dat hang thanh cong!
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 4 }}>
          Don hang <strong style={{ color: 'var(--primary, #7C3AED)' }}>#{orderId}</strong> da duoc ghi nhan.
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
          Chung toi se gui thong bao xac nhan qua SDT: <strong>{form.phone}</strong>
        </p>

        {/* San pham da mua */}
        <div className="card" style={{ padding: 16, textAlign: 'left', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>📦</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>San pham da mua ({ORDER_ITEMS.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ORDER_ITEMS.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <img src={item.image} alt={item.name} style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-subtle)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{item.shopIcon} {item.shopName} · {item.variant} · x{item.quantity}</p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary, #7C3AED)', flexShrink: 0 }}>{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Tieu tong</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(subtotal)}</span>
            </div>
            {voucherDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Voucher ap dung</span>
                <span style={{ color: '#16A34A', fontWeight: 600 }}>-{formatCurrency(voucherDiscount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Phi giao hang</span>
              <span style={{ color: shipping === 0 ? '#16A34A' : 'var(--text-primary)', fontWeight: 500 }}>{shipping === 0 ? 'Mien phi' : formatCurrency(shipping)}</span>
            </div>
            {appliedXu > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>🪙 Da dung {appliedXu.toLocaleString('vi-VN')} xu</span>
                <span style={{ color: '#16A34A', fontWeight: 600 }}>-{formatCurrency(appliedXu)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, marginTop: 4 }}>
              <span style={{ color: 'var(--text-primary)' }}>Tong cong</span>
              <span style={{ color: 'var(--primary, #7C3AED)' }}>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, textAlign: 'left', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ color: '#16A34A' }}><ITruck /></span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Thong tin giao hang</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 3px', fontWeight: 600 }}>{form.name} — {form.phone}</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{fullAddress}</p>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Du kien giao hang</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>3 - 5 ngay lam viec</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/orders" className="btn btn-primary" style={{ padding: '11px 24px', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
            Theo doi don hang
          </Link>
          <Link to="/products" style={{ padding: '11px 24px', borderRadius: 8, fontWeight: 600, textDecoration: 'none', border: '1.5px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
            Tiep tuc mua sam
          </Link>
        </div>

        {/* Qua tang hau mai — moi shop trong don co the tang voucher nho, hoac san tang, hoac khong co gi */}
        {postGifts.length > 0 && (
          <div style={{ marginBottom: 24, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>🎁</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Qua tang hau mai</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {postGifts.map((g, i) => (
                g.voucher ? (
                  // ─ Ve giong the voucher o trang "Voucher cua toi" ─
                  <div key={i} className="card" style={{
                    display: 'flex', alignItems: 'stretch', overflow: 'hidden', borderRadius: 12,
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{
                      width: 78, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: g.type === 'platform_voucher' ? 'linear-gradient(135deg,#ff7a45,#ff4d4f)' : 'linear-gradient(135deg,#4096ff,#1677ff)',
                      color: '#fff', fontSize: 26,
                    }}>
                      🎟️
                    </div>
                    <div style={{ flex: 1, padding: '10px 14px', minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{g.voucher.label}</p>
                          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {g.type === 'platform_voucher' ? '🏛️ Voucher san BuyZo' : `🏪 Qua tang tu shop: ${g.shopName}`}
                          </p>
                        </div>
                        <code style={{ background: 'var(--bg-page)', padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>{g.voucher.code}</code>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderRadius: 10, fontSize: 13,
                    border: '1px dashed var(--border-subtle)', color: 'var(--text-secondary)',
                  }}>
                    <span>🏪 {g.shopName}</span>
                    <span style={{ fontStyle: 'italic' }}>Lan nay chua co qua, cam on ban!</span>
                  </div>
                )
              ))}
            </div>

            {postGifts.some(g => g.voucher) && (
              <div style={{ marginTop: 14, textAlign: 'center' }}>
                <Link to="/events" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                  textDecoration: 'none', color: '#fff',
                  background: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)',
                }}>
                  🎁 Dung voucher ngay
                </Link>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )

  return (
    <div className="page-wrapper" style={{ background: 'var(--bg-page)' }}>
      <div className="container" style={{ paddingTop: 28, paddingBottom: 60, maxWidth: 960 }}>

        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, display: 'flex', gap: 6, alignItems: 'center' }}>
          <Link to="/"      style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Trang chu</Link> /
          <Link to="/cart"  style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Gio hang</Link> /
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Thanh toan</span>
        </div>

        {/* Steps */}
        <Steps current={step} />

        {/* ─── STEP 0: ADDRESS FORM ─── */}
        {step === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

            {/* Left: Form */}
            <div>
              <div className="card" style={{ padding: 28 }}>
                <h2 style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', marginBottom: 22, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
                  📍 Thong tin nhan hang
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>

                  {/* Ho va ten */}
                  <div style={{ gridColumn: '1 / 2' }}>
                    <label style={labelStyle}>Ho va ten nguoi nhan <span style={{ color: '#EF4444' }}>*</span></label>
                    <input
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                      placeholder="VD: Nguyen Van An"
                      style={inputStyle(!!errors.name)}
                    />
                    {errors.name && <p style={errStyle}>{errors.name}</p>}
                  </div>

                  {/* SDT */}
                  <div style={{ gridColumn: '2 / 3' }}>
                    <label style={labelStyle}>So dien thoai <span style={{ color: '#EF4444' }}>*</span></label>
                    <input
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      placeholder="VD: 0901 234 567"
                      maxLength={12}
                      style={inputStyle(!!errors.phone)}
                    />
                    {errors.phone && <p style={errStyle}>{errors.phone}</p>}
                  </div>

                  {/* Tinh */}
                  <div>
                    <label style={labelStyle}>Tỉnh / Thành phố <span style={{ color: '#EF4444' }}>*</span></label>
                    <select value={form.province} onChange={handleProvinceChange} style={{ ...inputStyle(!!errors.province), cursor: 'pointer' }}>
                      <option value="">-- Chọn tỉnh/thành phố --</option>
                      {provinces.map(p => <option key={p.code} value={p.name} data-code={p.code}>{p.name}</option>)}
                    </select>
                    {errors.province && <p style={errStyle}>{errors.province}</p>}
                  </div>

                  {/* Quan */}
                  <div>
                    <label style={labelStyle}>Quận / Huyện <span style={{ color: '#EF4444' }}>*</span></label>
                    <select value={form.district} onChange={handleDistrictChange} disabled={!form.province || geoLoading} style={{ ...inputStyle(!!errors.district), cursor: form.province ? 'pointer' : 'not-allowed', opacity: form.province ? 1 : 0.5 }}>
                      <option value="">{geoLoading ? 'Đang tải...' : '-- Chọn quận/huyện --'}</option>
                      {districts.map(d => <option key={d.code} value={d.name} data-code={d.code}>{d.name}</option>)}
                    </select>
                    {errors.district && <p style={errStyle}>{errors.district}</p>}
                  </div>

                  {/* Phuong */}
                  <div>
                    <label style={labelStyle}>Phường / Xã <span style={{ color: '#EF4444' }}>*</span></label>
                    <select value={form.ward} onChange={handleWardChange} disabled={!form.district || geoLoading} style={{ ...inputStyle(!!errors.ward), cursor: form.district ? 'pointer' : 'not-allowed', opacity: form.district ? 1 : 0.5 }}>
                      <option value="">{geoLoading ? 'Đang tải...' : '-- Chọn phường/xã --'}</option>
                      {wards.map(w => <option key={w.code} value={w.name}>{w.name}</option>)}
                    </select>
                    {errors.ward && <p style={errStyle}>{errors.ward}</p>}
                  </div>

                  {/* So nha duong */}
                  <div>
                    <label style={labelStyle}>So nha, ten duong <span style={{ color: '#EF4444' }}>*</span></label>
                    <input
                      value={form.street}
                      onChange={e => set('street', e.target.value)}
                      placeholder="VD: 123 Nguyen Trai"
                      style={inputStyle(!!errors.street)}
                    />
                    {errors.street && <p style={errStyle}>{errors.street}</p>}
                  </div>

                  {/* Ghi chu */}
                  <div style={{ gridColumn: '1 / 3' }}>
                    <label style={labelStyle}>Ghi chu (tuy chon)</label>
                    <textarea
                      value={form.note}
                      onChange={e => set('note', e.target.value)}
                      placeholder="VD: Goi truoc khi den, de truoc cua..."
                      rows={3}
                      style={{ ...inputStyle(), resize: 'vertical' }}
                    />
                  </div>

                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
                  <Link to="/cart" style={{ fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    ← Quay lai gio hang
                  </Link>
                  <button
                    onClick={() => { if (validate()) setStep(1) }}
                    style={{ padding: '11px 32px', background: 'var(--primary, #7C3AED)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'opacity 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    Tiep tuc →
                  </button>
                </div>
              </div>
            </div>

            {/* Right: mini order summary */}
            <div className="card" style={{ padding: 20, position: 'sticky', top: 80 }}>
              <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 14, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                Don hang ({ORDER_ITEMS.length} san pham)
              </h3>
              {ORDER_ITEMS.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <img src={item.image} alt={item.name} style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-subtle)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>x{item.quantity}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary, #7C3AED)', margin: 0 }}>{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tieu tong</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Phi van chuyen</span>
                  <span style={{ color: shipping === 0 ? '#16A34A' : 'var(--text-primary)', fontWeight: 500 }}>{shipping === 0 ? 'Mien phi' : formatCurrency(shipping)}</span>
                </div>
                {saved > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tiet kiem</span>
                    <span style={{ color: '#16A34A', fontWeight: 600 }}>-{formatCurrency(saved)}</span>
                  </div>
                )}
                {voucherDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Voucher ap dung</span>
                    <span style={{ color: '#16A34A', fontWeight: 600 }}>-{formatCurrency(voucherDiscount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, marginTop: 10, color: 'var(--text-primary)' }}>
                  <span>Tong cong</span>
                  <span style={{ color: 'var(--primary, #7C3AED)' }}>{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 1: CONFIRM + PAYMENT ─── */}
        {step === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

            {/* Left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Address summary */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ITruck /> Dia chi giao hang
                  </h3>
                  <button onClick={() => setStep(0)}
                    style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IEdit /> Chinh sua
                  </button>
                </div>
                <div style={{ background: 'var(--bg-highlight, var(--bg-page))', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border-subtle)' }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                    {form.name} &nbsp;|&nbsp; {form.phone}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{fullAddress}</p>
                  {form.note && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 0', fontStyle: 'italic' }}>Ghi chu: {form.note}</p>}
                </div>
              </div>

              {/* Items per shop */}
              {orderShopIds.map(sid => {
                const shop = ORDER_ITEMS.find(i => i.shopId === sid)!
                const shopItems = ORDER_ITEMS.filter(i => i.shopId === sid)
                const shopVoucher = shopBests.find(s => s.sid === sid)
                const shopVoucherOptions = eligibleShopVouchers(sid, shop.shopName)
                return (
                  <div key={sid} className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-highlight, var(--bg-card))', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{shop.shopIcon}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{shop.shopName}</span>
                    </div>
                    {shopItems.map((item, idx) => (
                      <div key={item.id} style={{
                        display: 'flex', gap: 14, padding: '14px 20px',
                        borderBottom: idx < shopItems.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        alignItems: 'center',
                      }}>
                        <img src={item.image} alt={item.name} style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-subtle)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)', marginBottom: 3 }}>{item.name}</p>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Phan loai: {item.variant}</p>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>So luong: {item.quantity}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary, #7C3AED)', margin: '0 0 3px' }}>{formatCurrency(item.price * item.quantity)}</p>
                          {item.originalPrice > item.price && (
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'line-through', margin: 0 }}>{formatCurrency(item.originalPrice * item.quantity)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-highlight, #f8f9fa)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flexShrink: 0 }}>🏪 Voucher shop:</span>
                        {shopVoucherOptions.length > 0 ? (
                          <select
                            value={shopVoucherIds[sid] ?? ''}
                            onChange={e => setShopVoucherIds(prev => ({ ...prev, [sid]: e.target.value ? Number(e.target.value) : null }))}
                            style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1.5px solid var(--border-subtle)', color: 'var(--text-primary)', background: 'var(--bg-surface, var(--bg-page))', cursor: 'pointer' }}
                          >
                            <option value="">Khong dung voucher</option>
                            {shopVoucherOptions.map(p => (
                              <option key={p.voucher.voucher_id} value={p.voucher.voucher_id}>
                                {p.voucher.code} (-{formatCurrency(p.amount)})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontStyle: 'italic', fontSize: 12 }}>Khong co voucher phu hop</span>
                        )}
                        {shopVoucher && <span style={{ color: '#1D4ED8', fontWeight: 700, fontSize: 12 }}>-{formatCurrency(shopVoucher.amount)}</span>}
                      </div>
                      <span>Tieu tong shop: <strong style={{ color: 'var(--text-primary)', marginLeft: 6 }}>{formatCurrency(shopItems.reduce((s, i) => s + i.price * i.quantity, 0))}</strong></span>
                    </div>
                  </div>
                )
              })}

              {/* Payment method */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
                  💳 Phuong thuc thanh toan
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {PAYMENT_METHODS.map(pm => (
                    <label key={pm.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                        borderRadius: 8, border: payment === pm.id ? '2px solid var(--primary, #7C3AED)' : '1.5px solid var(--border-subtle)',
                        background: payment === pm.id ? 'rgba(124,58,237,0.05)' : 'transparent',
                        cursor: 'pointer', transition: 'all 0.18s',
                      }}
                    >
                      <input type="radio" name="payment" value={pm.id} checked={payment === pm.id} onChange={() => setPayment(pm.id)}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary, #7C3AED)', flexShrink: 0 }} />
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{pm.icon}</span>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', margin: '0 0 2px' }}>{pm.label}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{pm.sub}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Nav buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setStep(0)}
                  style={{ padding: '10px 20px', background: 'none', border: '1.5px solid var(--border-subtle)', borderRadius: 8, fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  ← Quay lai
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  {orderError && (
                    <p style={{ color: '#EF4444', fontSize: 13, margin: 0, maxWidth: 320, textAlign: 'right' }}>
                      ⚠️ {orderError}
                    </p>
                  )}
                  <button
                    onClick={handlePlaceOrder}
                    disabled={placing}
                    style={{ padding: '12px 36px', background: placing ? '#9CA3AF' : 'var(--primary, #7C3AED)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: placing ? 'not-allowed' : 'pointer', minWidth: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.2s' }}>
                    {placing ? (
                      <>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.35)', borderTop: '2.5px solid #fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                        Dang xu ly...
                      </>
                    ) : '🎯 Dat hang ngay'}
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: summary */}
            <div className="card" style={{ padding: 20, position: 'sticky', top: 80 }}>
              <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 14, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                Tom tat thanh toan
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>San pham ({ORDER_ITEMS.length})</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {saved > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Da tiet kiem</span>
                    <span style={{ color: '#16A34A', fontWeight: 600 }}>-{formatCurrency(saved)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>🏛️ Voucher toan san</span>
                    {platformAmount > 0 && <span style={{ color: '#16A34A', fontWeight: 600 }}>-{formatCurrency(platformAmount)}</span>}
                  </div>
                  {eligiblePlatformVouchers.length > 0 ? (
                    <select
                      value={platformVoucherId ?? ''}
                      onChange={e => setPlatformVoucherId(e.target.value ? Number(e.target.value) : null)}
                      style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1.5px solid var(--border-subtle)', color: 'var(--text-primary)', background: 'var(--bg-surface, var(--bg-page))', cursor: 'pointer' }}
                    >
                      <option value="">Khong dung voucher</option>
                      {eligiblePlatformVouchers.map(p => (
                        <option key={p.voucher.voucher_id} value={p.voucher.voucher_id}>
                          {p.voucher.code} (-{formatCurrency(p.amount)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Khong co voucher san phu hop</span>
                  )}
                </div>
                {shopBests.map(s => (
                  <div key={s.sid} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>🏪 Voucher {s.shopName} ({s.voucher.code})</span>
                    <span style={{ color: '#16A34A', fontWeight: 600 }}>-{formatCurrency(s.amount)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Phi giao hang</span>
                  <span style={{ color: shipping === 0 ? '#16A34A' : 'var(--text-primary)', fontWeight: 500 }}>{shipping === 0 ? 'Mien phi' : formatCurrency(shipping)}</span>
                </div>

                {/* Dung xu BuyZo de tru tien — nut on/off, 1 xu = 1 dong */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 6,
                  padding: '10px 12px', borderRadius: 8,
                  background: useXu ? '#FFFBEB' : 'var(--bg-page)',
                  border: useXu ? '1px solid #FDE68A' : '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>🪙 Dung xu BuyZo</span>
                    <button
                      type="button"
                      onClick={() => setUseXu(v => !v)}
                      disabled={xuBalance <= 0}
                      aria-pressed={useXu}
                      style={{
                        width: 42, height: 24, borderRadius: 999, border: 'none', position: 'relative',
                        background: useXu ? '#16A34A' : '#CBD5E1',
                        cursor: xuBalance <= 0 ? 'not-allowed' : 'pointer',
                        opacity: xuBalance <= 0 ? 0.5 : 1,
                        transition: 'background 0.2s', flexShrink: 0,
                      }}>
                      <span style={{
                        position: 'absolute', top: 3, left: useXu ? 21 : 3,
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>So du: {xuBalance.toLocaleString('vi-VN')} xu</span>
                    {xuToApply > 0 && <span style={{ color: '#16A34A', fontWeight: 600 }}>-{formatCurrency(xuToApply)}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Thanh toan qua</span>
                  <span style={{ fontWeight: 600 }}>{PAYMENT_METHODS.find(p => p.id === payment)?.icon} {PAYMENT_METHODS.find(p => p.id === payment)?.label.split(' ').slice(0,3).join(' ')}</span>
                </div>
              </div>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '14px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Tong thanh toan</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--primary, #7C3AED)' }}>{formatCurrency(grandTotal)}</span>
              </div>
              {(saved > 0 || voucherDiscount > 0 || xuToApply > 0) && <p style={{ fontSize: 12, color: '#16A34A', margin: '6px 0 0', textAlign: 'right' }}>Tiet kiem {formatCurrency(saved + voucherDiscount + xuToApply)} so voi gia goc</p>}
              <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--bg-highlight, #F0FDF4)', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                <p style={{ fontSize: 12, color: '#15803D', margin: 0, fontWeight: 500, lineHeight: 1.6 }}>
                  🔒 Thong tin don hang va thanh toan cua ban duoc bao mat tuyet doi
                </p>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}

export default CheckoutPage
