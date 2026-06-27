import React, { useEffect, useState } from 'react'
import { shipmentService } from '../../services/shipmentService'

const C = {
  amber: '#D97706', light: '#FEF3C7', tint: '#FFFBEB',
  navy: '#1E3A8A', blue: '#1D4ED8', gray: '#64748B',
  success: '#16A34A', error: '#DC2626',
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  assigned:   { label: '📦 Cần lấy tại shop', color: '#7C3AED', bg: '#EDE9FE' },
  pending:    { label: '⏳ Chờ lấy',          color: C.blue,    bg: '#DBEAFE' },
  in_transit: { label: '🚚 Đang giao',        color: C.amber,   bg: C.light   },
  delivered:  { label: '✓ Đã giao',           color: C.success, bg: '#DCFCE7' },
  failed:     { label: '✗ Thất bại',          color: C.error,   bg: '#FEE2E2' },
}

const QUICK_FAIL = ['Không tìm được địa chỉ', 'Khách không nghe máy', 'Khách từ chối nhận hàng', 'Địa chỉ không chính xác']

const DeliveryListPage: React.FC = () => {
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('all')
  const [confirmId, setConfirmId]   = useState<number | null>(null)
  const [confirmType, setConfirmType] = useState<'pickup'|'deliver'|'fail'|null>(null)
  const [failReason, setFailReason] = useState('')

  useEffect(() => {
    setLoading(true)
    shipmentService.getMyDeliveries({ limit: 100 })
      .then((r: any) => {
        const list = r.data?.deliveries ?? r.data
        if (Array.isArray(list)) setDeliveries(list)
      })
      .catch(() => setDeliveries([]))
      .finally(() => setLoading(false))
  }, [])

  const handleAction = (id: number, newStatus: string, reason?: string) => {
    setDeliveries(ds => ds.map(d => d.shipment_id === id ? { ...d, status: newStatus, fail_reason: reason } : d))
    if (newStatus === 'in_transit') shipmentService.pickup(id).catch(() => {})
    if (newStatus === 'delivered')  shipmentService.delivered(id).catch(() => {})
    setConfirmId(null); setConfirmType(null); setFailReason('')
  }

  const counts: Record<string, number> = {
    all:        deliveries.length,
    assigned:   deliveries.filter(d => d.status === 'assigned').length,
    pending:    deliveries.filter(d => d.status === 'pending').length,
    in_transit: deliveries.filter(d => d.status === 'in_transit').length,
    delivered:  deliveries.filter(d => d.status === 'delivered').length,
    failed:     deliveries.filter(d => d.status === 'failed').length,
  }
  const filtered = filter === 'all' ? deliveries : deliveries.filter(d => d.status === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.amber, margin: 0 }}>📦 Đơn giao hàng</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 3 }}>Quản lý và cập nhật trạng thái đơn hàng</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {[
          { key:'assigned',   label:'Cần lấy',   color: '#7C3AED' },
          { key:'pending',    label:'Chờ lấy',   color: C.blue    },
          { key:'in_transit', label:'Đang giao', color: C.amber   },
          { key:'delivered',  label:'Đã giao',   color: C.success },
          { key:'failed',     label:'Thất bại',  color: C.error   },
        ].map(s => (
          <div key={s.key} onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
            style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '12px 14px', borderLeft: `3px solid ${s.color}`, cursor: 'pointer',
              boxShadow: filter === s.key ? `0 0 0 2px ${s.color}` : '0 1px 3px rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: C.gray, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{counts[s.key]}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', flexWrap: 'wrap' }}>
        {[['all','Tất cả'],['assigned','Cần lấy'],['pending','Chờ lấy'],['in_transit','Đang giao'],['delivered','Đã giao'],['failed','Thất bại']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: filter === k ? C.amber : '#F1F5F9', color: filter === k ? 'white' : C.gray,
          }}>{l}{counts[k] > 0 ? ` (${counts[k]})` : ''}</button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 40, textAlign: 'center', color: C.gray }}>Không có đơn nào</div>
        ) : filtered.map(d => {
          const st = STATUS_STYLE[d.status] ?? STATUS_STYLE.pending
          return (
            <div key={d.shipment_id} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                    <p style={{ fontWeight: 800, fontSize: 16, color: C.navy, margin: 0 }}>Đơn #{d.order_id}</p>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>🕐 {d.created_at?.slice(0,16)?.replace('T',' ')}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {d.amount != null && (
                    <p style={{ fontWeight: 800, fontSize: 16, color: C.amber, margin: 0 }}>{d.amount.toLocaleString('vi-VN')}₫</p>
                  )}
                  {d.payment_method && (
                    <span style={{ fontSize: 11, color: C.gray }}>{d.payment_method === 'cod' ? '💵 COD' : '💳 Online'}</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ background: '#F8FAFC', borderRadius: 9, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 4 }}>📦 LẤY TẠI</p>
                  <p style={{ fontSize: 12, color: C.navy, margin: 0 }}>{d.pickup_location}</p>
                </div>
                <div style={{ background: C.tint, borderRadius: 9, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.amber, marginBottom: 4 }}>📍 GIAO ĐẾN</p>
                  <p style={{ fontSize: 12, color: C.navy, margin: 0 }}>{d.delivery_location}</p>
                </div>
              </div>

              {(d.recipient || d.phone) && (
                <p style={{ fontSize: 13, color: C.gray, marginBottom: 12 }}>
                  {d.recipient ? `👤 ${d.recipient}` : ''}{d.recipient && d.phone ? ' · ' : ''}{d.phone ? `📞 ${d.phone}` : ''}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                {(d.status === 'assigned' || d.status === 'pending') && (
                  <button onClick={() => { setConfirmId(d.shipment_id); setConfirmType('pickup') }}
                    style={{ flex: 1, padding: '10px', background: d.status === 'assigned' ? '#7C3AED' : C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    📦 Xác nhận đã lấy hàng tại shop
                  </button>
                )}
                {d.status === 'in_transit' && (
                  <>
                    <button onClick={() => { setConfirmId(d.shipment_id); setConfirmType('deliver') }}
                      style={{ flex: 2, padding: '10px', background: C.success, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      ✅ Xác nhận đã giao
                    </button>
                    <button onClick={() => { setConfirmId(d.shipment_id); setConfirmType('fail') }}
                      style={{ flex: 1, padding: '10px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      ✗ Thất bại
                    </button>
                  </>
                )}
                {(d.status === 'delivered' || d.status === 'failed') && (
                  <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>
                    {d.status === 'delivered' ? '✓ Hoàn thành' : `✗ ${d.fail_reason || 'Không giao được'}`}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {confirmId && confirmType === 'pickup' && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={() => setConfirmId(null)}>
          <div style={{ background:'var(--bg-card)',borderRadius:16,padding:28,width:400 }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontWeight:800,fontSize:18,color:C.navy,marginBottom:12 }}>📦 Xác nhận đã lấy hàng</h3>
            <p style={{ fontSize:14,color:C.gray,marginBottom:12 }}>Bạn đã tới shop và nhận đơn hàng #{confirmId}?</p>
            <div style={{ background:'#EDE9FE',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:13,color:'#7C3AED' }}>
              📋 Sau khi xác nhận:<br/>
              • Trạng thái đơn chuyển sang <strong>"Đang giao"</strong><br/>
              • Khách hàng nhận được thông báo
            </div>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setConfirmId(null)} style={{ flex:1,padding:10,background:'#F1F5F9',color:C.gray,border:'none',borderRadius:9,fontWeight:600,cursor:'pointer' }}>Hủy</button>
              <button onClick={() => handleAction(confirmId,'in_transit')} style={{ flex:2,padding:10,background:'#7C3AED',color:'white',border:'none',borderRadius:9,fontWeight:700,cursor:'pointer' }}>🚚 Đã lấy hàng — Bắt đầu giao</button>
            </div>
          </div>
        </div>
      )}

      {confirmId && confirmType === 'deliver' && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={() => setConfirmId(null)}>
          <div style={{ background:'var(--bg-card)',borderRadius:16,padding:28,width:380 }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontWeight:800,fontSize:18,color:C.navy,marginBottom:12 }}>✅ Xác nhận giao thành công</h3>
            <p style={{ fontSize:14,color:C.gray,marginBottom:16 }}>Đã chụp ảnh người nhận và bàn giao đơn #{confirmId}?</p>
            <div style={{ background:'#DCFCE7',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:13,color:C.success }}>
              📸 Chụp ảnh người nhận → Xác nhận bàn giao
            </div>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setConfirmId(null)} style={{ flex:1,padding:10,background:'#F1F5F9',color:C.gray,border:'none',borderRadius:9,fontWeight:600,cursor:'pointer' }}>Hủy</button>
              <button onClick={() => handleAction(confirmId,'delivered')} style={{ flex:2,padding:10,background:C.success,color:'white',border:'none',borderRadius:9,fontWeight:700,cursor:'pointer' }}>🎉 Giao thành công!</button>
            </div>
          </div>
        </div>
      )}

      {confirmId && confirmType === 'fail' && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={() => setConfirmId(null)}>
          <div style={{ background:'var(--bg-card)',borderRadius:16,padding:28,width:420 }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontWeight:800,fontSize:18,color:C.error,marginBottom:14 }}>✗ Báo giao hàng thất bại</h3>
            <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:12 }}>
              {QUICK_FAIL.map(r => (
                <button key={r} onClick={() => setFailReason(r)} style={{ padding:'9px 14px',background:failReason===r?'#FEE2E2':'#F8FAFC',border:`1px solid ${failReason===r?C.error:'#E2E8F0'}`,borderRadius:8,textAlign:'left',cursor:'pointer',fontSize:13,color:failReason===r?C.error:C.navy,fontWeight:failReason===r?600:400 }}>
                  {failReason===r?'✓ ':''}{r}
                </button>
              ))}
            </div>
            <textarea value={failReason} onChange={e=>setFailReason(e.target.value)} rows={2} placeholder="Hoặc nhập lý do thủ công..."
              style={{ width:'100%',padding:'10px 12px',border:'1px solid #E2E8F0',borderRadius:8,fontSize:13,outline:'none',resize:'none',boxSizing:'border-box',marginBottom:14 }} />
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setConfirmId(null)} style={{ flex:1,padding:10,background:'#F1F5F9',color:C.gray,border:'none',borderRadius:9,fontWeight:600,cursor:'pointer' }}>Hủy</button>
              <button onClick={() => handleAction(confirmId,'failed',failReason)} style={{ flex:2,padding:10,background:C.error,color:'white',border:'none',borderRadius:9,fontWeight:700,cursor:'pointer' }}>Xác nhận thất bại</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeliveryListPage
