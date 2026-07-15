import React, { useEffect, useRef, useState } from 'react'
import { shipmentService } from '../../services/shipmentService'

const C = {
  amber: '#D97706', light: '#FEF3C7', tint: '#FFFBEB',
  navy: '#1E3A8A', blue: '#1D4ED8', gray: '#64748B',
  success: '#16A34A', error: '#DC2626', purple: '#7C3AED',
  teal: '#0D9488',
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  assigned:         { label: '📦 Cần lấy tại shop',    color: C.purple,  bg: '#EDE9FE' },
  pending:          { label: '⏳ Chờ lấy',              color: C.blue,    bg: '#DBEAFE' },
  in_transit:       { label: '🚚 Đang giao',            color: C.amber,   bg: C.light   },
  out_for_delivery: { label: '🏍️ Đang giao (khu vực)',  color: C.teal,    bg: '#CCFBF1' },
  at_warehouse:     { label: '🏭 Tại kho trung chuyển', color: C.teal,    bg: '#CCFBF1' },
  delivered:        { label: '✓ Đã giao',               color: C.success, bg: '#DCFCE7' },
  failed:           { label: '✗ Thất bại',              color: C.error,   bg: '#FEE2E2' },
}

const SHIPPER_TYPE: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  free:           { label: 'Tự do',     icon: '🛵', color: C.purple, bg: '#EDE9FE' },
  zone:           { label: 'Khu vực',   icon: '🏍️', color: C.teal,   bg: '#CCFBF1' },
  inter_province: { label: 'Liên tỉnh', icon: '🚚', color: C.amber,  bg: C.light   },
}

const QUICK_FAIL = ['Không tìm được địa chỉ', 'Khách không nghe máy', 'Khách từ chối nhận hàng', 'Địa chỉ không chính xác']

// ── Shared Leaflet loader ────────────────────────────────────────────────────
function loadLeaflet(cb: () => void) {
  if ((window as any).L) { cb(); return }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  document.head.appendChild(link)
  const script = document.createElement('script')
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
  script.onload = cb
  document.head.appendChild(script)
}

// ── Inline Map (shown directly in card when in_transit) ──────────────────────
const InlineMap: React.FC<{ delivery: any }> = ({ delivery: d }) => {
  const mapRef  = useRef<HTMLDivElement>(null)
  const mapInst = useRef<any>(null)

  useEffect(() => {
    const init = () => {
      const L = (window as any).L
      if (!L || !mapRef.current || mapInst.current) return
      const defLat = 10.7769, defLng = 106.7009
      const map = L.map(mapRef.current).setView([defLat, defLng], 13)
      mapInst.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map)

      const bounds: [number,number][] = []
      const shopLL: [number,number] = [defLat + 0.012, defLng - 0.012]
      L.marker(shopLL, { icon: L.divIcon({ html: '<div style="font-size:28px;line-height:1">🏪</div>', className:'', iconSize:[32,32], iconAnchor:[16,32] }) })
        .addTo(map).bindPopup('<b>📦 Lấy hàng</b><br/>' + (d.pickup_location ?? ''))
      bounds.push(shopLL)

      const custLL: [number,number] = [defLat - 0.012, defLng + 0.012]
      L.marker(custLL, { icon: L.divIcon({ html: '<div style="font-size:28px;line-height:1">🏠</div>', className:'', iconSize:[32,32], iconAnchor:[16,32] }) })
        .addTo(map).bindPopup('<b>🏠 Giao đến</b><br/>' + (d.delivery_location ?? ''))
      bounds.push(custLL)

      if (d.current_location?.lat && d.current_location?.lng) {
        const sLL: [number,number] = [d.current_location.lat, d.current_location.lng]
        L.marker(sLL, { icon: L.divIcon({ html: '<div style="font-size:28px;line-height:1;animation:pulse 1s infinite">🛵</div>', className:'', iconSize:[32,32], iconAnchor:[16,32] }) })
          .addTo(map).bindPopup('<b>Vị trí của bạn</b>')
        bounds.push(sLL)
      }

      L.polyline([shopLL, custLL], { color: C.amber, weight: 3, dashArray: '6 4' }).addTo(map)
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [48, 48] })
    }
    loadLeaflet(init)
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null } }
  }, [])

  return <div ref={mapRef} style={{ height: 280, width: '100%', borderRadius: '0 0 12px 12px', overflow: 'hidden', background: '#E5E7EB' }} />
}

// ── Map Modal (used for non-transit orders) ──────────────────────────────────
const MapModal: React.FC<{ delivery: any; onClose: () => void }> = ({ delivery: d, onClose }) => {
  const mapRef  = useRef<HTMLDivElement>(null)
  const mapInst = useRef<any>(null)

  useEffect(() => {
    const init = () => {
      const L = (window as any).L
      if (!L || !mapRef.current || mapInst.current) return
      const defLat = 10.7769, defLng = 106.7009
      const map = L.map(mapRef.current).setView([defLat, defLng], 13)
      mapInst.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(map)
      const bounds: [number,number][] = []
      const shopLL: [number,number] = [defLat + 0.01, defLng - 0.01]
      L.marker(shopLL, { icon: L.divIcon({ html: '<div style="font-size:26px">🏪</div>', className:'', iconSize:[30,30], iconAnchor:[15,30] }) })
        .addTo(map).bindPopup('<b>📦 Lấy hàng tại shop</b><br/>' + (d.pickup_location ?? ''), { maxWidth: 260 }).openPopup()
      bounds.push(shopLL)
      const custLL: [number,number] = [defLat - 0.01, defLng + 0.01]
      L.marker(custLL, { icon: L.divIcon({ html: '<div style="font-size:26px">📍</div>', className:'', iconSize:[30,30], iconAnchor:[15,30] }) })
        .addTo(map).bindPopup('<b>🏠 Giao đến khách</b><br/>' + (d.delivery_location ?? ''), { maxWidth: 260 })
      bounds.push(custLL)
      L.polyline(bounds, { color: C.amber, weight: 3, dashArray: '6 4' }).addTo(map)
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [50, 50] })
    }
    loadLeaflet(init)
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null } }
  }, [])

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
      onClick={onClose}>
      <div style={{ background:'var(--bg-card)',borderRadius:18,width:'100%',maxWidth:720,boxShadow:'0 24px 60px rgba(0,0,0,0.3)',overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border-subtle)' }}>
          <p style={{ fontWeight:800,fontSize:16,color:C.navy,margin:0 }}>🗺️ Bản đồ — Đơn #{d.order_id}</p>
          <button onClick={onClose} style={{ background:'#F1F5F9',border:'none',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontWeight:700,color:C.gray }}>✕ Đóng</button>
        </div>
        <div ref={mapRef} style={{ height:360,width:'100%',background:'#E5E7EB' }} />
        <div style={{ padding:'14px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
          <div style={{ background:'#EDE9FE',borderRadius:10,padding:'10px 14px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:C.purple,marginBottom:4 }}>🏪 LẤY HÀNG TẠI</p>
            <p style={{ fontSize:13,color:C.navy,margin:0 }}>{d.pickup_location || 'Chưa có địa chỉ'}</p>
          </div>
          <div style={{ background:C.tint,borderRadius:10,padding:'10px 14px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:C.amber,marginBottom:4 }}>📍 GIAO ĐẾN KHÁCH</p>
            <p style={{ fontSize:13,color:C.navy,margin:0 }}>{d.delivery_location || 'Chưa có địa chỉ'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
const DeliveryListPage: React.FC = () => {
  const [tab, setTab]               = useState<'my'|'available'>('my')
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('all')
  const [available, setAvailable]   = useState<any[]>([])
  const [avLoading, setAvLoading]   = useState(false)
  const [claimingId, setClaimingId] = useState<number | null>(null)
  const [confirmId, setConfirmId]   = useState<number | null>(null)
  const [confirmType, setConfirmType] = useState<'pickup'|'deliver'|'fail'|null>(null)
  const [failReason, setFailReason] = useState('')
  const [mapDelivery, setMapDelivery] = useState<any | null>(null)
  // Mock shipper type — will come from /api/v1/shipments/shipper/me/profile in real backend
  const [shipperType] = useState<string>('free')

  const loadMyDeliveries = () => {
    setLoading(true)
    shipmentService.getMyDeliveries({ limit: 100 })
      .then((r: any) => {
        const list = r.data?.deliveries ?? r.data
        if (Array.isArray(list)) setDeliveries(list)
      })
      .catch(() => setDeliveries([]))
      .finally(() => setLoading(false))
  }

  const loadAvailable = () => {
    setAvLoading(true)
    shipmentService.getPendingOrders({ limit: 50 })
      .then((r: any) => {
        const list = r.data?.shipments ?? r.data
        if (Array.isArray(list)) setAvailable(list)
      })
      .catch(() => setAvailable([]))
      .finally(() => setAvLoading(false))
  }

  useEffect(() => { loadMyDeliveries() }, [])
  useEffect(() => { if (tab === 'available') loadAvailable() }, [tab])

  const handleAction = (id: number, newStatus: string, reason?: string) => {
    setDeliveries(ds => ds.map(d => d.shipment_id === id ? { ...d, status: newStatus, fail_reason: reason } : d))
    if (newStatus === 'in_transit') shipmentService.pickup(id).catch(() => {})
    if (newStatus === 'delivered')  shipmentService.delivered(id).catch(() => {})
    setConfirmId(null); setConfirmType(null); setFailReason('')
  }

  const handleClaim = async (shipmentId: number) => {
    setClaimingId(shipmentId)
    try {
      await shipmentService.accept(shipmentId)
      setAvailable(av => av.filter(s => s.shipment_id !== shipmentId))
      loadMyDeliveries()
      setTab('my')
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? 'Không thể nhận đơn này.')
      loadAvailable()
    } finally {
      setClaimingId(null)
    }
  }

  const counts: Record<string, number> = {
    all:        deliveries.length,
    assigned:   deliveries.filter(d => d.status === 'assigned').length,
    pending:    deliveries.filter(d => d.status === 'pending').length,
    in_transit: deliveries.filter(d => d.status === 'in_transit' || d.status === 'out_for_delivery').length,
    delivered:  deliveries.filter(d => d.status === 'delivered').length,
    failed:     deliveries.filter(d => d.status === 'failed').length,
  }
  const filtered = filter === 'all' ? deliveries : filter === 'in_transit'
    ? deliveries.filter(d => d.status === 'in_transit' || d.status === 'out_for_delivery')
    : deliveries.filter(d => d.status === filter)

  // Shipper type badge
  const stype = SHIPPER_TYPE[shipperType] ?? SHIPPER_TYPE.free

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,color:C.amber,margin:0 }}>📦 Đơn giao hàng</h1>
          <p style={{ fontSize:13,color:C.gray,marginTop:3 }}>Quản lý và cập nhật trạng thái đơn hàng</p>
        </div>
        {/* Shipper type badge */}
        <div style={{ background:stype.bg,borderRadius:12,padding:'8px 14px',display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ fontSize:22 }}>{stype.icon}</span>
          <div>
            <p style={{ fontSize:11,color:stype.color,fontWeight:700,margin:0 }}>LOẠI SHIPPER</p>
            <p style={{ fontSize:14,color:stype.color,fontWeight:800,margin:0 }}>{stype.label}</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display:'flex',background:'var(--bg-card)',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
        {(['my','available'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex:1,padding:'13px',border:'none',cursor:'pointer',fontSize:13,fontWeight:700,
            background: tab === k ? C.amber : 'transparent',
            color: tab === k ? 'white' : C.gray,
          }}>
            {k === 'my' ? '📋 Đơn của tôi' : '🆕 Đơn chờ nhận'}
            {k === 'available' && available.length > 0 && (
              <span style={{ marginLeft:6,background:C.error,color:'white',borderRadius:10,padding:'1px 7px',fontSize:11 }}>{available.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Đơn của tôi */}
      {tab === 'my' && (
        <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
          {/* Stats */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10 }}>
            {[
              { key:'assigned',   label:'Cần lấy',   color: C.purple  },
              { key:'pending',    label:'Chờ lấy',   color: C.blue    },
              { key:'in_transit', label:'Đang giao', color: C.amber   },
              { key:'delivered',  label:'Đã giao',   color: C.success },
              { key:'failed',     label:'Thất bại',  color: C.error   },
            ].map(s => (
              <div key={s.key} onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
                style={{ background:'var(--bg-card)',borderRadius:12,padding:'12px 14px',borderLeft:'3px solid ' + s.color,cursor:'pointer',
                  boxShadow: filter === s.key ? '0 0 0 2px ' + s.color : '0 1px 3px rgba(0,0,0,0.07)' }}>
                <p style={{ fontSize:10,fontWeight:600,color:C.gray,textTransform:'uppercase',margin:0 }}>{s.label}</p>
                <p style={{ fontSize:22,fontWeight:800,color:s.color,margin:0 }}>{counts[s.key]}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div style={{ display:'flex',gap:8,background:'var(--bg-card)',padding:'10px 14px',borderRadius:12,flexWrap:'wrap' }}>
            {[['all','Tất cả'],['assigned','Cần lấy'],['pending','Chờ lấy'],['in_transit','Đang giao'],['delivered','Đã giao'],['failed','Thất bại']].map(([k,l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                padding:'7px 16px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background: filter === k ? C.amber : '#F1F5F9',
                color: filter === k ? 'white' : C.gray,
              }}>{l}{counts[k] > 0 ? ' (' + counts[k] + ')' : ''}</button>
            ))}
          </div>

          {/* Cards */}
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            {loading ? (
              <div style={{ padding:40,textAlign:'center',color:C.gray }}>Đang tải...</div>
            ) : filtered.length === 0 ? (
              <div style={{ background:'var(--bg-card)',borderRadius:14,padding:40,textAlign:'center',color:C.gray }}>Không có đơn nào</div>
            ) : filtered.map(d => {
              const st = STATUS_STYLE[d.status] ?? STATUS_STYLE.pending
              const isActive = d.status === 'in_transit' || d.status === 'out_for_delivery'
              return (
                <div key={d.shipment_id} style={{
                  background:'var(--bg-card)',borderRadius:14,overflow:'hidden',
                  boxShadow: isActive ? '0 4px 20px rgba(217,119,6,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
                  border: isActive ? '2px solid ' + C.amber : '1px solid transparent',
                }}>
                  {/* Card header */}
                  <div style={{ padding:'16px 18px 0' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10 }}>
                      <div>
                        <div style={{ display:'flex',gap:8,alignItems:'center',marginBottom:3 }}>
                          <p style={{ fontWeight:800,fontSize:16,color:C.navy,margin:0 }}>Đơn #{d.order_id}</p>
                          <span style={{ fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:st.bg,color:st.color }}>{st.label}</span>
                          {isActive && <span style={{ fontSize:11,background:'#FEF3C7',color:C.amber,borderRadius:10,padding:'2px 8px',fontWeight:700,animation:'pulse 2s infinite' }}>● ĐANG GIAO</span>}
                        </div>
                        <p style={{ fontSize:12,color:C.gray,margin:0 }}>{d.created_at?.slice(0,16)?.replace('T',' ')}</p>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        {d.amount != null && <p style={{ fontWeight:800,fontSize:16,color:C.amber,margin:0 }}>{d.amount.toLocaleString('vi-VN')}₫</p>}
                        {d.payment_method && <span style={{ fontSize:11,color:C.gray }}>{d.payment_method === 'cod' ? '💵 COD' : '💳 Online'}</span>}
                      </div>
                    </div>

                    {/* Info row — compact when active (map takes priority) */}
                    {isActive ? (
                      // Active: show compact address bar above map
                      <div style={{ display:'flex',gap:8,marginBottom:10 }}>
                        <div style={{ flex:1,background:'#EDE9FE',borderRadius:9,padding:'8px 12px' }}>
                          <p style={{ fontSize:10,fontWeight:700,color:C.purple,margin:'0 0 2px' }}>🏪 LẤY TẠI</p>
                          <p style={{ fontSize:12,color:C.navy,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{d.pickup_location}</p>
                        </div>
                        <div style={{ flex:1,background:C.tint,borderRadius:9,padding:'8px 12px' }}>
                          <p style={{ fontSize:10,fontWeight:700,color:C.amber,margin:'0 0 2px' }}>📍 GIAO ĐẾN</p>
                          <p style={{ fontSize:12,color:C.navy,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{d.delivery_location}</p>
                        </div>
                      </div>
                    ) : (
                      // Non-active: full address grid + recipient
                      <div>
                        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10 }}>
                          <div style={{ background:'#F8FAFC',borderRadius:9,padding:'10px 14px' }}>
                            <p style={{ fontSize:11,fontWeight:600,color:C.gray,marginBottom:4 }}>📦 LẤY TẠI</p>
                            <p style={{ fontSize:12,color:C.navy,margin:0 }}>{d.pickup_location}</p>
                          </div>
                          <div style={{ background:C.tint,borderRadius:9,padding:'10px 14px' }}>
                            <p style={{ fontSize:11,fontWeight:600,color:C.amber,marginBottom:4 }}>📍 GIAO ĐẾN</p>
                            <p style={{ fontSize:12,color:C.navy,margin:0 }}>{d.delivery_location}</p>
                          </div>
                        </div>
                        {(d.recipient || d.phone) && (
                          <p style={{ fontSize:13,color:C.gray,marginBottom:10 }}>
                            {d.recipient ? '👤 ' + d.recipient : ''}{d.recipient && d.phone ? ' · ' : ''}{d.phone ? '📞 ' + d.phone : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* INLINE MAP — only for active (in_transit) orders */}
                  {isActive && <InlineMap delivery={d} />}

                  {/* Action buttons */}
                  <div style={{ padding:'12px 16px',display:'flex',gap:8,borderTop: isActive ? '1px solid ' + C.light : 'none' }}>
                    {!isActive && (
                      <button onClick={() => setMapDelivery(d)}
                        style={{ padding:'9px 14px',background:'#EFF6FF',color:C.blue,border:'1px solid #BFDBFE',borderRadius:9,fontWeight:600,fontSize:13,cursor:'pointer' }}>
                        🗺️ Bản đồ
                      </button>
                    )}
                    {(d.status === 'assigned' || d.status === 'pending') && (
                      <button onClick={() => { setConfirmId(d.shipment_id); setConfirmType('pickup') }}
                        style={{ flex:1,padding:'10px',background:d.status === 'assigned' ? C.purple : C.blue,color:'white',border:'none',borderRadius:9,fontWeight:700,fontSize:13,cursor:'pointer' }}>
                        📦 Xác nhận đã lấy hàng tại shop
                      </button>
                    )}
                    {isActive && (
                      <div style={{ flex:1,display:'flex',gap:8 }}>
                        <button onClick={() => { setConfirmId(d.shipment_id); setConfirmType('deliver') }}
                          style={{ flex:3,padding:'11px',background:C.success,color:'white',border:'none',borderRadius:9,fontWeight:700,fontSize:14,cursor:'pointer' }}>
                          ✅ Xác nhận đã giao
                        </button>
                        <button onClick={() => { setConfirmId(d.shipment_id); setConfirmType('fail') }}
                          style={{ flex:1,padding:'11px',background:'#FEE2E2',color:C.error,border:'none',borderRadius:9,fontWeight:600,fontSize:13,cursor:'pointer' }}>
                          ✗ Thất bại
                        </button>
                      </div>
                    )}
                    {(d.status === 'delivered' || d.status === 'failed') && (
                      <p style={{ fontSize:13,color:C.gray,margin:0,padding:'8px 0' }}>
                        {d.status === 'delivered' ? '✓ Hoàn thành' : '✗ ' + (d.fail_reason || 'Không giao được')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab: Đơn chờ nhận */}
      {tab === 'available' && (
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <p style={{ fontSize:13,color:C.gray,margin:0 }}>Đơn hàng chưa có shipper nhận — hãy nhận đơn gần bạn</p>
            <button onClick={loadAvailable} style={{ padding:'7px 14px',background:'#F1F5F9',border:'none',borderRadius:8,fontSize:12,fontWeight:600,color:C.gray,cursor:'pointer' }}>
              🔄 Làm mới
            </button>
          </div>

          {avLoading ? (
            <div style={{ padding:40,textAlign:'center',color:C.gray }}>Đang tải...</div>
          ) : available.length === 0 ? (
            <div style={{ background:'var(--bg-card)',borderRadius:14,padding:40,textAlign:'center',color:C.gray }}>
              <p style={{ fontSize:32,margin:0 }}>📭</p>
              <p style={{ fontWeight:600,marginTop:8 }}>Chưa có đơn hàng mới</p>
              <p style={{ fontSize:13 }}>Kiểm tra lại sau ít phút</p>
            </div>
          ) : available.map(s => (
            <div key={s.shipment_id} style={{ background:'var(--bg-card)',borderRadius:14,padding:'18px 20px',boxShadow:'0 1px 3px rgba(0,0,0,0.08)',borderLeft:'3px solid ' + C.success }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12 }}>
                <div>
                  <p style={{ fontWeight:800,fontSize:16,color:C.navy,margin:0 }}>Đơn #{s.order_id}</p>
                  <p style={{ fontSize:12,color:C.gray,marginTop:2 }}>{s.created_at?.slice(0,16)?.replace('T',' ')}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  {s.amount != null && <p style={{ fontWeight:800,fontSize:16,color:C.amber,margin:0 }}>{s.amount.toLocaleString('vi-VN')}₫</p>}
                  {s.payment_method && <span style={{ fontSize:11,color:C.gray }}>{s.payment_method === 'cod' ? '💵 COD' : '💳 Online'}</span>}
                </div>
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
                <div style={{ background:'#F8FAFC',borderRadius:9,padding:'10px 14px' }}>
                  <p style={{ fontSize:11,fontWeight:600,color:C.gray,marginBottom:4 }}>📦 LẤY TẠI</p>
                  <p style={{ fontSize:12,color:C.navy,margin:0 }}>{s.pickup_location || 'Chưa có địa chỉ'}</p>
                </div>
                <div style={{ background:C.tint,borderRadius:9,padding:'10px 14px' }}>
                  <p style={{ fontSize:11,fontWeight:600,color:C.amber,marginBottom:4 }}>📍 GIAO ĐẾN</p>
                  <p style={{ fontSize:12,color:C.navy,margin:0 }}>{s.delivery_location || 'Chưa có địa chỉ'}</p>
                </div>
              </div>

              {(s.recipient || s.phone) && (
                <p style={{ fontSize:13,color:C.gray,marginBottom:12 }}>
                  {s.recipient ? '👤 ' + s.recipient : ''}{s.recipient && s.phone ? ' · ' : ''}{s.phone ? '📞 ' + s.phone : ''}
                </p>
              )}

              <div style={{ display:'flex',gap:8 }}>
                <button onClick={() => setMapDelivery(s)}
                  style={{ padding:'9px 14px',background:'#EFF6FF',color:C.blue,border:'1px solid #BFDBFE',borderRadius:9,fontWeight:600,fontSize:13,cursor:'pointer' }}>
                  🗺️ Xem bản đồ
                </button>
                <button
                  disabled={claimingId === s.shipment_id}
                  onClick={() => handleClaim(s.shipment_id)}
                  style={{ flex:1,padding:'10px',background: claimingId === s.shipment_id ? '#D1FAE5' : C.success,color:'white',border:'none',borderRadius:9,fontWeight:700,fontSize:13,cursor: claimingId === s.shipment_id ? 'wait' : 'pointer' }}>
                  {claimingId === s.shipment_id ? '⏳ Đang nhận...' : '✅ Nhận đơn này'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Map Modal (non-transit) */}
      {mapDelivery && <MapModal delivery={mapDelivery} onClose={() => setMapDelivery(null)} />}

      {/* Confirm Pickup */}
      {confirmId && confirmType === 'pickup' && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={() => setConfirmId(null)}>
          <div style={{ background:'var(--bg-card)',borderRadius:16,padding:28,width:400 }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontWeight:800,fontSize:18,color:C.navy,marginBottom:12 }}>📦 Xác nhận đã lấy hàng</h3>
            <p style={{ fontSize:14,color:C.gray,marginBottom:12 }}>Bạn đã tới shop và nhận đơn hàng #{confirmId}?</p>
            <div style={{ background:'#EDE9FE',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:13,color:C.purple }}>
              Sau khi xác nhận, trạng thái đơn chuyển sang <strong>Đang giao</strong> và bản đồ sẽ hiển thị để bạn dễ điều hướng.
            </div>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setConfirmId(null)} style={{ flex:1,padding:10,background:'#F1F5F9',color:C.gray,border:'none',borderRadius:9,fontWeight:600,cursor:'pointer' }}>Hủy</button>
              <button onClick={() => handleAction(confirmId,'in_transit')} style={{ flex:2,padding:10,background:C.purple,color:'white',border:'none',borderRadius:9,fontWeight:700,cursor:'pointer' }}>🚚 Đã lấy hàng — Bắt đầu giao</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Deliver */}
      {confirmId && confirmType === 'deliver' && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={() => setConfirmId(null)}>
          <div style={{ background:'var(--bg-card)',borderRadius:16,padding:28,width:380 }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontWeight:800,fontSize:18,color:C.navy,marginBottom:12 }}>✅ Xác nhận giao thành công</h3>
            <p style={{ fontSize:14,color:C.gray,marginBottom:16 }}>Đã chụp ảnh người nhận và bàn giao đơn #{confirmId}?</p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setConfirmId(null)} style={{ flex:1,padding:10,background:'#F1F5F9',color:C.gray,border:'none',borderRadius:9,fontWeight:600,cursor:'pointer' }}>Hủy</button>
              <button onClick={() => handleAction(confirmId,'delivered')} style={{ flex:2,padding:10,background:C.success,color:'white',border:'none',borderRadius:9,fontWeight:700,cursor:'pointer' }}>🎉 Giao thành công!</button>
            </div>
          </div>
        </div>
      )}

      {/* Fail Modal */}
      {confirmId && confirmType === 'fail' && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={() => setConfirmId(null)}>
          <div style={{ background:'var(--bg-card)',borderRadius:16,padding:28,width:420 }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontWeight:800,fontSize:18,color:C.error,marginBottom:14 }}>✗ Báo giao hàng thất bại</h3>
            <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:12 }}>
              {QUICK_FAIL.map(r => (
                <button key={r} onClick={() => setFailReason(r)} style={{ padding:'9px 14px',background:failReason===r?'#FEE2E2':'#F8FAFC',border:'1px solid ' + (failReason===r?C.error:'#E2E8F0'),borderRadius:8,textAlign:'left',cursor:'pointer',fontSize:13,color:failReason===r?C.error:C.navy,fontWeight:failReason===r?600:400 }}>
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
