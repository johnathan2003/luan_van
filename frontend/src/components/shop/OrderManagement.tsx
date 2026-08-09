import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { shopService } from '../../services/shopService'
import { orderService } from '../../services/orderService'
import { formatCurrency, formatDate, formatOrderId } from '../../utils/formatters'
import StatusBadge from '../order/StatusBadge'
import Loading from '../common/Loading'
import { useAppSelector } from '../../store/hooks'
import DisputeFormModal from '../dispute/DisputeFormModal'
import { getDisputesByOrder } from '../../utils/disputeStore'

interface Dimensions { length: string; width: string; height: string; weight: string }

const STATUS_LABEL: Record<string, string> = {
  pending: '📋 Chờ xác nhận', confirmed: '📦 Đang đóng hàng', ready_to_ship: '🚚 Chờ shipper',
  shipped: '🛵 Đang giao', delivered: '✅ Đã giao', completed: '🎉 Hoàn thành', cancelled: '❌ Đã hủy',
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: '💵 Thanh toán khi nhận hàng (COD)',
  momo: '🟣 Ví MoMo',
  vnpay: '🔵 VNPay',
  zalopay: '🔷 ZaloPay',
  credit_card: '💳 Thẻ tín dụng',
}

const C = { navy: '#0F172A', gray: '#64748B', orange: '#EA580C', success: '#16A34A', error: '#DC2626', border: '#E2E8F0' }

/* ── Slip modal ──────────────────────────────────────────────────────────────── */
const DeliverySlipModal: React.FC<{ slip: any; onClose: () => void }> = ({ slip, onClose }) => {
  const handlePrint = () => window.print()

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, width: 520, maxWidth: '96vw',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        {/* Actions */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>🖨️ Phiếu giao hàng</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePrint}
              style={{ padding: '7px 16px', background: C.orange, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              In phiếu
            </button>
            <button onClick={onClose}
              style={{ padding: '7px 14px', background: '#F1F5F9', color: C.gray, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Đóng
            </button>
          </div>
        </div>

        {/* Slip body — class "printable" so CSS can isolate it */}
        <div className="printable-slip" style={{ padding: 24, fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: 1 }}>BUYZO EXPRESS</div>
            <div style={{ fontSize: 11, color: C.gray }}>Dịch vụ giao hàng nhanh</div>
          </div>

          <div style={{ border: `2px solid ${C.navy}`, borderRadius: 8, overflow: 'hidden' }}>
            {/* Mã đơn + QR placeholder */}
            <div style={{ padding: '10px 14px', background: C.navy, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>MÃ VẬN ĐƠN</div>
                <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 1 }}>{slip.delivery_code || '—'}</div>
              </div>
              {/* QR text placeholder */}
              <div style={{ background: '#fff', padding: 6, borderRadius: 4, fontSize: 9, color: C.navy, fontWeight: 700, textAlign: 'center', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', wordBreak: 'break-all' }}>
                {slip.delivery_code}
              </div>
            </div>

            {/* Người gửi */}
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginBottom: 4 }}>NGƯỜI GỬI</div>
              <div style={{ fontWeight: 700 }}>Shop: {slip.shop_name}</div>
              {slip.pickup_address && <div style={{ fontSize: 12, color: C.gray }}>📍 {slip.pickup_address}</div>}
            </div>

            {/* Người nhận */}
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, background: '#FFFBEB' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginBottom: 4 }}>NGƯỜI NHẬN</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{slip.recipient_name || '—'}</div>
              <div style={{ fontSize: 12, color: C.gray }}>📞 {slip.recipient_phone || '—'}</div>
              <div style={{ fontSize: 12, color: C.gray }}>📍 {slip.delivery_address || '—'}</div>
            </div>

            {/* Hàng hóa */}
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginBottom: 6 }}>HÀNG HÓA</div>
              {(slip.items || []).map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{item.name}</span>
                  <span style={{ fontWeight: 700 }}>× {item.quantity}</span>
                </div>
              ))}
            </div>

            {/* COD */}
            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: slip.is_cod ? '#FFF7ED' : '#F0FDF4' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: slip.is_cod ? C.orange : C.success }}>
                {slip.is_cod ? '💵 THU TIỀN KHI GIAO (COD)' : '✅ ĐÃ THANH TOÁN ONLINE'}
              </div>
              <div style={{ fontWeight: 900, fontSize: 20, color: slip.is_cod ? C.error : C.success }}>
                {slip.is_cod ? `${slip.cod_amount?.toLocaleString('vi-VN')}₫` : '0₫'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 10, color: C.gray, textAlign: 'center' }}>
            Khách hàng vui lòng kiểm tra hàng trước khi nhận · Hotline: 1900 xxxx
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main Component ──────────────────────────────────────────────────────────── */
const OrderManagement: React.FC = () => {
  const { user } = useAppSelector(s => s.auth)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [complainOrder, setComplainOrder] = useState<any | null>(null)
  const [detailOrder, setDetailOrder] = useState<any | null>(null)
  const [dims, setDims] = useState<Record<number, Dimensions>>({})
  const [slipData, setSlipData] = useState<any | null>(null)
  const [packingId, setPackingId] = useState<number | null>(null)

  const DEFAULT_DIMS: Dimensions = { length: '30', width: '20', height: '15', weight: '1.5' }

  const openDetail = (o: any) => {
    setDetailOrder(o)
    setDims(prev => prev[o.order_id] ? prev : { ...prev, [o.order_id]: { ...DEFAULT_DIMS } })
  }

  const load = async () => {
    setLoading(true)
    try {
      const params = filter ? { order_status: filter } : {}
      const res = await shopService.getOrders(params)
      setOrders(res.data.orders)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter])

  const handleConfirm = async (id: number) => {
    try { await orderService.confirm(id); toast.success('Đã xác nhận đơn hàng'); load() }
    catch { toast.error('Lỗi xác nhận') }
  }

  const handleConfirmPacking = async (id: number) => {
    setPackingId(id)
    try {
      await orderService.confirmPacking(id)
      toast.success('Đã xác nhận đóng gói — đang tải phiếu...')
      const slipRes = await orderService.getDeliverySlip(id)
      setSlipData(slipRes.data)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Lỗi xác nhận đóng gói')
    } finally {
      setPackingId(null)
    }
  }

  const handleShowSlip = async (id: number) => {
    try {
      const slipRes = await orderService.getDeliverySlip(id)
      setSlipData(slipRes.data)
    } catch { toast.error('Không tải được phiếu giao') }
  }

  if (loading) return <Loading />

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { v: '',              l: 'Tất cả' },
          { v: 'pending',       l: '📋 Chờ xác nhận' },
          { v: 'confirmed',     l: '📦 Đang đóng hàng' },
          { v: 'ready_to_ship', l: '🚚 Chờ shipper' },
          { v: 'shipped',       l: '🛵 Đang giao' },
          { v: 'delivered',     l: '✅ Đã giao' },
          { v: 'completed',     l: '🎉 Hoàn thành' },
          { v: 'cancelled',     l: '❌ Đã hủy' },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`btn btn-sm ${filter === v ? 'btn-primary' : 'btn-outline'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="card table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Mã đơn</th><th>Sản phẩm</th><th>Tổng tiền</th>
              <th>Thanh toán</th><th>Trạng thái</th><th>Mã VĐ</th>
              <th>Khiếu nại</th><th>Ngày đặt</th><th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const orderDisputes = getDisputesByOrder(o.order_id)
              const sentByShop     = orderDisputes.find(d => d.complainant_type === 'shop' && d.complainant_id === user?.user_id)
              const receivedByShop = orderDisputes.find(d => d.target_type === 'shop' && d.target_id === user?.user_id)
              return (
                <tr key={o.order_id}>
                  <td style={{ fontWeight: 600 }}>{formatOrderId(o.order_id)}</td>
                  <td style={{ fontSize: 13 }}>{o.items?.map((i: any) => `${i.product_name} x${i.quantity}`).join(', ')}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(o.final_price)}</td>
                  <td><span style={{ fontSize: 12 }}>{o.payment_method?.toUpperCase()} · {o.payment_status === 'paid' ? '✅ Đã TT' : '⏳ Chờ TT'}</span></td>
                  <td><StatusBadge status={o.order_status} /></td>

                  {/* Mã vận đơn */}
                  <td style={{ fontSize: 12 }}>
                    {o.delivery_code
                      ? <span style={{ fontWeight: 700, color: C.orange }}>{o.delivery_code}</span>
                      : <span style={{ color: C.gray }}>—</span>
                    }
                  </td>

                  {/* Khiếu nại */}
                  <td>
                    {receivedByShop && (
                      <span title={`Bị khách/shipper khiếu nại — ${receivedByShop.reason_label}`}
                        style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#dc2626', marginBottom: 2 }}>
                        🚩 Bị khiếu nại
                      </span>
                    )}
                    {sentByShop && (
                      <span title={`Shop đã gửi khiếu nại — ${sentByShop.reason_label}`}
                        style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#d97706' }}>
                        📤 Đã khiếu nại
                      </span>
                    )}
                    {!receivedByShop && !sentByShop && <span style={{ fontSize: 12, color: 'var(--gray-300)' }}>—</span>}
                  </td>

                  <td style={{ fontSize: 13 }}>{formatDate(o.created_at)}</td>

                  {/* Thao tác */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {o.order_status === 'pending' && (
                        <button onClick={() => handleConfirm(o.order_id)} className="btn btn-primary btn-sm">
                          ✅ Xác nhận
                        </button>
                      )}
                      {o.order_status === 'confirmed' && (
                        <button
                          onClick={() => handleConfirmPacking(o.order_id)}
                          disabled={packingId === o.order_id}
                          className="btn btn-sm"
                          style={{ background: C.orange, color: '#fff', border: 'none', opacity: packingId === o.order_id ? 0.6 : 1 }}>
                          {packingId === o.order_id ? '...' : '📦 Xác nhận đóng gói'}
                        </button>
                      )}
                      {/* Nút in phiếu cho đơn đã có mã SD */}
                      {o.delivery_code && (
                        <button onClick={() => handleShowSlip(o.order_id)}
                          className="btn btn-sm"
                          style={{ background: '#FFF7ED', color: C.orange, border: `1px solid #FED7AA`, fontWeight: 700 }}>
                          🖨️ In phiếu
                        </button>
                      )}
                      <button onClick={() => openDetail(o)} className="btn btn-sm"
                        style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                        🔍 Chi tiết
                      </button>
                      {!['pending', 'cancelled'].includes(o.order_status) && (
                        <button onClick={() => setComplainOrder(o)} className="btn btn-sm"
                          style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                          ⚠️ Khiếu nại
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {orders.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Không có đơn hàng</p>}
      </div>

      {/* Delivery Slip Modal */}
      {slipData && <DeliverySlipModal slip={slipData} onClose={() => setSlipData(null)} />}

      {/* Modal chi tiết sản phẩm */}
      {detailOrder && (() => {
        const o = detailOrder
        const d = dims[o.order_id] || { ...DEFAULT_DIMS }
        const calcVol = (d: Dimensions) => {
          const l = parseFloat(d.length), w = parseFloat(d.width), h = parseFloat(d.height)
          return l && w && h ? (l * w * h / 1000).toFixed(1) : null
        }
        const calcVolW = (d: Dimensions) => {
          const l = parseFloat(d.length), w = parseFloat(d.width), h = parseFloat(d.height)
          return l && w && h ? (l * w * h / 5000).toFixed(2) : null
        }
        const vol    = calcVol(d)
        const volW   = calcVolW(d)
        const actualW = parseFloat(d.weight)
        const chargeW = volW ? Math.max(actualW || 0, parseFloat(volW)).toFixed(2) : actualW?.toFixed(2)
        const maskPhone = (p: string) => p ? p.slice(0, 3) + ' *** ' + p.slice(-2) : '—'
        const maskAddr  = (a: string) => {
          if (!a) return '—'
          const parts = a.split(',')
          return parts.length <= 2 ? a.slice(0, 6) + '***' + (parts[parts.length - 1] ? ', ' + parts[parts.length - 1].trim() : '')
            : '***' + ', ' + parts.slice(-2).map((s: string) => s.trim()).join(', ')
        }

        return (
          <div onClick={() => setDetailOrder(null)} style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#fff', borderRadius: 16, width: 560, maxWidth: '95vw', maxHeight: '90vh',
              boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA', flexShrink: 0 }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 16, margin: 0, color: C.navy }}>Chi tiết sản phẩm</p>
                  <p style={{ fontSize: 12, color: C.gray, margin: '2px 0 0' }}>{formatOrderId(o.order_id)} · {STATUS_LABEL[o.order_status] ?? o.order_status}</p>
                </div>
                <button onClick={() => setDetailOrder(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
                {/* Thông tin người mua */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.gray, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Thông tin người mua</p>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>👤</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{o.user_name || `Khách #${o.user_id}`}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>📞</span>
                      <span style={{ fontSize: 13, color: '#475569' }}>{maskPhone(o.phone || '0912345678')}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 4 }}>🔒 Đã ẩn</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ flexShrink: 0 }}>📍</span>
                      <span style={{ fontSize: 13, color: '#475569' }}>{maskAddr(o.delivery_address || o.shipping_address || '')}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 4, flexShrink: 0 }}>🔒 Đã ẩn</span>
                    </div>
                  </div>
                </div>

                {/* Thanh toán */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.gray, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Thanh toán</p>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#475569' }}>Phương thức</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                        {PAYMENT_METHOD_LABEL[o.payment_method as string] || o.payment_method?.toUpperCase() || '—'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#475569' }}>Trạng thái</span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                        background: o.payment_status === 'paid' ? '#dcfce7' : o.payment_status === 'failed' ? '#fee2e2' : '#fef3c7',
                        color:      o.payment_status === 'paid' ? '#16a34a' : o.payment_status === 'failed' ? '#dc2626' : '#d97706',
                      }}>
                        {o.payment_status === 'paid' ? '✅ Đã thanh toán'
                          : o.payment_status === 'failed' ? '❌ Thất bại'
                          : o.payment_method === 'cod' ? '💵 Thu hộ khi giao (COD)'
                          : '⏳ Chờ thanh toán'}
                      </span>
                    </div>
                    {o.payment_trans_id && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#475569' }}>Mã giao dịch</span>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#64748B' }}>{o.payment_trans_id}</span>
                      </div>
                    )}
                    {o.payment_confirmed_at && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#475569' }}>Xác nhận lúc</span>
                        <span style={{ fontSize: 12, color: '#64748B' }}>{formatDate(o.payment_confirmed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sản phẩm */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.gray, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sản phẩm trong đơn</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(o.items || []).map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>{item.product_name}</p>
                          {item.variant_name && <p style={{ fontSize: 11, color: C.gray, margin: '2px 0 0' }}>Phân loại: {item.variant_name}</p>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', margin: 0 }}>{formatCurrency(item.price * item.quantity)}</p>
                          <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>x{item.quantity} · {formatCurrency(item.price)}/cái</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E2E8F0' }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary)', margin: 0 }}>Tổng: {formatCurrency(o.final_price)}</p>
                  </div>
                </div>

                {/* Kích thước */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.gray, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Kích thước & Cân nặng</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                    {([
                      { key: 'length', label: 'Dài', unit: 'cm' },
                      { key: 'width',  label: 'Rộng', unit: 'cm' },
                      { key: 'height', label: 'Cao',  unit: 'cm' },
                      { key: 'weight', label: 'Cân nặng', unit: 'kg' },
                    ] as { key: keyof Dimensions; label: string; unit: string }[]).map(f => (
                      <div key={f.key}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>{f.label} ({f.unit})</label>
                        <div style={{ padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontWeight: 700, color: C.navy }}>
                          {d[f.key] || '—'} <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8' }}>{f.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(vol || chargeW) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
                      {vol && <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                        <p style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600, margin: 0 }}>Thể tích</p>
                        <p style={{ fontSize: 18, fontWeight: 800, color: '#1D4ED8', margin: '4px 0 0' }}>{vol}</p>
                        <p style={{ fontSize: 10, color: '#93C5FD', margin: 0 }}>dm³</p>
                      </div>}
                      {volW && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                        <p style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, margin: 0 }}>Cân thể tích</p>
                        <p style={{ fontSize: 18, fontWeight: 800, color: '#15803D', margin: '4px 0 0' }}>{volW}</p>
                        <p style={{ fontSize: 10, color: '#86EFAC', margin: 0 }}>kg</p>
                      </div>}
                      {chargeW && <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                        <p style={{ fontSize: 11, color: C.orange, fontWeight: 600, margin: 0 }}>Cân tính phí</p>
                        <p style={{ fontSize: 18, fontWeight: 800, color: '#C2410C', margin: '4px 0 0' }}>{chargeW}</p>
                        <p style={{ fontSize: 10, color: '#FDBA74', margin: 0 }}>kg</p>
                      </div>}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: '14px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setDetailOrder(null)} className="btn btn-outline btn-sm">Đóng</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Dispute modal */}
      {complainOrder && user && (
        <DisputeFormModal
          open={!!complainOrder}
          onClose={() => setComplainOrder(null)}
          orderId={complainOrder.order_id}
          complainantType="shop"
          complainantId={user.user_id}
          complainantName={user.full_name || user.email}
          targetOptions={[
            { type: 'user', id: complainOrder.user_id, name: `Khách #${complainOrder.user_id}` },
            ...(complainOrder.shipper_id ? [{ type: 'shipper' as const, id: complainOrder.shipper_id, name: `Shipper #${complainOrder.shipper_id}` }] : []),
          ]}
        />
      )}
    </div>
  )
}

export default OrderManagement
