/**
 * super/frontend/pages/SuperFlashSale.tsx
 * -------------------------------------------
 * Superadmin — ghim tối đa 10 sản phẩm cố định lên đầu khu Flash Sale trang
 * chủ. Đây là nguồn dữ liệu DUY NHẤT mà GET /api/v1/products/flash-sale ưu
 * tiên đọc (khi có ít nhất 1 pick) — nên thay đổi ở đây có hiệu lực NGAY
 * trên trang chủ thật. Rỗng thì trang chủ tự fallback về top bán chạy.
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

interface Pick {
  pick_id: number
  sort_order: number
  product_id: number
  product_name: string | null
  price: number | null
  image_urls: string[] | null
  status: string | null
  sales_count: number | null
  shop_id: number | null
}

interface SearchProduct {
  product_id: number
  product_name: string
  price: number
  image_urls: string[] | null
  shop_id: number | null
  already_picked: boolean
}

const fmt = (n: number | null) => Number(n || 0).toLocaleString('vi-VN') + '₫'
const thumb = (imgs: string[] | null) => imgs && imgs.length > 0 ? getImageUrl(imgs[0]) : ''

const SuperFlashSale: React.FC = () => {
  const [picks, setPicks]     = useState<Pick[]>([])
  const [max, setMax]         = useState(10)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<number | null>(null)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [q, setQ]                   = useState('')
  const [results, setResults]       = useState<SearchProduct[]>([])
  const [searching, setSearching]   = useState(false)
  const [adding, setAdding]         = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    superApi.get('/flash-sale')
      .then(r => { setPicks(r.data.picks || []); setMax(r.data.max ?? 10) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const runSearch = useCallback((query: string) => {
    setSearching(true)
    superApi.get('/flash-sale/search-products', { params: { q: query } })
      .then(r => setResults(r.data.products || []))
      .finally(() => setSearching(false))
  }, [])

  useEffect(() => {
    if (!pickerOpen) return
    const t = setTimeout(() => runSearch(q), 300)
    return () => clearTimeout(t)
  }, [q, pickerOpen, runSearch])

  const openPicker = () => { setQ(''); setResults([]); setPickerOpen(true); runSearch('') }

  const handleAdd = async (p: SearchProduct) => {
    setAdding(p.product_id)
    try {
      await superApi.post('/flash-sale', { product_id: p.product_id })
      setResults(rs => rs.map(r => r.product_id === p.product_id ? { ...r, already_picked: true } : r))
      load()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi ghim sản phẩm')
    } finally { setAdding(null) }
  }

  const handleRemove = async (p: Pick) => {
    if (!confirm(`Bỏ ghim "${p.product_name}" khỏi Flash Sale?`)) return
    setBusy(p.pick_id)
    try {
      await superApi.delete(`/flash-sale/${p.pick_id}`)
      setPicks(ps => ps.filter(x => x.pick_id !== p.pick_id))
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi xoá')
    } finally { setBusy(null) }
  }

  const handleMove = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= picks.length) return
    const reordered = [...picks]
    const [a] = reordered.splice(index, 1)
    reordered.splice(target, 0, a)
    setPicks(reordered)
    try {
      await Promise.all(reordered.map((p, i) =>
        p.sort_order !== i ? superApi.patch(`/flash-sale/${p.pick_id}`, { sort_order: i }) : Promise.resolve()
      ))
      setPicks(reordered.map((p, i) => ({ ...p, sort_order: i })))
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi đổi thứ tự')
      load()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ color: S.text, fontSize: 20, fontWeight: 800, margin: 0 }}>⚡ Flash Sale trang chủ</h1>
        <p style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>
          Ghim tối đa {max} sản phẩm cố định lên đầu khu Flash Sale ({picks.length}/{max}). Rỗng thì trang chủ tự
          động lấy top bán chạy — có sản phẩm ghim thì trang chủ CHỈ hiện đúng danh sách này, theo đúng thứ tự.
        </p>
      </div>

      <div>
        <button onClick={openPicker} disabled={picks.length >= max}
          style={{
            padding: '9px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: picks.length >= max ? S.card : S.red,
            color: picks.length >= max ? S.muted : '#fff',
            cursor: picks.length >= max ? 'not-allowed' : 'pointer',
          }}>
          + Thêm sản phẩm
        </button>
      </div>

      {loading ? (
        <div style={{ color: S.muted, textAlign: 'center', padding: 40 }}>Đang tải...</div>
      ) : picks.length === 0 ? (
        <div style={{ color: S.muted, textAlign: 'center', padding: 40, background: S.card, borderRadius: 12, border: `1px solid ${S.border}` }}>
          Chưa ghim sản phẩm nào — trang chủ đang tự động hiện top bán chạy.
        </div>
      ) : (
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0a0a0f' }}>
                {['#', 'Ảnh', 'Sản phẩm', 'Giá', 'Đã bán', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: S.muted, fontSize: 11, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {picks.map((p, i) => (
                <tr key={p.pick_id} style={{ borderBottom: `1px solid ${S.border}` }}>
                  <td style={{ padding: '8px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button onClick={() => handleMove(i, -1)} disabled={i === 0}
                        style={{ background: 'none', border: 'none', color: i === 0 ? '#2a2a38' : S.muted, cursor: i === 0 ? 'default' : 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}>▲</button>
                      <span style={{ color: S.muted, fontSize: 11, textAlign: 'center' }}>{i + 1}</span>
                      <button onClick={() => handleMove(i, 1)} disabled={i === picks.length - 1}
                        style={{ background: 'none', border: 'none', color: i === picks.length - 1 ? '#2a2a38' : S.muted, cursor: i === picks.length - 1 ? 'default' : 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}>▼</button>
                    </div>
                  </td>
                  <td style={{ padding: '8px 14px' }}>
                    {thumb(p.image_urls)
                      ? <img src={thumb(p.image_urls)} alt="" style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 6, background: '#0a0a0f' }} />
                      : <div style={{ width: 46, height: 46, borderRadius: 6, background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
                    }
                  </td>
                  <td style={{ padding: '8px 14px', color: S.text, fontWeight: 600 }}>
                    {p.product_name || `#${p.product_id}`}
                    {p.status !== 'active' && (
                      <span style={{ marginLeft: 8, color: S.orange, fontSize: 11, fontWeight: 700 }}>⚠ không còn active</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 14px', color: S.red, fontWeight: 700 }}>{fmt(p.price)}</td>
                  <td style={{ padding: '8px 14px', color: S.muted }}>{p.sales_count ?? 0}</td>
                  <td style={{ padding: '8px 14px' }}>
                    <button onClick={() => handleRemove(p)} disabled={busy === p.pick_id}
                      style={{ padding: '5px 9px', background: '#2d1010', color: '#ef4444', border: `1px solid ${S.redDark}`, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>🗑 Bỏ ghim</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product picker modal */}
      {pickerOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setPickerOpen(false)}>
          <div style={{ width: 480, maxHeight: '80vh', background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: S.text, fontSize: 15, fontWeight: 800, margin: 0 }}>Chọn sản phẩm ghim Flash Sale</h2>
              <button onClick={() => setPickerOpen(false)} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên sản phẩm..." autoFocus
              style={{ padding: '9px 12px', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {searching ? (
                <div style={{ color: S.muted, textAlign: 'center', padding: 20 }}>Đang tìm...</div>
              ) : results.length === 0 ? (
                <div style={{ color: S.muted, textAlign: 'center', padding: 20 }}>Không tìm thấy sản phẩm nào.</div>
              ) : results.map(p => (
                <div key={p.product_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#0a0a0f', borderRadius: 8 }}>
                  {thumb(p.image_urls)
                    ? <img src={thumb(p.image_urls)} alt="" style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                    : <div style={{ width: 38, height: 38, borderRadius: 6, background: S.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📦</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: S.text, fontSize: 12, fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.product_name}</p>
                    <p style={{ color: S.red, fontSize: 12, fontWeight: 700, margin: 0 }}>{fmt(p.price)}</p>
                  </div>
                  <button onClick={() => handleAdd(p)} disabled={p.already_picked || adding === p.product_id || picks.length >= max}
                    style={{
                      padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, flexShrink: 0,
                      background: p.already_picked ? S.card : S.green,
                      color: p.already_picked ? S.muted : '#fff',
                      cursor: p.already_picked ? 'default' : 'pointer',
                    }}>
                    {p.already_picked ? '✓ Đã ghim' : adding === p.product_id ? '...' : '+ Ghim'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperFlashSale
