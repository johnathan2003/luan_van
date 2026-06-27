/**
 * super/frontend/pages/SuperOrders.tsx
 * --------------------------------------
 * Superadmin — xem, sửa, xóa cứng đơn hàng và chi tiết đơn hàng.
 */
import React, { useEffect, useState } from 'react'
import superApi from '../superApi'

const S = {
  card:    '#13131a',
  border:  '#1e1e2e',
  red:     '#dc2626',
  redDark: '#7f1d1d',
  text:    '#f1f5f9',
  muted:   '#475569',
  input:   '#1e1e2e',
}

const STATUS_COLOR: Record<string, string> = {
  pending:      '#d97706',
  confirmed:    '#3b82f6',
  paid:         '#3b82f6',
  ready_to_ship:'#8b5cf6',
  shipped:      '#06b6d4',
  delivered:    '#16a34a',
  completed:    '#16a34a',
  cancelled:    '#dc2626',
  returned:     '#64748b',
}

const PAY_COLOR: Record<string, string> = {
  paid: '#16a34a', unpaid: '#d97706', failed: '#dc2626', refunded: '#8b5cf6',
}

interface OrderData {
  order_id:        number
  order_number:    string
  user_id:         number
  shop_id:         number
  total_price:     string
  final_price:     string
  order_status:    string
  payment_status:  string
  payment_method:  string
  shipping_address: string
  recipient_name:  string
  recipient_phone: string
  notes:           string | null
  voucher_code:    string | null
  created_at:      string
  items?: OrderItemData[]
}

interface OrderItemData {
  order_item_id: number
  product_id:    number
  product_name:  string
  quantity:      number
  price_at_order: string
}

const ORDER_STATUSES = ['all','pending','confirmed','paid','ready_to_ship','shipped','delivered','completed','cancelled','returned']

const SuperOrders: React.FC = () => {
  const [orders, setOrders]   = useState<OrderData[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus]   = useState('all')
  const [page, setPage]       = useState(1)

  // Detail modal
  const [detail, setDetail]   = useState<OrderData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Edit modal
  const [editOrder, setEditOrder]   = useState<OrderData | null>(null)
  const [editForm, setEditForm]     = useState<{ order_status?: string; payment_status?: string; notes?: string }>({})
  const [editItem, setEditItem]     = useState<{ order_id: number; item: OrderItemData } | null>(null)
  const [editItemForm, setEditItemForm] = useState<{ quantity?: number; price_at_order?: number }>({})

  const load = (s = status, p = page) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (s !== 'all') params.set('order_status', s)
    superApi.get(`/orders?${params}`)
      .then(r => { setOrders(r.data.orders || []); setTotal(r.data.total || 0) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status, page])

  const openDetail = async (o: OrderData) => {
    setDetailLoading(true)
    setDetail(o)
    try {
      const r = await superApi.get(`/orders/${o.order_id}`)
      setDetail(r.data)
    } finally { setDetailLoading(false) }
  }

  const handleSaveOrder = async () => {
    if (!editOrder) return
    try {
      await superApi.patch(`/orders/${editOrder.order_id}`, editForm)
      setOrders(os => os.map(o => o.order_id === editOrder.order_id ? { ...o, ...editForm } : o))
      if (detail?.order_id === editOrder.order_id) setDetail(d => d ? { ...d, ...editForm } : d)
      setEditOrder(null)
    } catch (err: any) { alert(err.response?.data?.detail || 'Lỗi cập nhật') }
  }

  const handleSaveItem = async () => {
    if (!editItem) return
    try {
      await superApi.patch(`/orders/${editItem.order_id}/items/${editItem.item.order_item_id}`, editItemForm)
      if (detail) {
        setDetail(d => d ? {
          ...d,
          items: d.items?.map(i => i.order_item_id === editItem.item.order_item_id ? { ...i, ...editItemForm } : i)
        } : d)
      }
      setEditItem(null)
    } catch (err: any) { alert(err.response?.data?.detail || 'Lỗi') }
  }

  const handleHardDelete = async (o: OrderData) => {
    if (!confirm(`XÓA CỨNG đơn hàng ${o.order_number}?\nKHÔNG THỂ PHỤC HỒI.`)) return
    try {
      await superApi.delete(`/orders/${o.order_id}/hard`)
      setOrders(os => os.filter(x => x.order_id !== o.order_id))
      setTotal(t => t - 1)
      if (detail?.order_id === o.order_id) setDetail(null)
    } catch (err: any) { alert(err.response?.data?.detail || 'Lỗi') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ color: S.text, fontSize: 20, fontWeight: 800, margin: 0 }}>🧾 Đơn hàng</h1>
        <p style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>Tổng: {total} — can thiệp trực tiếp DB</p>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ORDER_STATUSES.map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            style={{
              padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: status === s ? (STATUS_COLOR[s] || S.red) : S.card,
              color: status === s ? '#fff' : S.muted,
            }}>
            {s === 'all' ? 'Tất cả' : s}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading
        ? <div style={{ color: S.muted, textAlign: 'center', padding: 40 }}>Đang tải...</div>
        : (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                  {['#', 'Mã đơn', 'User', 'Shop', 'Tổng tiền', 'Đơn hàng', 'Thanh toán', 'Ngày', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: S.muted, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.order_id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '10px 14px', color: S.muted, fontSize: 11 }}>{o.order_id}</td>
                    <td style={{ padding: '10px 14px', color: S.text, fontSize: 12, fontWeight: 600 }}>
                      <button onClick={() => openDetail(o)} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>
                        {o.order_number}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px', color: S.muted, fontSize: 12 }}>#{o.user_id}</td>
                    <td style={{ padding: '10px 14px', color: S.muted, fontSize: 12 }}>#{o.shop_id}</td>
                    <td style={{ padding: '10px 14px', color: '#16a34a', fontSize: 12, fontWeight: 700 }}>
                      {Number(o.final_price || 0).toLocaleString('vi-VN')}₫
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 700, background: (STATUS_COLOR[o.order_status] || S.muted) + '22', color: STATUS_COLOR[o.order_status] || S.muted }}>
                        {o.order_status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 700, background: (PAY_COLOR[o.payment_status] || S.muted) + '22', color: PAY_COLOR[o.payment_status] || S.muted }}>
                        {o.payment_status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: S.muted, fontSize: 11 }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => { setEditOrder(o); setEditForm({ order_status: o.order_status, payment_status: o.payment_status, notes: o.notes || '' }) }}
                          style={{ padding: '4px 9px', background: S.input, border: `1px solid ${S.border}`, borderRadius: 6, color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => handleHardDelete(o)}
                          style={{ padding: '4px 9px', background: '#2d1010', border: `1px solid ${S.redDark}`, borderRadius: 6, color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: S.muted }}>Không có đơn hàng</div>}
          </div>
        )
      }

      {/* Pagination */}
      {total > 30 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>← Trước</button>
          <span style={{ padding: '7px 14px', color: S.muted, fontSize: 13 }}>Trang {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={orders.length < 30}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>Tiếp →</button>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}
          onClick={() => setDetail(null)}>
          <div style={{ width: '100%', maxWidth: 640, background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: S.text, fontSize: 15, fontWeight: 800, margin: 0 }}>🧾 {detail.order_number}</h2>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['User ID', `#${detail.user_id}`],
                ['Shop ID', `#${detail.shop_id}`],
                ['Người nhận', detail.recipient_name],
                ['Điện thoại', detail.recipient_phone],
                ['Tổng tiền', `${Number(detail.total_price).toLocaleString('vi-VN')}₫`],
                ['Thanh toán', `${Number(detail.final_price).toLocaleString('vi-VN')}₫ (${detail.payment_method})`],
                ['Trạng thái ĐH', detail.order_status],
                ['Trạng thái TT', detail.payment_status],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: S.muted, fontWeight: 700, marginBottom: 2, letterSpacing: '0.05em' }}>{k}</div>
                  <div style={{ fontSize: 13, color: S.text }}>{v}</div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 10, color: S.muted, fontWeight: 700, marginBottom: 4 }}>ĐỊA CHỈ GIAO</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{detail.shipping_address}</div>
            </div>

            {/* Items */}
            <div>
              <div style={{ fontSize: 11, color: S.muted, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>CHI TIẾT SẢN PHẨM</div>
              {detailLoading
                ? <div style={{ color: S.muted, fontSize: 12 }}>Đang tải...</div>
                : detail.items?.map(item => (
                  <div key={item.order_item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${S.border}` }}>
                    <div>
                      <div style={{ fontSize: 13, color: S.text, fontWeight: 500 }}>{item.product_name}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>ID:{item.product_id} · ×{item.quantity} · {Number(item.price_at_order).toLocaleString('vi-VN')}₫</div>
                    </div>
                    <button onClick={() => { setEditItem({ order_id: detail.order_id, item }); setEditItemForm({ quantity: item.quantity, price_at_order: Number(item.price_at_order) }) }}
                      style={{ padding: '4px 9px', background: S.input, border: `1px solid ${S.border}`, borderRadius: 6, color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>✏️</button>
                  </div>
                ))
              }
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setEditOrder(detail); setEditForm({ order_status: detail.order_status, payment_status: detail.payment_status, notes: detail.notes || '' }); setDetail(null) }}
                style={{ padding: '9px 18px', background: '#1e1e2e', border: `1px solid ${S.border}`, borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                ✏️ Sửa đơn hàng
              </button>
              <button onClick={() => { handleHardDelete(detail) }}
                style={{ padding: '9px 18px', background: '#2d1010', border: `1px solid ${S.redDark}`, borderRadius: 8, color: '#ef4444', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                🗑 Xóa cứng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Order Modal ── */}
      {editOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setEditOrder(null)}>
          <div style={{ width: 400, background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color: S.text, fontSize: 15, fontWeight: 800, margin: 0 }}>✏️ Sửa đơn #{editOrder.order_id}</h2>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>TRẠNG THÁI ĐỢN HÀNG</label>
              <select value={editForm.order_status ?? ''} onChange={e => setEditForm(f => ({ ...f, order_status: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }}>
                {['pending','confirmed','paid','ready_to_ship','shipped','delivered','completed','cancelled','returned'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>TRẠNG THÁI THANH TOÁN</label>
              <select value={editForm.payment_status ?? ''} onChange={e => setEditForm(f => ({ ...f, payment_status: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }}>
                {['unpaid','paid','failed','refunded'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>GHI CHÚ</label>
              <textarea value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setEditOrder(null)} style={{ padding: '9px 18px', background: 'none', border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, fontSize: 13, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleSaveOrder} style={{ padding: '9px 20px', background: S.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>💾 Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Item Modal ── */}
      {editItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setEditItem(null)}>
          <div style={{ width: 380, background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color: S.text, fontSize: 15, fontWeight: 800, margin: 0 }}>✏️ Sửa dòng SP</h2>
            <p style={{ color: S.muted, fontSize: 12, margin: 0 }}>{editItem.item.product_name}</p>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>SỐ LƯỢNG</label>
              <input type="number" value={editItemForm.quantity ?? 1} onChange={e => setEditItemForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>GIÁ LÚC ĐẶT (VND)</label>
              <input type="number" value={editItemForm.price_at_order ?? 0} onChange={e => setEditItemForm(f => ({ ...f, price_at_order: Number(e.target.value) }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setEditItem(null)} style={{ padding: '9px 18px', background: 'none', border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, fontSize: 13, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleSaveItem} style={{ padding: '9px 20px', background: S.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>💾 Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperOrders
