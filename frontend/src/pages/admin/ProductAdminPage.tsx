import React, { useEffect, useState, useRef, useCallback } from 'react'
import { toast } from 'react-toastify'
import { adminService } from '../../services/adminService'
import { productService } from '../../services/productService'
import { formatCurrency } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'
import { variantStore, bundleStore, attributeStore } from '../../utils/productBundleStore'
import Loading from '../../components/common/Loading'

const C = {
  navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF',
  gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626',
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  all:      { label: 'Tất cả',    color: C.blue,    bg: C.light },
  pending:  { label: 'Chờ duyệt', color: C.warning, bg: '#FEF3C7' },
  active:   { label: 'Đang bán',  color: C.success, bg: '#DCFCE7' },
  hidden:   { label: 'Đã ẩn',     color: C.gray,    bg: '#F1F5F9' },
  rejected: { label: 'Từ chối',   color: C.error,   bg: '#FEE2E2' },
}

interface Product {
  product_id: number; product_name: string; shop_id: number
  price: string; stock_quantity: number; image_urls: string[]
  status: string; sales_count?: number; description?: string; video_url?: string
}

type Ann = { id: string; section: string; label: string; note: string; imgMarkers?: { x: number; y: number }[] }

// ─────────────────────────────────────────────
//  ANNOTATION DETAIL MODAL
// ─────────────────────────────────────────────
const ProductDetailModal: React.FC<{
  data: any
  onClose: () => void
  onApprove: (id: number) => void
  onRejectWithNotes: (id: number, reason: string) => void
  openImgModal: (p: Product) => void
}> = ({ data, onClose, onApprove, onRejectWithNotes, openImgModal }) => {
  const { p, variants, allAttrs, allPromos, accessories, gifts, imgs, price, stock } = data
  const st = STATUS[p.status] ?? STATUS.pending

  const [annotateMode, setAnnotateMode] = useState(false)
  const [annotations, setAnnotations]   = useState<Ann[]>([])
  const [activeAnn, setActiveAnn]       = useState<string | null>(null)   // section being noted
  const [noteInput, setNoteInput]       = useState('')
  const [activeImg, setActiveImg]       = useState(imgs[0] || '')
  const imgRef = useRef<HTMLDivElement>(null)

  // Image click → add circle marker
  const handleImgClick = useCallback((e: React.MouseEvent) => {
    if (!annotateMode) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const key = 'img_' + activeImg
    setAnnotations(prev => {
      const existing = prev.find(a => a.section === key)
      if (existing) {
        return prev.map(a => a.section === key
          ? { ...a, imgMarkers: [...(a.imgMarkers || []), { x, y }] }
          : a)
      }
      return [...prev, { id: key, section: key, label: 'Ảnh sản phẩm', note: '', imgMarkers: [{ x, y }] }]
    })
    setActiveAnn(key)
    setNoteInput(annotations.find(a => a.section === key)?.note || '')
  }, [annotateMode, activeImg, annotations])

  const flagSection = (section: string, label: string) => {
    if (!annotateMode) return
    setAnnotations(prev => prev.find(a => a.section === section)
      ? prev : [...prev, { id: section, section, label, note: '' }])
    setActiveAnn(section)
    setNoteInput(annotations.find(a => a.section === section)?.note || '')
  }

  const saveNote = () => {
    if (!activeAnn) return
    setAnnotations(prev => prev.map(a => a.section === activeAnn ? { ...a, note: noteInput } : a))
    setActiveAnn(null); setNoteInput('')
  }

  const removeAnn = (section: string) => setAnnotations(prev => prev.filter(a => a.section !== section))

  const isFlagged = (section: string) => annotations.some(a => a.section === section)

  // Build rejection reason from annotations
  const buildReason = () => {
    if (!annotations.length) return ''
    return '⚠️ Sản phẩm bị từ chối vì các nội dung vi phạm sau:\n\n' +
      annotations.map((a, i) => {
        const markerInfo = a.imgMarkers?.length ? ` (${a.imgMarkers.length} vị trí đánh dấu)` : ''
        return `${i + 1}. ${a.label}${markerInfo}${a.note ? ': ' + a.note : ''}`
      }).join('\n')
  }

  const FlagBtn = ({ section, label }: { section: string; label: string }) => {
    if (!annotateMode) return null
    const flagged = isFlagged(section)
    return (
      <button onClick={() => flagSection(section, label)} style={{
        marginLeft: 8, padding: '2px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
        background: flagged ? '#FEE2E2' : '#FEF3C7',
        color: flagged ? C.error : C.warning,
        outline: flagged ? `2px solid ${C.error}` : 'none',
      }}>
        {flagged ? '🚩 Đã đánh dấu' : '🚩 Đánh dấu'}
      </button>
    )
  }

  const sectionStyle = (section: string): React.CSSProperties => ({
    borderRadius: 10, transition: 'all 0.15s',
    outline: annotateMode && isFlagged(section) ? `2px solid ${C.error}` : annotateMode ? '2px dashed #FCD34D' : 'none',
    outlineOffset: 2,
    cursor: annotateMode ? 'pointer' : 'default',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 960, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 72px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: C.navy }}>📋 Chi tiết sản phẩm</h2>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => { setAnnotateMode(m => !m); setAnnotations([]); setActiveAnn(null) }} style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: annotateMode ? C.error : '#FEF3C7', color: annotateMode ? 'white' : C.warning,
              boxShadow: annotateMode ? '0 0 0 2px ' + C.error : 'none',
            }}>
              {annotateMode ? '✏️ Đang đánh dấu vi phạm — Tắt' : '🚩 Đánh dấu vi phạm'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray }}>✕</button>
          </div>
        </div>

        {/* Annotation mode banner */}
        {annotateMode && (
          <div style={{ background: '#FEF3C7', borderBottom: '1px solid #FCD34D', padding: '8px 24px', fontSize: 12, color: '#92400E', fontWeight: 600, flexShrink: 0 }}>
            ✏️ Chế độ đánh dấu vi phạm: Click vào ảnh để khoanh tròn · Click nút 🚩 bên cạnh từng mục để đánh dấu · {annotations.length > 0 ? `${annotations.length} mục đã đánh dấu` : 'Chưa có mục nào'}
          </div>
        )}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Body scroll */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', gap: 24 }}>

            {/* Left — image gallery */}
            <div style={{ flexShrink: 0, width: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Main image with markers */}
              <div ref={imgRef} onClick={handleImgClick}
                style={{ width: 300, height: 260, borderRadius: 12, overflow: 'hidden', background: '#F1F5F9', position: 'relative', cursor: annotateMode ? 'crosshair' : 'default', ...sectionStyle('img_' + activeImg) }}>
                {activeImg
                  ? <img src={getImageUrl(activeImg)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, color: '#CBD5E1' }}>🛍️</div>
                }
                {/* Circle markers on image */}
                {annotations.find(a => a.section === 'img_' + activeImg)?.imgMarkers?.map((m, mi) => (
                  <div key={mi} style={{
                    position: 'absolute', left: `${m.x}%`, top: `${m.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 36, height: 36, borderRadius: '50%',
                    border: '3px solid #DC2626', background: 'rgba(220,38,38,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#DC2626', fontSize: 12, fontWeight: 800, pointerEvents: 'none',
                    boxShadow: '0 0 0 2px white',
                  }}>{mi + 1}</div>
                ))}
                {annotateMode && (
                  <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(220,38,38,0.85)', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>
                    Click để đánh dấu vị trí vi phạm
                  </div>
                )}
                {annotateMode && isFlagged('img_' + activeImg) && (
                  <div style={{ position: 'absolute', bottom: 8, right: 8, background: '#DC2626', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>
                    🚩 {annotations.find(a => a.section === 'img_' + activeImg)?.imgMarkers?.length || 0} điểm
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {imgs.length > 1 && (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {imgs.map((url: string, i: number) => (
                    <img key={i} src={getImageUrl(url)} alt="" onClick={() => setActiveImg(url)}
                      style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', cursor: 'pointer',
                        border: activeImg === url ? `2px solid ${C.blue}` : `2px solid ${C.light}`,
                        outline: annotateMode && isFlagged('img_' + url) ? `2px solid ${C.error}` : 'none' }} />
                  ))}
                </div>
              )}

              {p.video_url && <video src={p.video_url} controls style={{ width: '100%', borderRadius: 10 }} />}

              <button onClick={() => { onClose(); openImgModal(p) }}
                style={{ padding: '8px', background: C.tint, color: C.blue, border: '1px solid ' + C.light, borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                📷 Sửa ảnh sản phẩm
              </button>
            </div>

            {/* Right — info */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Name */}
              <div style={{ padding: '10px 12px', ...sectionStyle('name') }} onClick={() => annotateMode && flagSection('name', 'Tên sản phẩm')}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: 19, fontWeight: 800, color: C.navy }}>{p.product_name}</h3>
                  <FlagBtn section="name" label="Tên sản phẩm" />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(price)}</span>
                  <FlagBtn section="price" label="Giá sản phẩm" />
                  <span style={{ fontSize: 13, color: C.gray }}>Shop #{p.shop_id} · Tồn: <b>{stock}</b> · Bán: <b>{p.sales_count ?? 0}</b></span>
                </div>
              </div>

              {/* Description */}
              {p.description && (
                <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: 10, ...sectionStyle('desc') }} onClick={() => annotateMode && flagSection('desc', 'Mô tả sản phẩm')}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase' }}>📝 Mô tả</span>
                    <FlagBtn section="desc" label="Mô tả sản phẩm" />
                  </div>
                  <p style={{ fontSize: 13, color: C.gray, lineHeight: 1.7 }}>{p.description}</p>
                </div>
              )}

              {/* Variants */}
              {variants.length > 1 && (
                <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', ...sectionStyle('variants') }} onClick={() => annotateMode && flagSection('variants', 'Phiên bản sản phẩm')}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase' }}>🔀 {variants.length} phiên bản</span>
                    <FlagBtn section="variants" label="Phiên bản sản phẩm" />
                  </div>
                  {variants.map((v: any, vi: number) => (
                    <div key={vi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 5 }}>
                      {(v.image_urls || []).length > 0 && <img src={getImageUrl(v.image_urls[0])} alt="" style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{v.name || `Phiên bản ${vi + 1}`}</div>
                        <div style={{ fontSize: 12, color: C.gray }}>{formatCurrency(v.price)} · Tồn: {v.stock}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Attributes */}
              {allAttrs.length > 0 && (
                <div style={{ padding: '10px 12px', ...sectionStyle('attrs') }} onClick={() => annotateMode && flagSection('attrs', 'Thuộc tính sản phẩm')}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase' }}>🏷️ Thuộc tính</span>
                    <FlagBtn section="attrs" label="Thuộc tính sản phẩm" />
                  </div>
                  {allAttrs.map((attr: any, ai: number) => (
                    <div key={ai} style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.navy, minWidth: 80 }}>{attr.name}:</span>
                      {(attr.values || []).map((val: any, vi: number) => (
                        <span key={vi} style={{ fontSize: 12, padding: '2px 9px', borderRadius: 12, background: '#EEF2FF', color: '#4F46E5', fontWeight: 600 }}>
                          {val.label || val}{val.price_delta ? ` (+${Number(val.price_delta).toLocaleString('vi-VN')}₫)` : ''}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Promos */}
              {allPromos.length > 0 && (
                <div style={{ padding: '10px 12px', ...sectionStyle('promos') }} onClick={() => annotateMode && flagSection('promos', 'Chương trình ưu đãi')}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase' }}>🎯 Ưu đãi</span>
                    <FlagBtn section="promos" label="Chương trình ưu đãi" />
                  </div>
                  {allPromos.map((r: any, ri: number) => (
                    <div key={ri} style={{ padding: '7px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 5 }}>
                      🎁 {r.condition_type === 'quantity' ? `Mua ${r.condition_value} sp` : `Đơn từ ${Number(r.condition_value).toLocaleString('vi-VN')}₫`}
                      {' → '}{r.reward_type === 'free' ? 'Tặng miễn phí' : r.reward_type === 'discount' ? `Giảm ${r.reward_value}%` : `Giảm ${formatCurrency(r.reward_value)}`}
                    </div>
                  ))}
                </div>
              )}

              {/* Accessories */}
              {accessories.length > 0 && (
                <div style={{ padding: '10px 12px', ...sectionStyle('accessories') }} onClick={() => annotateMode && flagSection('accessories', 'Phụ kiện đi kèm')}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase' }}>📦 Phụ kiện ({accessories.length})</span>
                    <FlagBtn section="accessories" label="Phụ kiện đi kèm" />
                  </div>
                  {accessories.map((b: any, bi: number) => (
                    <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#F8FAFC', border: '1px solid var(--border-subtle)', borderRadius: 8, marginBottom: 5 }}>
                      {(b.image_urls || []).length > 0 && <img src={getImageUrl(b.image_urls[0])} alt="" style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover' }} />}
                      <div><div style={{ fontSize: 13, fontWeight: 700 }}>{b.name}</div><div style={{ fontSize: 12, color: C.success, fontWeight: 700 }}>{formatCurrency(b.price)}</div></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Gifts */}
              {gifts.length > 0 && (
                <div style={{ padding: '10px 12px', ...sectionStyle('gifts') }} onClick={() => annotateMode && flagSection('gifts', 'Hàng tặng kèm')}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase' }}>🎁 Tặng kèm ({gifts.length})</span>
                    <FlagBtn section="gifts" label="Hàng tặng kèm" />
                  </div>
                  {gifts.map((b: any, bi: number) => (
                    <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, marginBottom: 5 }}>
                      {(b.image_urls || []).length > 0 && <img src={getImageUrl(b.image_urls[0])} alt="" style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover' }} />}
                      <div><div style={{ fontSize: 13, fontWeight: 700 }}>{b.name}</div><div style={{ fontSize: 12, color: C.warning, fontWeight: 700 }}>{b.price > 0 ? formatCurrency(b.price) : '🎁 Miễn phí'}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar — annotation notes */}
          {annotateMode && annotations.length > 0 && (
            <div style={{ width: 240, borderLeft: '1px solid var(--border-subtle)', overflowY: 'auto', padding: 14, flexShrink: 0, background: '#FFF9F9' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.error, marginBottom: 10, textTransform: 'uppercase' }}>🚩 Vi phạm đã đánh dấu</div>
              {annotations.map(a => (
                <div key={a.id} style={{ marginBottom: 10, padding: '8px 10px', background: 'white', borderRadius: 8, border: `1px solid ${C.error}30` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.error }}>🚩 {a.label}</span>
                    <button onClick={() => removeAnn(a.section)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: C.gray, lineHeight: 1, padding: 0 }}>✕</button>
                  </div>
                  {a.imgMarkers?.length ? <div style={{ fontSize: 10, color: C.gray, marginBottom: 4 }}>{a.imgMarkers.length} điểm đánh dấu trên ảnh</div> : null}
                  {activeAnn === a.section ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
                        placeholder="Ghi chú lý do vi phạm..."
                        rows={2} style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #FCA5A5', outline: 'none', resize: 'none', width: '100%' }} />
                      <button onClick={saveNote} style={{ padding: '3px 8px', background: C.error, color: 'white', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Lưu</button>
                    </div>
                  ) : (
                    <div onClick={() => { setActiveAnn(a.section); setNoteInput(a.note) }}
                      style={{ fontSize: 11, color: a.note ? C.gray : '#9CA3AF', cursor: 'pointer', fontStyle: a.note ? 'normal' : 'italic' }}>
                      {a.note || 'Click để thêm ghi chú...'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
          {p.status === 'pending' && (
            <>
              <button onClick={() => { onApprove(p.product_id); onClose() }}
                style={{ flex: 1, padding: '11px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                ✅ Duyệt sản phẩm
              </button>
              <button onClick={() => onRejectWithNotes(p.product_id, buildReason())}
                style={{ flex: 1, padding: '11px', background: annotations.length > 0 ? C.error : '#FEE2E2', color: annotations.length > 0 ? 'white' : C.error, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {annotations.length > 0 ? `❌ Từ chối (${annotations.length} vi phạm)` : '❌ Từ chối'}
              </button>
            </>
          )}
          {p.status !== 'pending' && (
            <div style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: 10, background: st.bg, color: st.color, fontWeight: 700 }}>{st.label}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────
const ProductAdminPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('all')
  const [search, setSearch]     = useState('')
  const [detail, setDetail]     = useState<any | null>(null)
  const [imgModal, setImgModal]         = useState<Product | null>(null)
  const [previewUrl, setPreviewUrl]     = useState('')
  const [pendingFile, setPendingFile]   = useState<File | null>(null)
  const [uploading, setUploading]       = useState(false)
  const [rejectModal, setRejectModal]   = useState<{ id: number; reason: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = (status = tab, q = search) => {
    setLoading(true)
    adminService.getAllProducts(status === 'all' ? undefined : status, q || undefined)
      .then(r => setProducts(r.data?.products || []))
      .catch(() => toast.error('Không tải được danh sách'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load(tab, search) }, [tab]) // eslint-disable-line

  const handleApprove = async (id: number) => {
    try { await adminService.approveProduct(id); toast.success('Đã duyệt'); setProducts(p => p.map(x => x.product_id === id ? { ...x, status: 'active' } : x)) }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Lỗi') }
  }

  const handleRejectSubmit = async () => {
    if (!rejectModal) return
    if (!rejectModal.reason.trim()) { toast.warning('Nhập lý do từ chối'); return }
    try {
      await adminService.rejectProduct(rejectModal.id, rejectModal.reason)
      toast.success('Đã từ chối')
      setProducts(p => p.map(x => x.product_id === rejectModal.id ? { ...x, status: 'rejected' } : x))
      setRejectModal(null)
    } catch { toast.error('Lỗi') }
  }

  const handleRejectWithNotes = (id: number, reason: string) => {
    setDetail(null)
    setRejectModal({ id, reason })
  }

  const openImgModal = (p: Product) => { setImgModal(p); setPreviewUrl(p.image_urls?.[0] || ''); setPendingFile(null) }
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setPendingFile(f); setPreviewUrl(URL.createObjectURL(f)); e.target.value = ''
  }
  const handleSaveImage = async () => {
    if (!imgModal) return; setUploading(true)
    try {
      let url = imgModal.image_urls?.[0] || ''
      if (pendingFile) { const r = await productService.uploadImage(pendingFile); url = r.data?.url || r.data }
      await adminService.updateProductImage(imgModal.product_id, url ? [url] : [])
      toast.success('Đã cập nhật ảnh!')
      setProducts(p => p.map(x => x.product_id === imgModal.product_id ? { ...x, image_urls: url ? [url] : [] } : x))
      setImgModal(null)
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Thất bại') }
    finally { setUploading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🏷️ Quản lý sản phẩm</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Duyệt, ẩn/hiện, chỉnh ảnh — click card để xem chi tiết & đánh dấu vi phạm</p>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {Object.entries(STATUS).map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === k ? v.color : C.tint, color: tab === k ? 'white' : C.gray }}>{v.label}</button>
        ))}
        <form onSubmit={e => { e.preventDefault(); load(tab, search) }} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 180 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm sản phẩm..."
            style={{ flex: 1, padding: '7px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }} />
          <button type="submit" style={{ padding: '7px 14px', borderRadius: 8, background: C.blue, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Tìm</button>
        </form>
      </div>

      {/* Grid */}
      {loading ? <Loading /> : products.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>Không có sản phẩm nào</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {products.map(p => {
            const variants    = variantStore.get(p.product_id)
            const allBundles  = bundleStore.get(p.product_id)
            const attrs       = attributeStore.get(p.product_id)
            const mainV       = variants[0]
            const imgs        = mainV?.image_urls?.length ? mainV.image_urls : (p.image_urls || [])
            const price       = mainV?.price || Number(p.price) || 0
            const stock       = mainV?.stock ?? p.stock_quantity ?? 0
            const allAttrs    = mainV?.attrs?.length ? mainV.attrs : attrs.map((a: any) => ({ name: a.name, values: a.values.map((v: string) => ({ label: v, price_delta: 0 })) }))
            const allPromos   = variants.flatMap((v: any) => v.promos || [])
            const accessories = allBundles.filter((b: any) => b.type === 'accessory')
            const gifts       = allBundles.filter((b: any) => b.type === 'gift')
            const st          = STATUS[p.status] ?? STATUS.pending
            const openDetail  = () => setDetail({ p, variants, allAttrs, allPromos, accessories, gifts, imgs, price, stock })

            return (
              <div key={p.product_id} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', width: '100%', paddingTop: '55%', background: '#F1F5F9', overflow: 'hidden', cursor: 'pointer' }} onClick={openDetail}>
                  {imgs[0] ? <img src={getImageUrl(imgs[0])} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, color: '#CBD5E1' }}>🛍️</div>}
                  {imgs.length > 1 && (
                    <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 4 }}>
                      {imgs.slice(1, 4).map((url: string, i: number) => <img key={i} src={getImageUrl(url)} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', border: '2px solid white' }} />)}
                    </div>
                  )}
                  <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                  <button onClick={e => { e.stopPropagation(); openImgModal(p) }} style={{ position: 'absolute', bottom: 6, right: 6, padding: '4px 8px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>📷 Sửa ảnh</button>
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.navy, lineHeight: 1.3, cursor: 'pointer' }} onClick={openDetail}>{p.product_name}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(price)}</span>
                      <span style={{ fontSize: 11, color: C.gray }}>Shop #{p.shop_id} · Tồn: {stock}</span>
                    </div>
                  </div>
                  {accessories.length > 0 && <div style={{ fontSize: 11, color: C.gray }}>📦 {accessories.length} phụ kiện · 🎁 {gifts.length} tặng kèm</div>}
                  <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
                    {p.status === 'pending' ? (
                      <>
                        <button onClick={() => handleApprove(p.product_id)} style={{ flex: 1, padding: '7px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✅ Duyệt</button>
                        <button onClick={() => setRejectModal({ id: p.product_id, reason: '' })} style={{ flex: 1, padding: '7px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>❌ Từ chối</button>
                      </>
                    ) : (
                      <div style={{ flex: 1, textAlign: 'center', padding: '6px', borderRadius: 7, background: st.bg, color: st.color, fontSize: 12, fontWeight: 700 }}>{st.label}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <ProductDetailModal data={detail} onClose={() => setDetail(null)}
          onApprove={handleApprove} onRejectWithNotes={handleRejectWithNotes} openImgModal={openImgModal} />
      )}

      {/* Reject modal */}
      {rejectModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setRejectModal(null)}>
          <div className="card" style={{ width: 480, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>❌ Lý do từ chối</h2>
              <button onClick={() => setRejectModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            <textarea className="input" rows={6} placeholder="Nhập lý do từ chối..." value={rejectModal.reason}
              onChange={e => setRejectModal(r => r ? { ...r, reason: e.target.value } : r)}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectModal(null)} style={{ padding: '9px 20px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', color: C.gray }}>Hủy</button>
              <button onClick={handleRejectSubmit} style={{ padding: '9px 24px', background: C.error, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Từ chối</button>
            </div>
          </div>
        </div>
      )}

      {/* Image upload modal */}
      {imgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !uploading && setImgModal(null)}>
          <div className="card" style={{ width: 400, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>📷 Cập nhật ảnh</h2>
              <button onClick={() => setImgModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: C.gray, marginTop: -10 }}><strong>{imgModal.product_name}</strong></p>
            <div style={{ width: '100%', height: 200, borderRadius: 10, overflow: 'hidden', border: '2px dashed var(--border-subtle)', background: C.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              onClick={() => fileRef.current?.click()}>
              {previewUrl ? <img src={previewUrl.startsWith('blob:') ? previewUrl : getImageUrl(previewUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ textAlign: 'center', color: C.gray }}><div style={{ fontSize: 40, marginBottom: 8 }}>🖼️</div><p style={{ fontSize: 13 }}>Click để chọn ảnh</p></div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: '9px', background: C.blue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📁 Chọn ảnh</button>
              {previewUrl && <button onClick={() => { setPreviewUrl(''); setPendingFile(null) }} style={{ padding: '9px 14px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>✕</button>}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              <button onClick={() => setImgModal(null)} disabled={uploading} style={{ padding: '9px 20px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', color: C.gray }}>Hủy</button>
              <button onClick={handleSaveImage} disabled={uploading} style={{ padding: '9px 24px', background: uploading ? '#9CA3AF' : C.success, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer' }}>
                {uploading ? 'Đang lưu...' : '💾 Lưu vào DB'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductAdminPage
