/**
 * super/frontend/pages/SuperMediaLibrary.tsx
 * -----------------------------------------------
 * Superadmin — "Thư viện ảnh": xem TOÀN BỘ ảnh đã upload trong hệ thống
 * (sản phẩm, banner, shop, avatar user...), bất kể tính năng nào tạo ra.
 * Mọi ảnh upload đi qua save_upload_file() đều tự động có mặt ở đây với
 * 1 mã (code) riêng — đây là nơi duy nhất super "thấy" hết ảnh hệ thống.
 */
import React, { useEffect, useState, useCallback } from 'react'
import superApi from '../superApi'
import { getImageUrl } from '@/utils/helpers'

const S = {
  bg:      '#0a0a0f',
  card:    '#13131a',
  border:  '#1e1e2e',
  red:     '#dc2626',
  redDark: '#7f1d1d',
  green:   '#16a34a',
  orange:  '#d97706',
  text:    '#f1f5f9',
  muted:   '#475569',
  input:   '#1e1e2e',
}

interface MediaItem {
  media_id: number
  code: string
  url: string
  subfolder: string
  original_filename: string | null
  content_type: string | null
  size_bytes: number | null
  uploaded_by: number | null
  uploaded_by_email: string | null
  created_at: string | null
}

const SUBFOLDER_LABEL: Record<string, string> = {
  products: 'Sản phẩm',
  banners: 'Banner',
  shops: 'Shop',
  users: 'Avatar người dùng',
  shop_registrations: 'Đăng ký shop',
}

const fmtSize = (b: number | null) => {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

const SuperMediaLibrary: React.FC = () => {
  const [items, setItems]   = useState<MediaItem[]>([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [subfolder, setSubfolder] = useState('all')
  const [q, setQ]           = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats]   = useState<{ subfolder: string; count: number }[]>([])
  const [statsTotal, setStatsTotal] = useState(0)
  const [preview, setPreview] = useState<MediaItem | null>(null)

  const load = useCallback((p = page, sf = subfolder, query = q) => {
    setLoading(true)
    const params: any = { page: p, limit: 40 }
    if (sf !== 'all') params.subfolder = sf
    if (query) params.q = query
    superApi.get('/media', { params })
      .then(r => { setItems(r.data.items || []); setTotal(r.data.total || 0) })
      .finally(() => setLoading(false))
  }, [page, subfolder, q])

  useEffect(() => { load(1, subfolder, q) }, [subfolder])
  useEffect(() => { load() }, [page])
  useEffect(() => {
    superApi.get('/media/stats').then(r => { setStats(r.data.by_subfolder || []); setStatsTotal(r.data.total || 0) }).catch(() => {})
  }, [])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(1, subfolder, q) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ color: S.text, fontSize: 20, fontWeight: 800, margin: 0 }}>🗂️ Thư viện ảnh</h1>
        <p style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>
          Toàn bộ ảnh đã upload trong hệ thống ({statsTotal} ảnh) — sản phẩm, banner, shop, avatar... mọi upload đều tự động ghi vào đây.
        </p>
      </div>

      {/* Filter chips theo subfolder */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setSubfolder('all')}
          style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: subfolder === 'all' ? S.red : S.card, color: subfolder === 'all' ? '#fff' : S.muted }}>
          Tất cả ({statsTotal})
        </button>
        {stats.map(s => (
          <button key={s.subfolder} onClick={() => setSubfolder(s.subfolder)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: subfolder === s.subfolder ? S.red : S.card, color: subfolder === s.subfolder ? '#fff' : S.muted }}>
            {SUBFOLDER_LABEL[s.subfolder] || s.subfolder} ({s.count})
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên file..."
          style={{ padding: '7px 12px', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none', width: 260 }} />
        <button type="submit" style={{ padding: '7px 14px', background: S.red, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Tìm</button>
      </form>

      {loading ? (
        <div style={{ color: S.muted, textAlign: 'center', padding: 40 }}>Đang tải...</div>
      ) : items.length === 0 ? (
        <div style={{ color: S.muted, textAlign: 'center', padding: 40, background: S.card, borderRadius: 12, border: `1px solid ${S.border}` }}>
          Không có ảnh nào.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {items.map(m => (
            <div key={m.media_id} onClick={() => setPreview(m)}
              style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{ height: 100, background: '#0a0a0f' }}>
                <img src={getImageUrl(m.url)} alt={m.original_filename || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: '6px 8px' }}>
                <p style={{ color: S.text, fontSize: 10, fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.original_filename || m.code}
                </p>
                <p style={{ color: S.muted, fontSize: 10, margin: 0 }}>{SUBFOLDER_LABEL[m.subfolder] || m.subfolder}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 40 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>← Trước</button>
          <span style={{ padding: '7px 14px', color: S.muted, fontSize: 13 }}>Trang {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={items.length < 40}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>Tiếp →</button>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setPreview(null)}>
          <div style={{ width: 480, background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: S.text, fontSize: 14, fontWeight: 800, margin: 0 }}>Chi tiết ảnh</h2>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <img src={getImageUrl(preview.url)} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 8, background: '#0a0a0f' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <p style={{ color: S.muted, margin: 0 }}>Mã ảnh: <span style={{ color: S.text }}>{preview.code}</span></p>
              <p style={{ color: S.muted, margin: 0 }}>Tên file gốc: <span style={{ color: S.text }}>{preview.original_filename || '—'}</span></p>
              <p style={{ color: S.muted, margin: 0 }}>Thuộc: <span style={{ color: S.text }}>{SUBFOLDER_LABEL[preview.subfolder] || preview.subfolder}</span></p>
              <p style={{ color: S.muted, margin: 0 }}>Kích thước: <span style={{ color: S.text }}>{fmtSize(preview.size_bytes)}</span></p>
              <p style={{ color: S.muted, margin: 0 }}>Người upload: <span style={{ color: S.text }}>{preview.uploaded_by_email || (preview.uploaded_by ? `#${preview.uploaded_by}` : '—')}</span></p>
              <p style={{ color: S.muted, margin: 0 }}>Thời gian: <span style={{ color: S.text }}>{preview.created_at ? new Date(preview.created_at).toLocaleString('vi-VN') : '—'}</span></p>
              <p style={{ color: S.muted, margin: 0 }}>Đường dẫn: <span style={{ color: S.text, wordBreak: 'break-all' }}>{preview.url}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperMediaLibrary
