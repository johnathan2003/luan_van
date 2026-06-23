import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { formatCurrency } from '../utils/formatters'
import { getImageUrl } from '../utils/helpers'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-toastify'
import API from '../services/api'
import { trackMissionEvent } from '../utils/eventsStore'
import { voucherService } from '../services/voucherService'
import { isFollowingShop, toggleFollowShop } from '../utils/shopFollowStore'
import SuggestedDealsSection from '../components/common/SuggestedDealsSection'

const C = {
  navy: '#1E3A8A', blue: '#1D4ED8', sky: '#DBEAFE',
  gray: '#64748B', light: '#F8FAFC', border: '#E2E8F0',
  gold: '#F59E0B', success: '#16A34A', error: '#DC2626',
}

const TABS = ['Sản phẩm', 'Đánh giá', 'Thông tin']

// Voucher rieng cua shop (do shop phat hanh) - hien thi dang ve voucher, chi nhan duoc sau khi theo doi shop
interface ShopVoucherItem {
  voucher_id: number
  code: string
  discount_type: string
  discount_value: string
  min_order_value: string | null
  valid_to: string | null
  is_collected: boolean
}

// ─── Image specs ──────────────────────────────────────────────────────────────
type ImageType = 'cover' | 'logo'

const IMG_SPEC: Record<ImageType, { w: number; h: number; label: string; ratio: string; maxKB: number }> = {
  cover: { w: 1200, h: 300, label: 'Anh bia',  ratio: '4:1',  maxKB: 2048 },
  logo:  { w: 300,  h: 300, label: 'Logo shop', ratio: '1:1',  maxKB: 512  },
}

// ─── Validation result ────────────────────────────────────────────────────────
interface ValResult {
  ok: boolean
  sizeOk: boolean
  dimOk: boolean
  actualW: number
  actualH: number
  actualKB: number
}

function validateImage(file: File, type: ImageType): Promise<ValResult> {
  const spec = IMG_SPEC[type]
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const actualW  = img.naturalWidth
      const actualH  = img.naturalHeight
      const actualKB = Math.round(file.size / 1024)
      const sizeOk   = actualKB <= spec.maxKB
      // allow ±5% tolerance on dimensions
      const dimOk = Math.abs(actualW / actualH - spec.w / spec.h) < 0.05
        && actualW >= spec.w * 0.5
      URL.revokeObjectURL(url)
      resolve({ ok: sizeOk && dimOk, sizeOk, dimOk, actualW, actualH, actualKB })
    }
    img.onerror = () => resolve({ ok: false, sizeOk: false, dimOk: false, actualW: 0, actualH: 0, actualKB: 0 })
    img.src = url
  })
}

// ─── Image Editor Modal ───────────────────────────────────────────────────────
interface EditorModalProps {
  type: ImageType
  onConfirm: (file: File, previewUrl: string) => void
  onClose: () => void
}

const EditorModal: React.FC<EditorModalProps> = ({ type, onConfirm, onClose }) => {
  const spec = IMG_SPEC[type]
  const fileRef = useRef<HTMLInputElement>(null)

  const [preview,  setPreview]  = useState<string | null>(null)
  const [file,     setFile]     = useState<File | null>(null)
  const [val,      setVal]      = useState<ValResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [drag,     setDrag]     = useState(false)

  // cleanup object URLs
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const processFile = useCallback(async (f: File) => {
    setChecking(true)
    const url = URL.createObjectURL(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(url)
    setFile(f)
    const result = await validateImage(f, type)
    setVal(result)
    setChecking(false)
  }, [type, preview])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) processFile(f)
  }

  const confirm = () => {
    if (file && preview) { onConfirm(file, preview); onClose() }
  }

  const dimStatus = (ok: boolean | undefined) =>
    ok === undefined ? '' : ok ? '✓' : '✗'
  const dimColor = (ok: boolean | undefined) =>
    ok === undefined ? C.gray : ok ? C.success : C.error

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--bg-card, #fff)', borderRadius: 20,
        width: '100%', maxWidth: 640,
        boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        animation: 'modalIn 0.22s cubic-bezier(0.34,1.2,0.64,1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg,#1E3A8A,#1D4ED8)',
          color: '#fff',
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>
              📷 Chinh sua {spec.label}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.8 }}>
              Chon hoac keo thu anh vao day
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>

          {/* Yêu cầu kích thước */}
          <div style={{
            background: '#EFF6FF', border: `1px solid #BFDBFE`,
            borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          }}>
            <p style={{ fontWeight: 700, color: C.navy, margin: '0 0 10px', fontSize: 14 }}>
              📐 Yeu cau kich thuoc
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { icon: '↔️', label: 'Kich thuoc khuyen nghi', val: `${spec.w} × ${spec.h} px` },
                { icon: '📐', label: 'Ti le khung hinh',        val: spec.ratio },
                { icon: '💾', label: 'Dung luong toi da',       val: `${spec.maxKB >= 1024 ? spec.maxKB / 1024 + ' MB' : spec.maxKB + ' KB'}` },
              ].map(r => (
                <div key={r.label} style={{
                  background: '#fff', borderRadius: 10, padding: '10px 14px',
                  border: `1px solid ${C.border}`, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{r.icon}</div>
                  <p style={{ fontSize: 10, color: C.gray, margin: '0 0 3px' }}>{r.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: C.navy, margin: 0 }}>{r.val}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: C.gray, margin: '10px 0 0' }}>
              💡 Anh co the lon hon nhung phai giu ti le {spec.ratio}. Dinh dang: JPG, PNG, WEBP.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${drag ? C.blue : val ? (val.ok ? C.success : C.error) : C.border}`,
              borderRadius: 14, padding: preview ? 0 : '32px 20px',
              textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
              background: drag ? '#EFF6FF' : 'transparent',
              overflow: 'hidden', position: 'relative',
              minHeight: preview ? (type === 'cover' ? 160 : 200) : undefined,
            }}
          >
            {preview ? (
              <div style={{ position: 'relative' }}>
                {type === 'cover' ? (
                  <img src={preview} alt="preview" style={{
                    width: '100%', height: 160, objectFit: 'cover', display: 'block',
                  }} />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                    <img src={preview} alt="preview" style={{
                      width: 160, height: 160, borderRadius: '50%',
                      objectFit: 'cover', border: `4px solid ${val?.ok ? C.success : C.error}`,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    }} />
                  </div>
                )}
                {/* Change overlay */}
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                  onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.35)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0)')}>
                  <span style={{
                    color: '#fff', fontSize: 13, fontWeight: 700,
                    background: 'rgba(0,0,0,0.5)', padding: '6px 14px', borderRadius: 20,
                    opacity: 0, transition: 'opacity 0.2s',
                  }}
                    onMouseEnter={e => ((e.currentTarget as HTMLSpanElement).style.opacity = '1')}
                    onMouseLeave={e => ((e.currentTarget as HTMLSpanElement).style.opacity = '0')}>
                    🔄 Doi anh
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🖼️</div>
                <p style={{ fontWeight: 600, color: C.navy, margin: '0 0 6px', fontSize: 14 }}>
                  Keo & Thu anh vao day hoac click de chon
                </p>
                <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>
                  Ho tro JPG, PNG, WEBP — toi da {spec.maxKB >= 1024 ? spec.maxKB / 1024 + 'MB' : spec.maxKB + 'KB'}
                </p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onInputChange} />

          {/* Validation result */}
          {checking && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, textAlign: 'center', color: C.gray, fontSize: 13 }}>
              ⏳ Dang kiem tra anh...
            </div>
          )}

          {val && !checking && (
            <div style={{
              marginTop: 14, padding: '14px 18px', borderRadius: 12,
              background: val.ok ? '#F0FDF4' : '#FFF7F7',
              border: `1px solid ${val.ok ? '#BBF7D0' : '#FECACA'}`,
            }}>
              <p style={{ fontWeight: 700, color: val.ok ? C.success : C.error, margin: '0 0 10px', fontSize: 13 }}>
                {val.ok ? '✅ Anh hop le — san sang su dung!' : '⚠️ Anh chua dat yeu cau — xem chi tiet bên duoi'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  {
                    label: 'Kich thuoc anh',
                    actual: `${val.actualW} × ${val.actualH} px`,
                    req: `≥ ${Math.round(spec.w * 0.5)} × ${Math.round(spec.h * 0.5)} px`,
                    ok: val.dimOk,
                  },
                  {
                    label: 'Ti le khung',
                    actual: val.actualW && val.actualH
                      ? `${(val.actualW / val.actualH).toFixed(2)}:1`
                      : '—',
                    req: `${(spec.w / spec.h).toFixed(2)}:1 (±5%)`,
                    ok: val.dimOk,
                  },
                  {
                    label: 'Dung luong',
                    actual: val.actualKB >= 1024 ? `${(val.actualKB / 1024).toFixed(1)} MB` : `${val.actualKB} KB`,
                    req: `≤ ${spec.maxKB >= 1024 ? spec.maxKB / 1024 + ' MB' : spec.maxKB + ' KB'}`,
                    ok: val.sizeOk,
                  },
                ].map(row => (
                  <div key={row.label} style={{
                    background: '#fff', borderRadius: 8, padding: '10px 12px',
                    border: `1px solid ${row.ok ? '#BBF7D0' : '#FECACA'}`,
                  }}>
                    <p style={{ fontSize: 10, color: C.gray, margin: '0 0 4px' }}>{row.label}</p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: dimColor(row.ok), margin: '0 0 2px' }}>
                      {dimStatus(row.ok)} {row.actual}
                    </p>
                    <p style={{ fontSize: 10, color: C.gray, margin: 0 }}>Yeu cau: {row.req}</p>
                  </div>
                ))}
              </div>
              {!val.ok && (
                <p style={{ fontSize: 11, color: C.error, margin: '10px 0 0' }}>
                  💡 Goi y: {!val.dimOk ? `Vui long chon anh co ti le gan ${spec.ratio} va kich thuoc toi thieu ${Math.round(spec.w * 0.5)}×${Math.round(spec.h * 0.5)}px.` : ''} {!val.sizeOk ? `Anh qua nang, vui long nen anh duoi ${spec.maxKB >= 1024 ? spec.maxKB / 1024 + 'MB' : spec.maxKB + 'KB'}.` : ''}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
              padding: '10px 24px', borderRadius: 10, border: `1px solid ${C.border}`,
              background: 'none', cursor: 'pointer', fontSize: 14, color: C.gray, fontWeight: 600,
            }}>Huy</button>
            <button
              onClick={confirm}
              disabled={!file || !val}
              style={{
                padding: '10px 28px', borderRadius: 10, border: 'none',
                background: file && val && val.ok
                  ? 'linear-gradient(135deg,#1E3A8A,#1D4ED8)'
                  : file && val && !val.ok
                    ? '#D97706'
                    : '#D1D5DB',
                color: file && val ? '#fff' : C.gray,
                cursor: file && val ? 'pointer' : 'not-allowed',
                fontSize: 14, fontWeight: 700, transition: 'all 0.2s',
              }}
            >
              {file && val && !val.ok ? '⚠️ Dung luu du biet loi' : '✓ Xac nhan & Luu'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const ShopProfilePage: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>()
  const { currentRole } = useAuth()
  const isShopOwner = currentRole === 'shop'

  const [shop,    setShop]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState(0)
  const [search,  setSearch]  = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [logoPreview,  setLogoPreview]  = useState<string | null>(null)
  const [saveMsg,      setSaveMsg]      = useState('')
  const [modal,        setModal]        = useState<ImageType | null>(null)

  const [following,     setFollowing]     = useState(false)
  const [followerDelta, setFollowerDelta] = useState(0)
  const [shopVoucher,   setShopVoucher]   = useState<ShopVoucherItem | null>(null)
  const [collectingVoucher, setCollectingVoucher] = useState(false)

  useEffect(() => {
    if (!shopId) return
    setLoading(true)
    API.get(`/api/v1/shop/public/${shopId}`)
      .then(r => setShop(r.data))
      .catch(() => setShop(null))
      .finally(() => setLoading(false))
  }, [shopId])

  useEffect(() => {
    if (!shopId) return
    setFollowing(isFollowingShop(Number(shopId)))
  }, [shopId])

  // Lay 1 voucher rieng cua shop nay (neu co) de hien thi dang ve voucher
  useEffect(() => {
    if (!shop?.shop_name) return
    voucherService.getShopVouchers()
      .then(r => {
        const list: ShopVoucherItem[] = r.data?.vouchers || []
        const mine = list.find((v: any) => v.shop_name === shop.shop_name)
        setShopVoucher(mine || null)
      })
      .catch(() => setShopVoucher(null))
  }, [shop?.shop_name])

  const handleToggleFollow = async () => {
    if (!shopId) return
    const { following: nowFollowing, justFollowed } = toggleFollowShop(Number(shopId))
    setFollowing(nowFollowing)
    setFollowerDelta(d => d + (nowFollowing ? 1 : -1))

    if (justFollowed) {
      toast.success(`Đã theo dõi ${shop?.shop_name || 'shop'}!`)
      // Theo doi xong -> nguoi dung bam nut "Nhan" rieng tren ve voucher de thu thap, khong tu dong nhan
    } else {
      toast.info(`Đã bỏ theo dõi ${shop?.shop_name || 'shop'}`)
    }
  }

  const handleCollectVoucher = async () => {
    if (!shopVoucher || shopVoucher.is_collected) return
    setCollectingVoucher(true)
    try {
      await voucherService.collectVoucher(shopVoucher.voucher_id)
      setShopVoucher(v => v ? { ...v, is_collected: true } : v)
      toast.success('🎁 Đã nhận voucher của shop!')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Không thể nhận voucher')
    } finally {
      setCollectingVoucher(false)
    }
  }

  // tich tien do nhiem vu "xem trang cua 1 shop" cho su kien
  useEffect(() => {
    if (shopId) trackMissionEvent('view_shop')
  }, [shopId])

  const flashSave = (msg: string) => {
    setSaveMsg(msg)
    setTimeout(() => setSaveMsg(''), 2800)
  }

  const handleConfirm = (type: ImageType) => (_file: File, url: string) => {
    if (type === 'cover') setCoverPreview(url)
    else setLogoPreview(url)
    flashSave(type === 'cover' ? 'Da cap nhat anh bia!' : 'Da cap nhat logo shop!')
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
      <div style={{ fontSize: 32 }}>&#9203;</div>
    </div>
  )

  if (!shop) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>&#127978;</div>
      <p style={{ color: C.gray, marginBottom: 16 }}>Shop khong ton tai hoac da dong cua</p>
      <Link to="/products" className="btn btn-primary">Quay lai mua sam</Link>
    </div>
  )

  // Danh sach danh muc san pham duy nhat cua shop (tu category_name cua tung san pham)
  const shopCategories: string[] = Array.from(
    new Set((shop.products || []).map((p: any) => p.category_name).filter(Boolean))
  )

  const filteredProducts = (shop.products || []).filter((p: any) =>
    p.product_name.toLowerCase().includes(search.toLowerCase()) &&
    (activeCategory === 'all' || p.category_name === activeCategory)
  )
  const ratingNum  = parseFloat(shop.rating) || 0
  const isVerified = shop.verification_status === 'approved'

  return (
    <div style={{ minHeight: '100vh', background: C.light }}>
      <style>{`
        @keyframes modalIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
        @keyframes fadeInRight{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        .ticket-notch{position:absolute;width:14px;height:14px;border-radius:50%;background:${C.light};left:50%;transform:translateX(-50%);}
        .ticket-notch-top{top:-7px}
        .ticket-notch-bottom{bottom:-7px}
      `}</style>

      {/* Modal */}
      {modal && (
        <EditorModal
          type={modal}
          onConfirm={handleConfirm(modal)}
          onClose={() => setModal(null)}
        />
      )}

      {/* Toast */}
      {saveMsg && (
        <div style={{
          position: 'fixed', top: 80, right: 24, zIndex: 9998,
          background: '#16A34A', color: '#fff',
          padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          animation: 'fadeInRight 0.25s ease',
        }}>
          &#10003; {saveMsg}
        </div>
      )}

      {/* Cover */}
      <div style={{ position: 'relative' }}>
        <div style={{
          height: 240,
          background: coverPreview
            ? `url(${coverPreview}) center/cover no-repeat`
            : 'linear-gradient(135deg,#1E3A8A 0%,#1D4ED8 40%,#0EA5E9 100%)',
          position: 'relative', overflow: 'hidden',
        }}>
          {!coverPreview && [...Array(6)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute', width: 120 + i * 40, height: 120 + i * 40,
              borderRadius: '50%', border: '1px solid rgba(255,255,255,0.08)',
              top: -20 + i * 10, right: 100 + i * 60,
            }} />
          ))}
          {!coverPreview && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.02) 0px,rgba(255,255,255,0.02) 1px,transparent 1px,transparent 40px)',
            }} />
          )}
          {isShopOwner && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '16px 20px' }}>
              <button
                onClick={() => setModal('cover')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 16px', borderRadius: 20,
                  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', transition: 'background 0.2s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.65)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.45)')}
              >
                📷 Chinh sua anh bia
              </button>
            </div>
          )}
        </div>

        {/* Profile row */}
        <div className="container" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, padding: '0 0 20px', marginTop: -60 }}>

            {/* Logo */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 120, height: 120, borderRadius: '50%',
                background: 'linear-gradient(135deg,#F59E0B,#D97706)',
                border: '4px solid white', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 48, overflow: 'hidden',
              }}>
                {logoPreview
                  ? <img src={logoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : shop.avatar_url
                    ? <img src={getImageUrl(shop.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span>&#127978;</span>
                }
              </div>
              {isShopOwner && (
                <button
                  onClick={() => setModal('logo')}
                  title="Chinh sua logo"
                  style={{
                    position: 'absolute', bottom: 2, right: 2,
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#1E3A8A', border: '2.5px solid #fff',
                    color: '#fff', fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25)', transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#1D4ED8')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#1E3A8A')}
                >
                  ✏️
                </button>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: C.navy, margin: 0 }}>{shop.shop_name}</h1>
                {isVerified && (
                  <span style={{ background: '#DBEAFE', color: C.blue, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                    &#10003; Chinh thuc
                  </span>
                )}
                {isShopOwner && (
                  <span style={{ background: '#FEF3C7', color: '#D97706', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid #FDE68A' }}>
                    ✏️ Che do chinh sua
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
                {[
                  { label: 'Sản phẩm', value: shop.products?.length || 0 },
                  { label: 'Đã bán',   value: (shop.total_orders   || 0).toLocaleString('vi-VN') },
                  { label: 'Theo dõi', value: ((shop.total_followers || 0) + followerDelta).toLocaleString('vi-VN') },
                  { label: 'Đánh giá', value: ratingNum.toFixed(1) },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 800, fontSize: 18, color: C.navy, margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating + action */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 8 }}>
              <div style={{ background: 'white', border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginBottom: 2 }}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} style={{ color: i < Math.round(ratingNum) ? C.gold : '#D1D5DB', fontSize: 14 }}>&#9733;</span>
                  ))}
                </div>
                <p style={{ fontWeight: 800, color: C.gold, fontSize: 18, margin: 0 }}>{ratingNum.toFixed(1)}</p>
                <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>Danh gia</p>
              </div>
              {isShopOwner ? (
                <button
                  onClick={() => flashSave('Da luu thay doi!')}
                  className="btn btn-primary"
                  style={{ padding: '10px 24px', fontWeight: 700, background: '#16A34A', borderColor: '#16A34A' }}>
                  &#10003; Luu thay doi
                </button>
              ) : (
                <button
                  onClick={handleToggleFollow}
                  className="btn"
                  style={{
                    padding: '10px 24px', fontWeight: 700, cursor: 'pointer',
                    background: following ? 'white' : C.blue,
                    color: following ? C.blue : 'white',
                    border: following ? `1.5px solid ${C.blue}` : `1.5px solid ${C.blue}`,
                  }}
                >
                  {following ? '✓ Đang theo dõi' : '+ Theo dõi'}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 64, zIndex: 10 }}>
        <div className="container" style={{ display: 'flex', gap: 0 }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              padding: '14px 24px', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: tab === i ? 700 : 400,
              color: tab === i ? C.blue : C.gray,
              borderBottom: tab === i ? `2px solid ${C.blue}` : '2px solid transparent',
              transition: 'all 0.15s',
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div className="container" style={{ paddingTop: 28, paddingBottom: 60 }}>

        {/* Ve voucher rieng cua shop - hien ngay duoi danh muc tab, voi nguoi xem thi mo khoa sau khi theo doi, voi chinh chu shop thi xem truoc de biet dang co voucher gi */}
        {shopVoucher && (
          <div className="shop-voucher-ticket" style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'stretch', maxWidth: 480, borderRadius: 12,
              background: (isShopOwner || following) ? 'linear-gradient(135deg,#1D4ED8,#1E3A8A)' : '#94A3B8',
              color: '#fff', position: 'relative', overflow: 'hidden',
              opacity: (isShopOwner || following) ? 1 : 0.85, transition: 'all 0.2s',
            }}>
              <div style={{
                width: 96, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '14px 8px', borderRight: '2px dashed rgba(255,255,255,0.5)',
                position: 'relative',
              }}>
                <span style={{ fontSize: 22, fontWeight: 900 }}>
                  {shopVoucher.discount_type === 'percentage' ? `${shopVoucher.discount_value}%` : `${Number(shopVoucher.discount_value) >= 1000 ? Math.round(Number(shopVoucher.discount_value) / 1000) + 'K' : shopVoucher.discount_value}`}
                </span>
                <span style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>GIẢM</span>
                <span className="ticket-notch ticket-notch-top" />
                <span className="ticket-notch ticket-notch-bottom" />
              </div>
              <div style={{ flex: 1, padding: '14px 16px', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>
                    {isShopOwner ? 'Voucher của shop bạn' : `Voucher riêng của ${shop.shop_name}`}
                  </p>
                  <p style={{ fontSize: 12, opacity: 0.9, margin: '4px 0 0' }}>
                    {shopVoucher.min_order_value ? `Đơn từ ${Number(shopVoucher.min_order_value).toLocaleString('vi-VN')}₫` : 'Không yêu cầu đơn tối thiểu'}
                    {shopVoucher.valid_to ? ` · HSD ${new Date(shopVoucher.valid_to).toLocaleDateString('vi-VN')}` : ''}
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 700, marginTop: 8 }}>
                    {isShopOwner
                      ? `Mã: ${shopVoucher.code}`
                      : !following
                        ? '🔒 Theo dõi shop để nhận voucher này'
                        : shopVoucher.is_collected
                          ? '✓ Đã có trong ví voucher của bạn'
                          : ''}
                  </p>
                </div>
                {!isShopOwner && following && !shopVoucher.is_collected && (
                  <button
                    onClick={handleCollectVoucher}
                    disabled={collectingVoucher}
                    style={{
                      flexShrink: 0, padding: '8px 18px', borderRadius: 8, border: 'none',
                      background: 'white', color: C.blue, fontWeight: 700, fontSize: 13,
                      cursor: collectingVoucher ? 'not-allowed' : 'pointer',
                      opacity: collectingVoucher ? 0.7 : 1,
                    }}
                  >
                    {collectingVoucher ? 'Đang nhận...' : 'Nhận'}
                  </button>
                )}
                {!isShopOwner && !following && (
                  <button
                    onClick={handleToggleFollow}
                    style={{
                      flexShrink: 0, padding: '8px 18px', borderRadius: 8, border: 'none',
                      background: 'white', color: C.blue, fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    Nhận
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 0 && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tim san pham trong shop..."
                style={{ flex: 1, padding: '10px 16px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', background: 'white' }}
              />
              <span style={{ fontSize: 13, color: C.gray }}>{filteredProducts.length} san pham</span>
            </div>

            {shopCategories.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveCategory('all')}
                  style={{
                    padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${activeCategory === 'all' ? C.blue : C.border}`,
                    background: activeCategory === 'all' ? C.blue : 'white',
                    color: activeCategory === 'all' ? 'white' : '#475569',
                    transition: 'all 0.15s',
                  }}
                >
                  Tất cả
                </button>
                {shopCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${activeCategory === cat ? C.blue : C.border}`,
                      background: activeCategory === cat ? C.blue : 'white',
                      color: activeCategory === cat ? 'white' : '#475569',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: C.gray }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>&#128141;</div>
                <p>Khong co san pham nao</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
                {filteredProducts.map((p: any) => (
                  <Link key={p.product_id} to={`/products/${p.product_id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}`, transition: 'all 0.2s', cursor: 'pointer' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)' }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = ''; el.style.boxShadow = '' }}>
                      <div style={{ aspectRatio: '1', background: '#F1F5F9', overflow: 'hidden' }}>
                        <img src={getImageUrl(p.image_urls?.[0])} alt={p.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#1E293B', marginBottom: 6, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.product_name}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: '#E11D48' }}>{formatCurrency(p.price)}</span>
                          <span style={{ fontSize: 11, color: C.gray }}>&#11088; {parseFloat(p.rating).toFixed(1)}</span>
                        </div>
                        <p style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>Da ban {(p.sales_count || 0).toLocaleString('vi-VN')}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Het san pham cua shop -> goi y them san pham khac de nguoi dung tiep tuc xem */}
            <SuggestedDealsSection />
          </div>
        )}

        {tab === 1 && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ background: 'white', borderRadius: 16, padding: 28, border: `1px solid ${C.border}`, marginBottom: 24, display: 'flex', gap: 40, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 56, fontWeight: 900, color: C.gold, margin: 0 }}>{ratingNum.toFixed(1)}</p>
                <div style={{ display: 'flex', gap: 3, justifyContent: 'center', margin: '6px 0' }}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} style={{ color: i < Math.round(ratingNum) ? C.gold : '#D1D5DB', fontSize: 20 }}>&#9733;</span>
                  ))}
                </div>
                <p style={{ fontSize: 13, color: C.gray }}>Danh gia trung binh</p>
              </div>
              <div style={{ flex: 1 }}>
                {[5, 4, 3, 2, 1].map(star => {
                  const pct = star === 5 ? 70 : star === 4 ? 20 : star === 3 ? 7 : star === 2 ? 2 : 1
                  return (
                    <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: C.gray, width: 16 }}>{star}</span>
                      <span style={{ color: C.gold, fontSize: 12 }}>&#9733;</span>
                      <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: C.gold, borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, color: C.gray, width: 30 }}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <p style={{ color: C.gray, textAlign: 'center', fontSize: 14 }}>Tinh nang danh gia dang duoc phat trien.</p>
          </div>
        )}

        {tab === 2 && (
          <div style={{ maxWidth: 600 }}>
            <div style={{ background: 'white', borderRadius: 16, padding: 28, border: `1px solid ${C.border}`, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 20 }}>Thông tin shop</h3>
              {[
                { icon: '&#127978;', label: 'Tên shop',    value: shop.shop_name },
                { icon: '&#128205;', label: 'Địa chỉ',     value: shop.address },
                { icon: '&#128222;', label: 'Điện thoại',  value: shop.phone },
                { icon: '&#128231;', label: 'Email',       value: shop.email || 'Chưa cập nhật' },
                { icon: '&#128221;', label: 'Mô tả',       value: shop.description || 'Chưa có mô tả' },
                { icon: '&#10003;',  label: 'Trạng thái',  value: isVerified ? 'Đã xác thực' : 'Chưa xác thực' },
                { icon: '&#128197;', label: 'Tham gia',    value: shop.created_at ? new Date(shop.created_at).toLocaleDateString('vi-VN') : 'N/A' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 18, width: 24, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: row.icon }} />
                  <div>
                    <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{row.label}</p>
                    <p style={{ fontSize: 14, color: '#1E293B', margin: '2px 0 0', fontWeight: 500 }}>{row.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: 16, padding: 28, border: `1px solid ${C.border}` }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 20 }}>Số liệu hoạt động</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 16 }}>
                {[
                  { icon: '&#128230;', label: 'Sản phẩm',  value: (shop.products?.length || 0).toLocaleString('vi-VN') },
                  { icon: '&#128176;', label: 'Đã bán',    value: (shop.total_orders || 0).toLocaleString('vi-VN') },
                  { icon: '&#128101;', label: 'Người theo dõi', value: ((shop.total_followers || 0) + followerDelta).toLocaleString('vi-VN') },
                  { icon: '&#11088;',  label: 'Đánh giá',  value: ratingNum.toFixed(1) },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', background: C.light, borderRadius: 12, padding: '14px 8px' }}>
                    <span style={{ fontSize: 18 }} dangerouslySetInnerHTML={{ __html: s.icon }} />
                    <p style={{ fontWeight: 800, fontSize: 16, color: C.navy, margin: '4px 0 0' }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default ShopProfilePage
