/**
 * TrackOrderPage — Tra cứu đơn hàng công khai theo mã SD
 * Route: /track  (không cần đăng nhập)
 */
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import API from '../services/api'

const C = {
  navy: '#0F172A', gray: '#64748B', border: '#E2E8F0',
  teal: '#0F766E', success: '#16A34A', warning: '#D97706',
  error: '#DC2626', orange: '#EA580C',
}

const STATUS_STEPS = [
  { key: 'pending',                    label: 'Chờ xử lý',               icon: '📋' },
  { key: 'packed',                     label: 'Đã đóng gói',              icon: '📦' },
  { key: 'assigned_pickup',            label: 'Đang lấy hàng',            icon: '🛵' },
  { key: 'at_ward_warehouse',          label: 'Kho phường (HN)',          icon: '🏠' },
  { key: 'at_district_warehouse',      label: 'Kho quận (HN)',            icon: '🏬' },
  { key: 'at_hub_hanoi',               label: 'Kho tổng Hà Nội',         icon: '🏢' },
  { key: 'in_transit_interprovincial', label: 'Vận chuyển liên tỉnh',    icon: '🚚' },
  { key: 'at_hub_hcmc',               label: 'Kho tổng TP.HCM',          icon: '🏢' },
  { key: 'at_district_hcmc',          label: 'Kho quận TP.HCM',          icon: '🏬' },
  { key: 'at_ward_hcmc',              label: 'Kho phường TP.HCM',        icon: '🏠' },
  { key: 'out_for_delivery',           label: 'Shipper đang giao',        icon: '🛵' },
  { key: 'delivered',                  label: 'Đã giao thành công',       icon: '✅' },
]

const TrackOrderPage: React.FC = () => {
  const { code: urlCode }     = useParams<{ code?: string }>()
  const [code, setCode]       = useState(urlCode || '')
  const [result, setResult]   = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Auto-track if code is in URL
  useEffect(() => { if (urlCode) handleTrack() }, [urlCode])

  const handleTrack = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const r = await API.get(`/api/v1/warehouses/track/${trimmed}`)
      setResult(r.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Không tìm thấy đơn hàng với mã này')
    } finally {
      setLoading(false)
    }
  }

  // Tìm vị trí hiện tại trong chuỗi các bước
  const currentStepIndex = result
    ? STATUS_STEPS.findIndex(s => s.key === result.status)
    : -1
  const isFailed = result?.status === 'failed'

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F0FDFA 0%, #EFF6FF 100%)', padding: '40px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📦</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: C.navy, margin: 0 }}>Tra cứu đơn hàng</h1>
          <p style={{ fontSize: 14, color: C.gray, marginTop: 6 }}>Nhập mã vận đơn để xem tình trạng giao hàng</p>
        </div>

        {/* Search box */}
        <form onSubmit={handleTrack}>
          <div style={{ display: 'flex', gap: 10, background: '#fff', borderRadius: 14, padding: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="SD-20260722-084512"
              style={{
                flex: 1, padding: '12px 16px', border: 'none', outline: 'none',
                fontSize: 16, fontWeight: 700, letterSpacing: 0.5, color: C.navy,
                fontFamily: 'monospace', borderRadius: 8,
              }}
            />
            <button type="submit" disabled={loading || !code.trim()}
              style={{
                padding: '12px 24px', background: C.teal, color: '#fff', border: 'none',
                borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer',
                opacity: loading || !code.trim() ? 0.6 : 1, whiteSpace: 'nowrap',
              }}>
              {loading ? '...' : '🔍 Tra cứu'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 18px', color: C.error, fontWeight: 600, fontSize: 14 }}>
            ❌ {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

            {/* Status header */}
            <div style={{
              padding: '20px 24px',
              background: isFailed ? '#FEE2E2' : result.status === 'delivered' ? '#DCFCE7' : 'linear-gradient(135deg, #0F766E, #0D9488)',
              color: isFailed ? C.error : result.status === 'delivered' ? C.success : '#fff',
            }}>
              <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>MÃ VẬN ĐƠN</div>
              <div style={{ fontWeight: 900, fontSize: 22, fontFamily: 'monospace', letterSpacing: 1 }}>{result.delivery_code}</div>
              <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700 }}>
                {result.status === 'failed' ? '❌' : ''} {result.status_label}
              </div>
              {result.current_warehouse && (
                <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                  📍 Vị trí hiện tại: {result.current_warehouse}
                </div>
              )}
            </div>

            {/* Timeline */}
            {!isFailed && (
              <div style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Hành trình đơn hàng
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {STATUS_STEPS.map((step, idx) => {
                    const isDone    = idx <= currentStepIndex
                    const isCurrent = idx === currentStepIndex
                    const isLast    = idx === STATUS_STEPS.length - 1
                    return (
                      <div key={step.key} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        {/* Dot + line */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isCurrent ? C.teal : isDone ? '#CCFBF1' : '#F1F5F9',
                            border: isCurrent ? `2px solid ${C.teal}` : isDone ? `2px solid #0D9488` : `2px solid ${C.border}`,
                            fontSize: 12, flexShrink: 0,
                            boxShadow: isCurrent ? `0 0 0 4px rgba(15,118,110,0.15)` : 'none',
                          }}>
                            {isDone ? (isCurrent ? step.icon : '✓') : ''}
                          </div>
                          {!isLast && (
                            <div style={{ width: 2, flex: 1, minHeight: 16, background: isDone ? '#0D9488' : C.border, margin: '2px 0' }} />
                          )}
                        </div>
                        {/* Label */}
                        <div style={{ paddingBottom: isLast ? 0 : 14, paddingTop: 4 }}>
                          <div style={{
                            fontSize: 13,
                            fontWeight: isCurrent ? 800 : isDone ? 600 : 400,
                            color: isCurrent ? C.teal : isDone ? C.navy : '#CBD5E1',
                          }}>
                            {step.label}
                          </div>
                          {isCurrent && result.current_warehouse && (
                            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>📍 {result.current_warehouse}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Log history */}
            {result.logs && result.logs.length > 0 && (
              <div style={{ padding: '0 24px 20px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, margin: '16px 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Lịch sử cập nhật
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...result.logs].reverse().map((log: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: C.gray, whiteSpace: 'nowrap', paddingTop: 1, minWidth: 100 }}>
                        {log.time ? new Date(log.time).toLocaleString('vi-VN') : '—'}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{log.warehouse || 'Hệ thống'}</div>
                        {log.note && <div style={{ fontSize: 12, color: C.gray }}>{log.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed state */}
            {isFailed && (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
                <div style={{ fontWeight: 700, color: C.error, fontSize: 15 }}>Giao hàng thất bại</div>
                <div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>Shipper sẽ liên hệ lại hoặc hoàn hàng về shop</div>
              </div>
            )}
          </div>
        )}

        {/* Note */}
        <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
          Mã vận đơn có dạng <strong>SD-YYYYMMDD-xxxxxx</strong>, được cung cấp khi shop xác nhận đóng gói
        </p>
      </div>
    </div>
  )
}

export default TrackOrderPage
