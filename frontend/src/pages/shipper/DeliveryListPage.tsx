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

const QUICK_FAIL = [
  'Không tìm được địa chỉ',
  'Khách không nghe máy',
  'Khách từ chối nhận hàng',
  'Địa chỉ không chính xác',
]

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

// ── Full-Screen Navigation Mode (Google Maps style) ──────────────────────────
const NavigationMode: React.FC<{
  delivery: any
  mode: 'pickup' | 'deliver'
  onConfirm: () => void
  onFail: (reason: string) => void
  onClose: () => void
}> = ({ delivery: d, mode, onConfirm, onFail, onClose }) => {
  const mapRef  = useRef<HTMLDivElement>(null)
  const mapInst = useRef<any>(null)
  const [showFail, setShowFail]   = useState(false)
  const [failReason, setFailReason] = useState('')

  const isPickup    = mode === 'pickup'
  const originAddr  = isPickup ? 'Vị trí của bạn' : (d.pickup_location || 'Shop')
  const destAddr    = isPickup ? (d.pickup_location || 'Shop') : (d.delivery_location || 'Địa chỉ khách')
  const destIcon    = isPickup ? '🏪' : '📍'
  const accentColor = isPickup ? C.purple : C.success
  const accentShadow = isPickup ? 'rgba(124,58,237,0.45)' : 'rgba(22,163,74,0.45)'

  useEffect(() => {
    const init = () => {
      const L = (window as any).L
      if (!L || !mapRef.current || mapInst.current) return
      const defLat = 10.7769, defLng = 106.7009
      const map = L.map(mapRef.current, { zoomControl: false }).setView([defLat, defLng], 14)
      mapInst.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)
      L.control.zoom({ position: 'topright' }).addTo(map)

      const bounds: [number, number][] = []
      const fromLL: [number, number] = [defLat + 0.02, defLng - 0.02]
      const toLL:   [number, number] = [defLat - 0.02, defLng + 0.02]

      // Current position — blue GPS dot
      L.marker(fromLL, {
        icon: L.divIcon({
          html: `<div style="position:relative;width:24px;height:24px">
            <div style="position:absolute;inset:0;background:rgba(29,78,216,0.2);border-radius:50%;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>
            <div style="position:absolute;inset:4px;background:#1D4ED8;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(29,78,216,0.5)"></div>
          </div>`,
          className: '', iconSize: [24, 24], iconAnchor: [12, 12],
        }),
      }).addTo(map).bindPopup(`<b>📍 Vị trí bạn</b><br/>${originAddr}`)
      bounds.push(fromLL)

      // Destination marker — big emoji pin
      L.marker(toLL, {
        icon: L.divIcon({
          html: `<div style="display:flex;flex-direction:column;align-items:center">
            <div style="font-size:46px;line-height:1;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.35))">${destIcon}</div>
            <div style="width:8px;height:8px;background:#1D4ED8;border-radius:50%;margin-top:2px"></div>
          </div>`,
          className: '', iconSize: [48, 58], iconAnchor: [24, 58],
        }),
      }).addTo(map).bindPopup(`<b>${isPickup ? '📦 Lấy hàng' : '🏠 Giao đến'}</b><br/>${destAddr}`)
      bounds.push(toLL)

      // Route line: white outline then blue — Google Maps style
      L.polyline([fromLL, toLL], { color: 'white',   weight: 13, opacity: 0.6, lineCap: 'round' }).addTo(map)
      L.polyline([fromLL, toLL], { color: '#1D4ED8', weight: 7,  opacity: 0.92, lineCap: 'round' }).addTo(map)

      // Midpoint arrow hint
      const midLat = (fromLL[0] + toLL[0]) / 2
      const midLng = (fromLL[1] + toLL[1]) / 2
      L.marker([midLat, midLng] as [number, number], {
        icon: L.divIcon({
          html: `<div style="background:#1D4ED8;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;box-shadow:0 2px 8px rgba(29,78,216,0.5)">➤</div>`,
          className: '', iconSize: [28, 28], iconAnchor: [14, 14],
        }),
      }).addTo(map)

      if (bounds.length > 1) map.fitBounds(bounds, { padding: [80, 80] })
    }
    loadLeaflet(init)
    return () => {
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#E8EFF8' }}>

      {/* ── Top status bar ─────────────────────────────────────────────── */}
      <div style={{ background: C.navy, color: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, boxShadow: '0 3px 16px rgba(0,0,0,0.3)' }}>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 42, height: 42, cursor: 'pointer', fontSize: 18, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          ✕
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, opacity: 0.65, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            {isPickup ? '📦 Đang đến lấy hàng tại shop' : '🏍️ Đang giao đến tay khách'}
          </p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>Đơn #{d.order_id}</p>
        </div>
        {d.amount != null && (
          <div style={{ background: C.amber, borderRadius: 12, padding: '8px 14px', textAlign: 'right', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              {d.payment_method === 'cod' ? '💵 THU HỘ' : '💳 ĐÃ THANH TOÁN'}
            </p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'white' }}>
              {d.amount.toLocaleString('vi-VN')}₫
            </p>
          </div>
        )}
      </div>

      {/* ── Route card ────────────────────────────────────────────────── */}
      <div style={{ background: 'white', padding: '14px 18px', flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
          {/* Dot-line-pin column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2, width: 20 }}>
            <div style={{ width: 14, height: 14, background: '#1D4ED8', borderRadius: '50%', border: '2.5px solid white', boxShadow: '0 0 0 2.5px #1D4ED8', flexShrink: 0 }} />
            <div style={{ width: 2, flex: 1, background: '#CBD5E1', margin: '5px 0', minHeight: 24 }} />
            <div style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{destIcon}</div>
          </div>

          {/* Address text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 2px', fontSize: 11, color: C.gray, fontWeight: 600 }}>XUẤT PHÁT</p>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {originAddr}
            </p>
            <p style={{ margin: '0 0 2px', fontSize: 11, color: C.gray, fontWeight: 600 }}>
              {isPickup ? 'LẤY HÀNG TẠI SHOP' : 'GIAO ĐẾN KHÁCH'}
            </p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: accentColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {destAddr}
            </p>
          </div>

          {/* Customer info */}
          {(d.recipient || d.phone) && (
            <div style={{ flexShrink: 0, textAlign: 'right', paddingLeft: 12, borderLeft: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {d.recipient && <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.navy }}>{d.recipient}</p>}
              {d.phone && (
                <a href={`tel:${d.phone}`} style={{ margin: 0, fontSize: 13, color: C.blue, fontWeight: 600, textDecoration: 'none' }}>
                  📞 {d.phone}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MAP — takes all remaining space ───────────────────────────── */}
      <div ref={mapRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />

      {/* ── Bottom action panel ───────────────────────────────────────── */}
      <div style={{ background: 'white', padding: '16px 18px 20px', flexShrink: 0, boxShadow: '0 -6px 30px rgba(0,0,0,0.14)' }}>
        {!showFail ? (
          <div style={{ display: 'flex', gap: 10 }}>
            {!isPickup && (
              <button onClick={() => { setShowFail(true); setFailReason('') }}
                style={{ padding: '14px 16px', background: '#FEE2E2', color: C.error, border: '1px solid #FECACA', borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 70 }}>
                <span style={{ fontSize: 20 }}>✗</span>
                <span style={{ fontSize: 11 }}>Thất bại</span>
              </button>
            )}
            <button onClick={onConfirm} style={{
              flex: 1, padding: '18px', background: accentColor, color: 'white',
              border: 'none', borderRadius: 14, fontWeight: 900, fontSize: 17, cursor: 'pointer',
              boxShadow: `0 8px 24px ${accentShadow}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 22 }}>{isPickup ? '📦' : '🎉'}</span>
              {isPickup ? 'Đã lấy hàng tại shop' : 'Đã giao cho khách'}
            </button>
          </div>
        ) : (
          /* ── Fail reason picker (inline in bottom panel) ── */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ margin: 0, fontWeight: 800, color: C.error, fontSize: 15 }}>✗ Không giao được vì...</p>
              <button onClick={() => setShowFail(false)}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: C.gray, fontWeight: 600 }}>
                Hủy
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 10 }}>
              {QUICK_FAIL.map(r => (
                <button key={r} onClick={() => setFailReason(r)}
                  style={{
                    padding: '9px 12px', borderRadius: 9, textAlign: 'left', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: failReason === r ? '#FEE2E2' : '#F8FAFC',
                    border: '1px solid ' + (failReason === r ? C.error : '#E2E8F0'),
                    color: failReason === r ? C.error : C.navy,
                  }}>
                  {failReason === r ? '✓ ' : ''}{r}
                </button>
              ))}
            </div>
            <textarea value={failReason} onChange={e => setFailReason(e.target.value)} rows={2}
              placeholder="Hoặc nhập lý do khác..."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 9, fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
            <button
              onClick={() => { if (failReason.trim()) { onFail(failReason) } }}
              disabled={!failReason.trim()}
              style={{ width: '100%', padding: '13px', background: failReason.trim() ? C.error : '#E2E8F0', color: failReason.trim() ? 'white' : C.gray, border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: failReason.trim() ? 'pointer' : 'default', boxShadow: failReason.trim() ? '0 4px 16px rgba(220,38,38,0.35)' : 'none' }}>
              Xác nhận không giao được
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Preview map modal (for available orders before claiming) ────────────────
const PreviewMapModal: React.FC<{ delivery: any; onClose: () => void }> = ({ delivery: d, onClose }) => {
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
      const bounds: [number, number][] = []
      const fromLL: [number, number] = [defLat + 0.01, defLng - 0.01]
      const toLL:   [number, number] = [defLat - 0.01, defLng + 0.01]
      L.marker(fromLL, { icon: L.divIcon({ html: '<div style="font-size:26px">🏪</div>', className: '', iconSize: [30, 30], iconAnchor: [15, 30] }) })
        .addTo(map).bindPopup('<b>📦 Lấy hàng tại shop</b><br/>' + (d.pickup_location ?? '')).openPopup()
      bounds.push(fromLL)
      L.marker(toLL, { icon: L.divIcon({ html: '<div style="font-size:26px">📍</div>', className: '', iconSize: [30, 30], iconAnchor: [15, 30] }) })
        .addTo(map).bindPopup('<b>🏠 Giao đến khách</b><br/>' + (d.delivery_location ?? ''))
      bounds.push(toLL)
      L.polyline(bounds, { color: C.blue, weight: 4, dashArray: '8 5', opacity: 0.8 }).addTo(map)
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [50, 50] })
    }
    loadLeaflet(init)
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null } }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 680, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <p style={{ fontWeight: 800, fontSize: 15, color: C.navy, margin: 0 }}>🗺️ Xem trước tuyến đường — Đơn #{d.order_id}</p>
          <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, color: C.gray }}>✕ Đóng</button>
        </div>
        <div ref={mapRef} style={{ height: 320, background: '#E5E7EB' }} />
        <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: '#EDE9FE', borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.purple, marginBottom: 4 }}>🏪 LẤY HÀNG TẠI</p>
            <p style={{ fontSize: 13, color: C.navy, margin: 0 }}>{d.pickup_location || 'Chưa có địa chỉ'}</p>
          </div>
          <div style={{ background: C.tint, borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.amber, marginBottom: 4 }}>📍 GIAO ĐẾN KHÁCH</p>
            <p style={{ fontSize: 13, color: C.navy, margin: 0 }}>{d.delivery_location || 'Chưa có địa chỉ'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const DeliveryListPage: React.FC = () => {
  const [tab, setTab]             = useState<'my' | 'available'>('my')
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [available, setAvailable] = useState<any[]>([])
  const [avLoading, setAvLoading] = useState(false)
  const [claimingId, setClaimingId] = useState<number | null>(null)
  const [previewDelivery, setPreviewDelivery] = useState<any | null>(null)
  const [navigationTarget, setNavigationTarget] = useState<{
    delivery: any; mode: 'pickup' | 'deliver'
  } | null>(null)
  // Will come from /api/v1/shipments/shipper/me/profile in real backend
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
    setDeliveries(ds => ds.map(d =>
      d.shipment_id === id ? { ...d, status: newStatus, fail_reason: reason } : d
    ))
    if (newStatus === 'in_transit') shipmentService.pickup(id).catch(() => {})
    if (newStatus === 'delivered')  shipmentService.delivered(id).catch(() => {})
  }

  const handleNavConfirm = () => {
    if (!navigationTarget) return
    const { delivery, mode } = navigationTarget
    handleAction(delivery.shipment_id, mode === 'pickup' ? 'in_transit' : 'delivered')
    setNavigationTarget(null)
  }

  const handleNavFail = (reason: string) => {
    if (!navigationTarget) return
    handleAction(navigationTarget.delivery.shipment_id, 'failed', reason)
    setNavigationTarget(null)
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
  const filtered = filter === 'all' ? deliveries
    : filter === 'in_transit'
      ? deliveries.filter(d => d.status === 'in_transit' || d.status === 'out_for_delivery')
      : deliveries.filter(d => d.status === filter)

  const stype = SHIPPER_TYPE[shipperType] ?? SHIPPER_TYPE.free

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.amber, margin: 0 }}>📦 Đơn giao hàng</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 3 }}>Nhấn nút bản đồ để bắt đầu dẫn đường</p>
        </div>
        <div style={{ background: stype.bg, borderRadius: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>{stype.icon}</span>
          <div>
            <p style={{ fontSize: 11, color: stype.color, fontWeight: 700, margin: 0 }}>LOẠI SHIPPER</p>
            <p style={{ fontSize: 14, color: stype.color, fontWeight: 800, margin: 0 }}>{stype.label}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        {(['my', 'available'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: '13px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            background: tab === k ? C.amber : 'transparent',
            color:      tab === k ? 'white' : C.gray,
          }}>
            {k === 'my' ? '📋 Đơn của tôi' : '🆕 Đơn chờ nhận'}
            {k === 'available' && available.length > 0 && (
              <span style={{ marginLeft: 6, background: C.error, color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
                {available.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Đơn của tôi ──────────────────────────────────────────── */}
      {tab === 'my' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            {[
              { key: 'assigned',   label: 'Cần lấy',   color: C.purple  },
              { key: 'pending',    label: 'Chờ lấy',   color: C.blue    },
              { key: 'in_transit', label: 'Đang giao', color: C.amber   },
              { key: 'delivered',  label: 'Đã giao',   color: C.success },
              { key: 'failed',     label: 'Thất bại',  color: C.error   },
            ].map(s => (
              <div key={s.key} onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
                style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '12px 14px', borderLeft: '3px solid ' + s.color, cursor: 'pointer', boxShadow: filter === s.key ? '0 0 0 2px ' + s.color : '0 1px 3px rgba(0,0,0,0.07)' }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: C.gray, textTransform: 'uppercase', margin: 0 }}>{s.label}</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: 0 }}>{counts[s.key]}</p>
              </div>
            ))}
          </div>

          {/* Delivery cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>
            ) : filtered.length === 0 ? (
              <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 40, textAlign: 'center', color: C.gray }}>
                Không có đơn nào
              </div>
            ) : filtered.map(d => {
              const st          = STATUS_STYLE[d.status] ?? STATUS_STYLE.pending
              const isActive    = d.status === 'in_transit' || d.status === 'out_for_delivery'
              const needsPickup = d.status === 'assigned' || d.status === 'pending'
              const isDone      = d.status === 'delivered' || d.status === 'failed' || d.status === 'at_warehouse'

              return (
                <div key={d.shipment_id} style={{
                  background: 'var(--bg-card)', borderRadius: 16, overflow: 'hidden',
                  boxShadow: isActive ? '0 6px 24px rgba(217,119,6,0.2)' : '0 1px 4px rgba(0,0,0,0.08)',
                  border: isActive    ? `2px solid ${C.amber}`
                        : needsPickup ? `2px solid ${C.purple}`
                        : '1px solid transparent',
                }}>
                  <div style={{ padding: '16px 18px 18px' }}>
                    {/* Order header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                          <p style={{ fontWeight: 800, fontSize: 16, color: C.navy, margin: 0 }}>Đơn #{d.order_id}</p>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                          {isActive && (
                            <span style={{ fontSize: 11, background: '#FEF3C7', color: C.amber, borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>
                              ● LIVE
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>
                          {d.created_at?.slice(0, 16)?.replace('T', ' ')}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {d.amount != null && (
                          <p style={{ fontWeight: 800, fontSize: 16, color: C.amber, margin: 0 }}>
                            {d.amount.toLocaleString('vi-VN')}₫
                          </p>
                        )}
                        {d.payment_method && (
                          <span style={{ fontSize: 11, color: C.gray }}>
                            {d.payment_method === 'cod' ? '💵 COD' : '💳 Online'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Address grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 14px' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 4 }}>📦 LẤY TẠI</p>
                        <p style={{ fontSize: 12, color: C.navy, margin: 0 }}>{d.pickup_location || '—'}</p>
                      </div>
                      <div style={{ background: C.tint, borderRadius: 10, padding: '10px 14px' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: C.amber, marginBottom: 4 }}>📍 GIAO ĐẾN</p>
                        <p style={{ fontSize: 12, color: C.navy, margin: 0 }}>{d.delivery_location || '—'}</p>
                      </div>
                    </div>

                    {(d.recipient || d.phone) && (
                      <p style={{ fontSize: 13, color: C.gray, marginBottom: 12 }}>
                        {d.recipient ? '👤 ' + d.recipient : ''}
                        {d.recipient && d.phone ? ' · ' : ''}
                        {d.phone ? '📞 ' + d.phone : ''}
                      </p>
                    )}

                    {/* ── Action buttons ──────────────────────────── */}
                    {needsPickup && (
                      <button
                        onClick={() => setNavigationTarget({ delivery: d, mode: 'pickup' })}
                        style={{
                          width: '100%', padding: '15px 20px',
                          background: `linear-gradient(135deg, ${C.purple}, #5B21B6)`,
                          color: 'white', border: 'none', borderRadius: 14,
                          fontWeight: 800, fontSize: 16, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                          boxShadow: '0 6px 18px rgba(124,58,237,0.4)',
                        }}>
                        <span style={{ fontSize: 22 }}>🗺️</span>
                        Bắt đầu lấy hàng
                        <span style={{ opacity: 0.7, fontSize: 14 }}>→</span>
                      </button>
                    )}

                    {isActive && (
                      <button
                        onClick={() => setNavigationTarget({ delivery: d, mode: 'deliver' })}
                        style={{
                          width: '100%', padding: '15px 20px',
                          background: `linear-gradient(135deg, ${C.amber}, #B45309)`,
                          color: 'white', border: 'none', borderRadius: 14,
                          fontWeight: 800, fontSize: 16, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                          boxShadow: '0 6px 18px rgba(217,119,6,0.4)',
                        }}>
                        <span style={{ fontSize: 22 }}>🗺️</span>
                        Tiếp tục giao hàng
                        <span style={{ opacity: 0.7, fontSize: 14 }}>→</span>
                      </button>
                    )}

                    {isDone && (
                      <div style={{
                        padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                        background: d.status === 'delivered'   ? '#DCFCE7'
                                  : d.status === 'at_warehouse'? '#CCFBF1'
                                  : '#FEE2E2',
                        color:      d.status === 'delivered'   ? C.success
                                  : d.status === 'at_warehouse'? C.teal
                                  : C.error,
                      }}>
                        {d.status === 'delivered'    && '✓ Đã giao thành công'}
                        {d.status === 'at_warehouse' && '🏭 Đã đến kho trung chuyển'}
                        {d.status === 'failed'       && ('✗ ' + (d.fail_reason || 'Không giao được'))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Đơn chờ nhận ─────────────────────────────────────────── */}
      {tab === 'available' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>Đơn hàng chưa có shipper — hãy nhận đơn gần bạn</p>
            <button onClick={loadAvailable} style={{ padding: '7px 14px', background: '#F1F5F9', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.gray, cursor: 'pointer' }}>
              🔄 Làm mới
            </button>
          </div>

          {avLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>
          ) : available.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 40, textAlign: 'center', color: C.gray }}>
              <p style={{ fontSize: 32, margin: 0 }}>📭</p>
              <p style={{ fontWeight: 600, marginTop: 8 }}>Chưa có đơn hàng mới</p>
              <p style={{ fontSize: 13 }}>Kiểm tra lại sau ít phút</p>
            </div>
          ) : available.map(s => (
            <div key={s.shipment_id} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid ' + C.success }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 16, color: C.navy, margin: 0 }}>Đơn #{s.order_id}</p>
                  <p style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{s.created_at?.slice(0, 16)?.replace('T', ' ')}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {s.amount != null && (
                    <p style={{ fontWeight: 800, fontSize: 16, color: C.amber, margin: 0 }}>
                      {s.amount.toLocaleString('vi-VN')}₫
                    </p>
                  )}
                  {s.payment_method && (
                    <span style={{ fontSize: 11, color: C.gray }}>
                      {s.payment_method === 'cod' ? '💵 COD' : '💳 Online'}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ background: '#F8FAFC', borderRadius: 9, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 4 }}>📦 LẤY TẠI</p>
                  <p style={{ fontSize: 12, color: C.navy, margin: 0 }}>{s.pickup_location || 'Chưa có địa chỉ'}</p>
                </div>
                <div style={{ background: C.tint, borderRadius: 9, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.amber, marginBottom: 4 }}>📍 GIAO ĐẾN</p>
                  <p style={{ fontSize: 12, color: C.navy, margin: 0 }}>{s.delivery_location || 'Chưa có địa chỉ'}</p>
                </div>
              </div>

              {(s.recipient || s.phone) && (
                <p style={{ fontSize: 13, color: C.gray, marginBottom: 12 }}>
                  {s.recipient ? '👤 ' + s.recipient : ''}
                  {s.recipient && s.phone ? ' · ' : ''}
                  {s.phone ? '📞 ' + s.phone : ''}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPreviewDelivery(s)}
                  style={{ padding: '10px 14px', background: '#EFF6FF', color: C.blue, border: '1px solid #BFDBFE', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  🗺️ Xem đường
                </button>
                <button
                  disabled={claimingId === s.shipment_id}
                  onClick={() => handleClaim(s.shipment_id)}
                  style={{ flex: 1, padding: '10px', background: claimingId === s.shipment_id ? '#D1FAE5' : C.success, color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: claimingId === s.shipment_id ? 'wait' : 'pointer' }}>
                  {claimingId === s.shipment_id ? '⏳ Đang nhận...' : '✅ Nhận đơn này'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview map modal */}
      {previewDelivery && (
        <PreviewMapModal delivery={previewDelivery} onClose={() => setPreviewDelivery(null)} />
      )}

      {/* Full-screen navigation overlay */}
      {navigationTarget && (
        <NavigationMode
          delivery={navigationTarget.delivery}
          mode={navigationTarget.mode}
          onConfirm={handleNavConfirm}
          onFail={handleNavFail}
          onClose={() => setNavigationTarget(null)}
        />
      )}
    </div>
  )
}

export default DeliveryListPage
