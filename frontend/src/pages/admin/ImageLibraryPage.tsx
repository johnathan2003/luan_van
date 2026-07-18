/**
 * ImageLibraryPage.tsx
 * ---------------------
 * Trang admin quản lý kho ảnh tập trung.
 * - Hiển thị toàn bộ ảnh theo grid
 * - Thêm ảnh bằng URL hoặc upload file (→ /api/v1/products/upload-image)
 * - Lọc theo sản phẩm / shop
 * - Xoá ảnh khỏi thư viện
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  getAllImages,
  addImageByUrl,
  addImageByUpload,
  removeImage,
  getLibraryStats,
  ImageEntry,
} from '../../store/imageLibraryStore'

// ── Colours ────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0f0f1a',
  card:     '#16162a',
  border:   '#2a2a42',
  blue:     '#3b82f6',
  blueLight:'rgba(59,130,246,0.12)',
  green:    '#22c55e',
  greenLight:'rgba(34,197,94,0.12)',
  amber:    '#f59e0b',
  amberLight:'rgba(245,158,11,0.12)',
  red:      '#ef4444',
  redLight: 'rgba(239,68,68,0.12)',
  text:     '#f1f5f9',
  muted:    '#64748b',
  input:    '#1e1e33',
}

const SOURCE_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  seed:   { label: 'Seed',   color: C.amber,  bg: C.amberLight },
  url:    { label: 'URL',    color: C.blue,   bg: C.blueLight },
  upload: { label: 'Upload', color: C.green,  bg: C.greenLight },
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 20px', minWidth: 110 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ImageCard({ entry, onDelete }: { entry: ImageEntry; onDelete: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const src = SOURCE_LABEL[entry.source] ?? SOURCE_LABEL.url

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Thumbnail */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '75%', background: '#0a0a14', overflow: 'hidden' }}>
        {!errored ? (
          <img
            src={entry.url}
            alt={entry.label || entry.productName || 'image'}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 11,
          }}>
            <span style={{ fontSize: 28 }}>🖼️</span>
            <span style={{ marginTop: 4 }}>Không tải được</span>
          </div>
        )}
        {!loaded && !errored && (
          <div style={{
            position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#1a1a2e,#2a2a42,#1a1a2e)',
            backgroundSize: '200%', animation: 'shimmer 1.5s infinite',
          }} />
        )}
        {/* Source badge */}
        <span style={{
          position: 'absolute', top: 8, left: 8,
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
          background: src.bg, color: src.color, border: `1px solid ${src.color}44`,
        }}>
          {src.label}
        </span>
        {/* Delete btn */}
        <button
          onClick={onDelete}
          title="Xoá khỏi thư viện"
          style={{
            position: 'absolute', top: 6, right: 6, width: 26, height: 26,
            borderRadius: '50%', border: 'none', background: 'rgba(239,68,68,0.85)',
            color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entry.productName && (
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, lineHeight: 1.3 }} title={entry.productName}>
            {entry.productName.length > 35 ? entry.productName.slice(0, 35) + '…' : entry.productName}
          </div>
        )}
        {entry.shopName && (
          <div style={{ fontSize: 11, color: C.muted }}>🏪 {entry.shopName}</div>
        )}
        {entry.label && (
          <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>{entry.label}</div>
        )}
        {/* URL truncated */}
        <div style={{
          fontSize: 10, color: '#4b5563', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={entry.url}>
          {entry.url}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <a
            href={entry.url} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: C.blue, textDecoration: 'none' }}
          >
            ↗ Xem
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(entry.url)}
            style={{ fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            📋 Copy URL
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Image Panel ────────────────────────────────────────────────────────────

function AddImagePanel({ onAdded }: { onAdded: () => void }) {
  const [tab, setTab] = useState<'url' | 'upload'>('url')
  const [urlInput, setUrlInput]       = useState('')
  const [labelInput, setLabelInput]   = useState('')
  const [productInput, setProductInput] = useState('')
  const [uploading, setUploading]     = useState(false)
  const [msg, setMsg]                 = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  const handleAddUrl = () => {
    const url = urlInput.trim()
    if (!url) return flash('err', 'Nhập URL ảnh trước')
    if (!url.startsWith('http')) return flash('err', 'URL phải bắt đầu bằng http/https')
    addImageByUrl({ url, label: labelInput.trim() || undefined, productName: productInput.trim() || undefined })
    setUrlInput('')
    setLabelInput('')
    setProductInput('')
    flash('ok', '✅ Đã thêm ảnh vào thư viện')
    onAdded()
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/v1/products/upload-image', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const url: string = data.url || data
      addImageByUpload({ url, label: labelInput.trim() || file.name, productName: productInput.trim() || undefined })
      setLabelInput('')
      setProductInput('')
      flash('ok', `✅ Upload thành công: ${file.name}`)
      onAdded()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      flash('err', `❌ Upload thất bại: ${message}`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', background: C.input,
    border: `1px solid ${C.border}`, borderRadius: 8,
    color: C.text, fontSize: 13, outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: C.muted, marginBottom: 5, letterSpacing: '0.05em',
  }

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <h2 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: 0 }}>➕ Thêm ảnh mới</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['url', 'upload'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: tab === t ? C.blue : C.input,
            color: tab === t ? '#fff' : C.muted,
          }}>
            {t === 'url' ? '🔗 Nhập URL' : '📤 Upload file'}
          </button>
        ))}
      </div>

      {/* Shared fields */}
      <div>
        <label style={labelStyle}>TÊN SẢN PHẨM (tuỳ chọn)</label>
        <input
          value={productInput}
          onChange={e => setProductInput(e.target.value)}
          placeholder="Ví dụ: Tai nghe Sony WH-1000XM5"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>NHÃN / ALT TEXT (tuỳ chọn)</label>
        <input
          value={labelInput}
          onChange={e => setLabelInput(e.target.value)}
          placeholder="Mô tả ngắn về ảnh"
          style={inputStyle}
        />
      </div>

      {/* URL tab */}
      {tab === 'url' && (
        <>
          <div>
            <label style={labelStyle}>URL ẢNH</label>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://example.com/product.jpg"
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
            />
          </div>
          {urlInput.startsWith('http') && (
            <img
              src={urlInput} alt="preview"
              style={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }}
              onError={e => (e.currentTarget.style.display = 'none')}
            />
          )}
          <button onClick={handleAddUrl} style={{
            padding: '10px', background: C.blue, color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            🔗 Thêm bằng URL
          </button>
        </>
      )}

      {/* Upload tab */}
      {tab === 'upload' && (
        <>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleUpload(file)
            }}
            style={{
              border: `2px dashed ${C.border}`, borderRadius: 10,
              padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
              color: C.muted, fontSize: 13,
              background: uploading ? 'rgba(59,130,246,0.06)' : 'transparent',
            }}
          >
            {uploading ? '⏳ Đang upload...' : (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📤</div>
                <div>Kéo thả ảnh hoặc <span style={{ color: C.blue, fontWeight: 600 }}>chọn file</span></div>
                <div style={{ fontSize: 11, marginTop: 4 }}>JPG, PNG, WebP — tối đa 5MB</div>
              </>
            )}
          </div>
          <input
            ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
          />
        </>
      )}

      {/* Feedback */}
      {msg && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: msg.type === 'ok' ? C.greenLight : C.redLight,
          color: msg.type === 'ok' ? C.green : C.red,
        }}>
          {msg.text}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const ImageLibraryPage: React.FC = () => {
  const [images, setImages]       = useState<ImageEntry[]>([])
  const [filter, setFilter]       = useState('')        // tên sản phẩm / shop
  const [sourceFilter, setSourceFilter] = useState<'all' | 'url' | 'upload' | 'seed'>('all')
  const [stats, setStats]         = useState({ total: 0, byUrl: 0, byUpload: 0, bySeed: 0, linkedProducts: 0 })

  const reload = useCallback(() => {
    const all = getAllImages()
    setImages(all)
    setStats(getLibraryStats())
  }, [])

  useEffect(() => { reload() }, [reload])

  const filtered = images.filter(img => {
    const matchSource = sourceFilter === 'all' || img.source === sourceFilter
    const q = filter.toLowerCase()
    const matchText = !q || [img.productName, img.shopName, img.label, img.url]
      .some(s => s?.toLowerCase().includes(q))
    return matchSource && matchText
  })

  const handleDelete = (id: string) => {
    if (!confirm('Xoá ảnh này khỏi thư viện?')) return
    removeImage(id)
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0%{background-position:200% 0}
          100%{background-position:-200% 0}
        }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ color: C.text, fontSize: 22, fontWeight: 800, margin: 0 }}>🖼️ Thư viện ảnh</h1>
        <p style={{ color: C.muted, fontSize: 13, marginTop: 4, marginBottom: 0 }}>
          Kho ảnh tập trung — quản lý ảnh từ URL link và file upload
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatBadge label="Tổng ảnh"       value={stats.total}          color={C.text} />
        <StatBadge label="Từ URL"          value={stats.byUrl}          color={C.blue} />
        <StatBadge label="Upload file"     value={stats.byUpload}       color={C.green} />
        <StatBadge label="Ảnh mẫu (seed)" value={stats.bySeed}         color={C.amber} />
        <StatBadge label="Sản phẩm có ảnh" value={stats.linkedProducts} color='#a78bfa' />
      </div>

      {/* Body: sidebar + grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AddImagePanel onAdded={reload} />

          {/* Filters */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ color: C.text, fontSize: 13, fontWeight: 700, margin: 0 }}>🔍 Lọc ảnh</h3>
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Tên sản phẩm, shop, nhãn…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 10px', background: C.input,
                border: `1px solid ${C.border}`, borderRadius: 7,
                color: C.text, fontSize: 12, outline: 'none',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(['all', 'url', 'upload', 'seed'] as const).map(s => (
                <button key={s} onClick={() => setSourceFilter(s)} style={{
                  padding: '7px 12px', textAlign: 'left', borderRadius: 7,
                  border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: sourceFilter === s ? C.blueLight : 'transparent',
                  color: sourceFilter === s ? C.blue : C.muted,
                }}>
                  {s === 'all' ? '📋 Tất cả' : s === 'url' ? '🔗 URL link' : s === 'upload' ? '📤 Upload file' : '🌱 Ảnh mẫu (seed)'}
                </button>
              ))}
            </div>
            {(filter || sourceFilter !== 'all') && (
              <button onClick={() => { setFilter(''); setSourceFilter('all') }} style={{
                padding: '6px 10px', background: C.redLight, border: `1px solid ${C.red}44`,
                borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                ✕ Xoá bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* Image grid */}
        <div>
          <div style={{ marginBottom: 12, fontSize: 12, color: C.muted }}>
            Hiển thị <strong style={{ color: C.text }}>{filtered.length}</strong> / {images.length} ảnh
          </div>
          {filtered.length === 0 ? (
            <div style={{
              padding: '60px 20px', textAlign: 'center',
              color: C.muted, background: C.card,
              border: `1px dashed ${C.border}`, borderRadius: 14,
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🖼️</div>
              <div style={{ fontSize: 14 }}>Không tìm thấy ảnh nào</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Thêm ảnh bằng URL hoặc upload file ở bên trái</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 14,
            }}>
              {filtered.map(img => (
                <ImageCard
                  key={img.id}
                  entry={img}
                  onDelete={() => handleDelete(img.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageLibraryPage
