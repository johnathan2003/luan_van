/**
 * EmployeeOrdersPage — trang xử lý đơn hàng dành cho nhân viên kho/đóng gói.
 *
 * Luồng đơn hàng shop-side (2 bước):
 *   pending → confirmed   (xác nhận nhận đơn)
 *   confirmed → ready_to_ship  (đóng hàng xong → hệ thống TỰ ĐỘNG gán shipper)
 *
 * Bước 3 (ready_to_ship → shipped) do SHIPPER tự xác nhận khi lấy hàng.
 */
import React, { useCallback, useEffect, useState } from 'react'
import EmployeeLayout from './EmployeeLayout'
import API from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Order {
  order_id: number
  user_id:  number
  order_status: string
  payment_status: string
  total_amount: number
  created_at: string
  shipper_id?: number
}

interface Summary { pending: number; confirmed: number; ready_to_ship: number }

// ─── Constants ────────────────────────────────────────────────────────────────
// Chỉ còn 2 bước nhân viên thao tác
const STATUS_NEXT: Record<string, { label: string; nextStatus: string; color: string; bg: string }> = {
  pending:   { label: '✅ Xác nhận nhận đơn', nextStatus: 'confirmed',     color: '#065F46', bg: '#D1FAE5' },
  confirmed: { label: '📦 Đóng hàng xong',   nextStatus: 'ready_to_ship', color: '#1D4ED8', bg: '#DBEAFE' },
  // ready_to_ship: không còn nút — hiển thị thông tin chờ shipper
}

const STATUS_VI: Record<string, string> = {
  pending:       'Chờ xác nhận',
  confirmed:     'Đang đóng hàng',
  ready_to_ship: 'Chờ shipper lấy',
  shipped:       'Shipper đang giao',
  delivered:     'Đã giao',
  cancelled:     'Đã hủy',
}

const STATUS_COLOR: Record<string, string> = {
  pending:       '#D97706',
  confirmed:     '#1D4ED8',
  ready_to_ship: '#7C3AED',
  shipped:       '#059669',
}

const TABS = [
  { key: 'pending',       label: 'Cần xác nhận',  icon: '📋' },
  { key: 'confirmed',     label: 'Đang đóng hàng', icon: '📦' },
  { key: 'ready_to_ship', label: 'Chờ shipper',    icon: '🚚' },
  { key: 'shipped',       label: 'Đã gửi',          icon: '✅' },
]

// ─── Component ────────────────────────────────────────────────────────────────
const EmployeeOrdersPage: React.FC = () => {
  const [tab, setTab]           = useState<string>('pending')
  const [orders, setOrders]     = useState<Order[]>([])
  const [summary, setSummary]   = useState<Summary>({ pending: 0, confirmed: 0, ready_to_ship: 0 })
  const [shopName, setShopName] = useState('')
  const [loading, setLoading]   = useState(true)
  const [acting, setActing]     = useState<number | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [detail, setDetail]     = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const openDetail = async (orderId: number) => {
    setDetailLoading(true)
    setDetail(null)
    try {
      const r = await API.get(`/api/v1/employee/orders/${orderId}/detail`)
      setDetail(r.data)
    } catch { setDetail({ error: true }) }
    finally { setDetailLoading(false) }
  }

  const loadSummary = useCallback(async () => {
    const r = await API.get('/api/v1/employee/orders/summary')
    setSummary(r.data)
  }, [])

  const loadOrders = useCallback(async (s: string) => {
    setLoading(true)
    try {
      const r = await API.get(`/api/v1/employee/orders?order_status=${s}&limit=50`)
      setOrders(r.data?.orders ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    API.get('/api/v1/employee/me').then(r => setShopName(r.data?.shop_name ?? ''))
    loadSummary()
  }, [])

  useEffect(() => { loadOrders(tab) }, [tab])

  const handleAction = async (orderId: number, nextStatus: string) => {
    if (!confirm(`Xác nhận chuyển đơn #${orderId}?`)) return
    setActing(orderId)
    try {
      const res = await API.patch(`/api/v1/employee/orders/${orderId}/status`, { order_status: nextStatus })
      const data = res.data

      // Tạo toast phù hợp
      if (nextStatus === 'ready_to_ship') {
        if (data.shipper_assigned) {
          showToast(`✅ Đã đóng hàng! Shipper #${data.shipper_id} được gán — đang tới lấy`, true)
        } else {
          showToast('✅ Đã đóng hàng! Hiện chưa có shipper nào sẵn sàng — admin sẽ gán thủ công', false)
        }
      } else {
        showToast('✅ Đã cập nhật đơn hàng', true)
      }

      setOrders(prev => prev.filter(o => o.order_id !== orderId))
      loadSummary()
    } catch (err: any) {
      showToast('❌ ' + (err.response?.data?.detail || 'Lỗi'), false)
    } finally {
      setActing(null)
    }
  }

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <EmployeeLayout shopName={shopName}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>Xử lý đơn hàng</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>{shopName}</p>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { key: 'pending',       icon: '📋', label: 'Cần xác nhận',  color: '#D97706', bg: '#FFFBEB', count: summary.pending       },
            { key: 'confirmed',     icon: '📦', label: 'Đang đóng hàng', color: '#1D4ED8', bg: '#EFF6FF', count: summary.confirmed     },
            { key: 'ready_to_ship', icon: '🚚', label: 'Chờ shipper',   color: '#7C3AED', bg: '#F5F3FF', count: summary.ready_to_ship },
          ].map(c => (
            <button key={c.key} onClick={() => setTab(c.key)}
              style={{
                textAlign: 'left', cursor: 'pointer',
                background: tab === c.key ? c.bg : '#fff',
                border: `2px solid ${tab === c.key ? c.color : '#E2E8F0'}`,
                borderRadius: 12, padding: '14px 18px', transition: 'all 0.15s',
              }}>
              <div style={{ fontSize: 22 }}>{c.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1.2, marginTop: 4 }}>{c.count}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{c.label}</div>
            </button>
          ))}
        </div>

        {/* Thông tin luồng */}
        <div style={{ padding: '12px 16px', background: '#EFF6FF', borderRadius: 10, fontSize: 12, color: '#1D4ED8', lineHeight: 1.6 }}>
          <strong>Luồng đơn hàng:</strong> &nbsp;
          📋 Xác nhận nhận đơn &nbsp;→&nbsp; 📦 Đóng hàng xong &nbsp;→&nbsp;
          🚚 <em>Hệ thống tự gán shipper</em> &nbsp;→&nbsp; ✅ Shipper lấy & giao
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: tab === t.key ? '#1E3A8A' : '#fff',
              color: tab === t.key ? '#fff' : '#64748B',
              borderRight: '1px solid #E2E8F0', transition: 'all 0.15s',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Order list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Đang tải...</div>
          ) : orders.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
              Không có đơn hàng nào ở trạng thái này
            </div>
          ) : orders.map(o => {
            const nextAction = STATUS_NEXT[o.order_status]
            const isReadyToShip = o.order_status === 'ready_to_ship'
            return (
              <div key={o.order_id} style={{
                background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
              }}>
                {/* Order info */}
                <div style={{ flex: 1, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', margin: 0 }}>Đơn #{o.order_id}</p>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
                      Khách #{o.user_id} · {o.created_at ? new Date(o.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: (STATUS_COLOR[o.order_status] ?? '#64748B') + '18',
                    color: STATUS_COLOR[o.order_status] ?? '#64748B',
                  }}>
                    {STATUS_VI[o.order_status] ?? o.order_status}
                  </span>
                  <div style={{ fontWeight: 700, color: '#1D4ED8', fontSize: 14 }}>
                    {Number(o.total_amount).toLocaleString('vi-VN')}₫
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    TT: <strong>{o.payment_status === 'paid' ? '✅ Đã TT' : '⏳ Chưa TT'}</strong>
                  </div>
                </div>

                {/* Action — chỉ cho pending và confirmed */}
                {nextAction && (
                  <button
                    disabled={acting === o.order_id}
                    onClick={() => handleAction(o.order_id, nextAction.nextStatus)}
                    style={{
                      padding: '9px 18px', border: 'none', borderRadius: 9, cursor: 'pointer',
                      background: nextAction.bg, color: nextAction.color,
                      fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
                      opacity: acting === o.order_id ? 0.6 : 1, transition: 'opacity 0.15s',
                    }}>
                    {acting === o.order_id ? '⏳ ...' : nextAction.label}
                  </button>
                )}

                {/* ready_to_ship: hiển thị info chờ shipper */}
                {isReadyToShip && (
                  <div style={{ padding: '8px 14px', background: '#F5F3FF', borderRadius: 9, fontSize: 12, color: '#7C3AED', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {o.shipper_id ? `🚚 Shipper #${o.shipper_id}` : '⏳ Chờ shipper'}
                  </div>
                )}

                {/* Nút xem chi tiết */}
                <button
                  onClick={() => openDetail(o.order_id)}
                  style={{ padding: '9px 14px', background: '#F1F5F9', color: '#1E3A8A', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  🔍 Chi tiết
                </button>
              </div>
            )
          })}
        </div>

        {/* Modal chi tiết đơn hàng */}
        {(detail !== null || detailLoading) && (
          <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
            onClick={() => setDetail(null)}>
            <div style={{ background:'var(--bg-card)',borderRadius:16,padding:28,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
              {detailLoading ? (
                <p style={{ textAlign:'center',color:'#64748B',padding:40 }}>Đang tải...</p>
              ) : detail?.error ? (
                <p style={{ textAlign:'center',color:'#DC2626' }}>Không thể tải chi tiết</p>
              ) : detail && (
                <>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
                    <h3 style={{ fontWeight:800,fontSize:17,color:'#0F172A',margin:0 }}>
                      📋 {detail.order_number || `Đơn #${detail.order_id}`}
                    </h3>
                    <button onClick={() => setDetail(null)} style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#64748B' }}>✕</button>
                  </div>

                  {/* Sản phẩm */}
                  <div style={{ marginBottom:16 }}>
                    <p style={{ fontSize:12,fontWeight:700,color:'#64748B',marginBottom:8,textTransform:'uppercase' }}>📦 Sản phẩm</p>
                    {detail.items?.map((it: any, idx: number) => (
                      <div key={idx} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #F1F5F9' }}>
                        {it.product_image && <img src={it.product_image} alt="" style={{ width:40,height:40,objectFit:'cover',borderRadius:8 }} />}
                        <div style={{ flex:1 }}>
                          <p style={{ fontSize:13,fontWeight:600,color:'#111827',margin:0 }}>{it.product_name}</p>
                          <p style={{ fontSize:12,color:'#6B7280',margin:0 }}>x{it.quantity} · {parseInt(it.price_at_order).toLocaleString('vi-VN')}₫</p>
                        </div>
                        <p style={{ fontWeight:700,fontSize:13,color:'#7C3AED' }}>
                          {(parseInt(it.price_at_order)*it.quantity).toLocaleString('vi-VN')}₫
                        </p>
                      </div>
                    ))}
                    <div style={{ display:'flex',justifyContent:'flex-end',marginTop:10 }}>
                      <span style={{ fontWeight:800,fontSize:15,color:'#7C3AED' }}>
                        Tổng: {Number(detail.total_amount || 0).toLocaleString('vi-VN')}₫
                      </span>
                    </div>
                  </div>

                  {/* Tuyến vận chuyển */}
                  {detail.shipment && (
                    <div style={{ marginBottom:16 }}>
                      <p style={{ fontSize:12,fontWeight:700,color:'#64748B',marginBottom:8,textTransform:'uppercase' }}>🚚 Thông tin vận chuyển</p>
                      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
                        <div style={{ background:'#F0FDF4',borderRadius:9,padding:'10px 12px' }}>
                          <p style={{ fontSize:10,fontWeight:700,color:'#059669',marginBottom:3 }}>📦 LẤY HÀNG TẠI</p>
                          <p style={{ fontSize:12,color:'#065F46' }}>{detail.shipment.pickup_location || '—'}</p>
                        </div>
                        <div style={{ background:'#EFF6FF',borderRadius:9,padding:'10px 12px' }}>
                          <p style={{ fontSize:10,fontWeight:700,color:'#1D4ED8',marginBottom:3 }}>📍 GIAO ĐẾN</p>
                          <p style={{ fontSize:12,color:'#1E3A8A' }}>{detail.shipment.delivery_location || detail.shipping_address || '—'}</p>
                        </div>
                      </div>

                      {detail.shipment.shipper_info ? (
                        <div style={{ display:'flex',alignItems:'center',gap:12,background:'#FAFAFA',border:'1px solid #E5E7EB',borderRadius:10,padding:'10px 14px' }}>
                          <div style={{ width:42,height:42,borderRadius:'50%',background:'#DBEAFE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>🛵</div>
                          <div>
                            <p style={{ fontWeight:700,fontSize:14,color:'#111827',margin:0 }}>{detail.shipment.shipper_info.name}</p>
                            <div style={{ display:'flex',gap:12,marginTop:3 }}>
                              {detail.shipment.shipper_info.phone && <span style={{ fontSize:12,color:'#2563EB' }}>📞 {detail.shipment.shipper_info.phone}</span>}
                              {detail.shipment.shipper_info.vehicle_type && <span style={{ fontSize:12,color:'#6B7280' }}>🏍️ {detail.shipment.shipper_info.vehicle_type}</span>}
                              <span style={{ fontSize:12,color:'#F59E0B' }}>⭐ {parseFloat(detail.shipment.shipper_info.rating).toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding:'8px 12px',background:'#FEF9C3',borderRadius:8,fontSize:12,color:'#92400E' }}>⏳ Chưa gán shipper</div>
                      )}
                    </div>
                  )}

                  {/* Người nhận */}
                  <div style={{ background:'#F8FAFC',borderRadius:10,padding:'12px 14px' }}>
                    <p style={{ fontSize:12,fontWeight:700,color:'#64748B',marginBottom:6,textTransform:'uppercase' }}>👤 Người nhận</p>
                    <p style={{ fontSize:13,color:'#111827',margin:'0 0 3px' }}>{detail.recipient_name || '—'}</p>
                    <p style={{ fontSize:13,color:'#2563EB',margin:'0 0 3px' }}>{detail.recipient_phone || '—'}</p>
                    <p style={{ fontSize:12,color:'#6B7280',margin:0 }}>{detail.shipping_address || '—'}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: toast.ok ? '#064E3B' : '#7F1D1D',
            color: '#fff', padding: '12px 28px', borderRadius: 12,
            fontWeight: 600, fontSize: 13, zIndex: 9999,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            maxWidth: '80vw', textAlign: 'center',
          }}>
            {toast.msg}
          </div>
        )}
      </div>
    </EmployeeLayout>
  )
}

export default EmployeeOrdersPage
