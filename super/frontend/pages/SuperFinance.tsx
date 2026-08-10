/**
 * super/frontend/pages/SuperFinance.tsx
 * ----------------------------------------
 * Superadmin — TIỀN CỦA HỆ THỐNG (platform_transactions), tách biệt hoàn
 * toàn với ví shop (SuperWallets.tsx). Full quyền CRUD: thêm/sửa/xoá
 * thẳng từng dòng giao dịch, không ràng buộc business rule.
 *
 * Quy ước dấu: amount dương = tiền vào hệ thống, âm = tiền ra.
 */
import React, { useEffect, useState } from 'react'
import superApi from '../superApi'

const S = {
  bg:      '#0a0a0f',
  card:    '#13131a',
  border:  '#1e1e2e',
  red:     '#dc2626',
  redDark: '#7f1d1d',
  text:    '#f1f5f9',
  muted:   '#475569',
  input:   '#1e1e2e',
  green:   '#16a34a',
  amber:   '#d97706',
}

const TYPES = ['commission', 'refund', 'payout', 'adjustment']
const STATUSES = ['completed', 'pending', 'cancelled']

const TYPE_LABEL: Record<string, string> = {
  commission: 'Hoa hồng', refund: 'Hoàn tiền', payout: 'Chi trả', adjustment: 'Điều chỉnh',
}
const STATUS_COLOR: Record<string, string> = {
  completed: '#16a34a', pending: '#d97706', cancelled: '#64748b',
}

interface Txn {
  txn_id:     number
  type:       string
  amount:     number
  shop_id:    number | null
  shop_name:  string | null
  order_id:   number | null
  status:     string
  note:       string | null
  created_at: string | null
}

const fmt = (n: number) => Number(n || 0).toLocaleString('vi-VN') + '₫'

const emptyForm = { type: 'adjustment', amount: '', shop_id: '', shop_name: '', order_id: '', status: 'completed', note: '' }

const SuperFinance: React.FC = () => {
  const [items, setItems] = useState<Txn[]>([])
  const [total, setTotal] = useState(0)
  const [balance, setBalance] = useState(0)
  const [byType, setByType] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)

  // Create/edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Txn | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = (t = typeFilter, p = page) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (t !== 'all') params.set('type', t)
    Promise.all([
      superApi.get(`/finance?${params}`),
      superApi.get('/finance/summary'),
    ]).then(([listRes, sumRes]) => {
      setItems(listRes.data.items || [])
      setTotal(listRes.data.total || 0)
      setBalance(sumRes.data.balance || 0)
      setByType(sumRes.data.by_type || {})
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [typeFilter, page])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (t: Txn) => {
    setEditing(t)
    setForm({
      type: t.type, amount: String(t.amount), shop_id: t.shop_id ?? '', shop_name: t.shop_name ?? '',
      order_id: t.order_id ?? '', status: t.status, note: t.note ?? '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: any = {
        type: form.type,
        amount: Number(form.amount),
        status: form.status,
        note: form.note || null,
        shop_id: form.shop_id ? Number(form.shop_id) : null,
        shop_name: form.shop_name || null,
        order_id: form.order_id ? Number(form.order_id) : null,
      }
      if (editing) {
        await superApi.patch(`/finance/${editing.txn_id}`, payload)
      } else {
        await superApi.post('/finance', payload)
      }
      setModalOpen(false)
      load()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi lưu')
    } finally { setSaving(false) }
  }

  const handleDelete = async (t: Txn) => {
    if (!confirm(`Xoá giao dịch #${t.txn_id} (${fmt(t.amount)})? Không thể phục hồi.`)) return
    try {
      await superApi.delete(`/finance/${t.txn_id}`)
      load()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi xoá')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ color: S.text, fontSize: 20, fontWeight: 800, margin: 0 }}>🏦 Tài chính hệ thống</h1>
          <p style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>
            Tiền của platform (không phải ví shop) — full CRUD, không ràng buộc business rule
          </p>
        </div>
        <button onClick={openCreate} style={{ padding: '9px 18px', background: S.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Thêm giao dịch
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 16px', gridColumn: 'span 1' }}>
          <p style={{ color: S.muted, fontSize: 11, margin: '0 0 6px', fontWeight: 600 }}>TỔNG SỐ DƯ HỆ THỐNG</p>
          <p style={{ color: balance >= 0 ? S.green : S.red, fontSize: 22, fontWeight: 800, margin: 0 }}>{fmt(balance)}</p>
        </div>
        {TYPES.map(t => (
          <div key={t} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ color: S.muted, fontSize: 11, margin: '0 0 6px', fontWeight: 600 }}>{TYPE_LABEL[t].toUpperCase()}</p>
            <p style={{ color: S.text, fontSize: 16, fontWeight: 800, margin: 0 }}>{fmt(byType[t] || 0)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {['all', ...TYPES].map(t => (
          <button key={t} onClick={() => { setTypeFilter(t); setPage(1) }}
            style={{
              padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: typeFilter === t ? S.red : S.card,
              color: typeFilter === t ? '#fff' : S.muted,
            }}>
            {t === 'all' ? 'Tất cả' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading
        ? <div style={{ color: S.muted, textAlign: 'center', padding: 40 }}>Đang tải...</div>
        : (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0a0a0f' }}>
                  {['ID', 'Loại', 'Số tiền', 'Shop', 'Đơn hàng', 'Trạng thái', 'Ghi chú', 'Thời gian', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: S.muted, fontSize: 11, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(t => (
                  <tr key={t.txn_id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '10px 14px', color: S.muted }}>#{t.txn_id}</td>
                    <td style={{ padding: '10px 14px', color: S.text }}>{TYPE_LABEL[t.type] || t.type}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: t.amount >= 0 ? S.green : '#ef4444' }}>{fmt(t.amount)}</td>
                    <td style={{ padding: '10px 14px', color: S.muted }}>{t.shop_name || (t.shop_id ? `#${t.shop_id}` : '—')}</td>
                    <td style={{ padding: '10px 14px', color: S.muted }}>{t.order_id ? `#${t.order_id}` : '—'}</td>
                    <td style={{ padding: '10px 14px' }}><span style={{ color: STATUS_COLOR[t.status] || S.muted }}>{t.status}</span></td>
                    <td style={{ padding: '10px 14px', color: S.muted, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note || '—'}</td>
                    <td style={{ padding: '10px 14px', color: S.muted, fontSize: 11 }}>{t.created_at ? t.created_at.slice(0, 16).replace('T', ' ') : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(t)} style={{ padding: '5px 9px', background: '#1e1e2e', color: '#94a3b8', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => handleDelete(t)} style={{ padding: '5px 9px', background: '#2d1010', color: '#ef4444', border: `1px solid ${S.redDark}`, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 30, textAlign: 'center', color: S.muted }}>Không có giao dịch nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      }

      {/* Pagination */}
      {total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>← Trước</button>
          <span style={{ padding: '7px 14px', color: S.muted, fontSize: 13 }}>Trang {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={items.length < 20}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>Tiếp →</button>
        </div>
      )}

      {/* Create/Edit modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !saving && setModalOpen(false)}>
          <div style={{ width: 420, background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: S.text, fontSize: 15, fontWeight: 800, margin: 0 }}>
                {editing ? `✏️ Sửa giao dịch #${editing.txn_id}` : '+ Thêm giao dịch'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>LOẠI</label>
              <select value={form.type} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>SỐ TIỀN (dương=vào, âm=ra)</label>
              <input type="number" value={form.amount} onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>SHOP ID</label>
                <input type="number" value={form.shop_id} onChange={e => setForm((f: any) => ({ ...f, shop_id: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>TÊN SHOP</label>
                <input value={form.shop_name} onChange={e => setForm((f: any) => ({ ...f, shop_name: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>ORDER ID</label>
              <input type="number" value={form.order_id} onChange={e => setForm((f: any) => ({ ...f, order_id: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>TRẠNG THÁI</label>
              <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>GHI CHÚ</label>
              <textarea value={form.note} onChange={e => setForm((f: any) => ({ ...f, note: e.target.value }))} rows={2}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button onClick={() => setModalOpen(false)} disabled={saving} style={{ padding: '9px 18px', background: 'none', border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, fontSize: 13, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleSave} disabled={saving || !form.amount} style={{ padding: '9px 20px', background: saving ? S.redDark : S.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Đang lưu...' : '💾 Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperFinance
