import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { paymentService } from '../../services/paymentService'
import { formatCurrency, formatOrderId } from '../../utils/formatters'
import { getPaymentProviderConfig, type PaymentProvider } from '../../utils/paymentProviders'

// Trang QR gốc — bước đầu của luồng demo thanh toán (giả lập, không gọi cổng
// thật). Dùng chung cho Momo/VNPay/ZaloPay, chỉ khác theme qua prop `provider`
// (xem utils/paymentProviders.ts). Xem ke-hoach-demo-thanh-toan-momo.md. Cả
// trang này lẫn PaymentSimulatorPage.tsx đều lấy amount/expires_at từ CÙNG 1
// nguồn server (GET /payments/demo/status/:orderId) nên 2 đồng hồ đếm ngược
// luôn khớp nhau dù mở tab giả lập trễ vài giây.

type Status = 'loading' | 'pending' | 'success' | 'expired' | 'failed'

interface Props { provider?: PaymentProvider }

const MomoQRPage: React.FC<Props> = ({ provider }) => {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const cfg = getPaymentProviderConfig(provider)
  const [status, setStatus] = useState<Status>('loading')
  const [amount, setAmount] = useState(0)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await paymentService.getDemoPaymentStatus(orderId)
      const data = res.data
      setAmount(data.amount)
      setExpiresAt(new Date(data.expires_at).getTime())
      setStatus(data.status)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Không tải được thông tin thanh toán')
      setStatus('failed')
    }
  }, [orderId])

  // Polling status mỗi 2s — nguồn sự thật duy nhất cho trạng thái + countdown
  useEffect(() => {
    fetchStatus()
    pollRef.current = window.setInterval(fetchStatus, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStatus])

  // Đồng hồ đếm ngược mm:ss, cập nhật mỗi giây từ expires_at của server
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setRemainingMs(Math.max(0, expiresAt - Date.now()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  // Thanh toán thành công (phát hiện qua polling) → sang trang kết quả dùng chung
  useEffect(() => {
    if (status === 'success' && orderId) {
      if (pollRef.current) clearInterval(pollRef.current)
      navigate(`/payment/result?demo=1&orderId=${orderId}`, { replace: true })
    }
  }, [status, orderId, navigate])

  const handleScan = () => {
    if (!orderId) return
    const win = window.open(`/${provider || 'momo'}-simulator/${orderId}`, '_blank')
    if (!win) {
      setError('Trình duyệt đang chặn cửa sổ mới (popup blocker) — vui lòng cho phép popup cho trang này rồi thử lại.')
    }
  }

  const handleRegenerate = async () => {
    if (!orderId) return
    setStatus('loading')
    setError(null)
    try {
      const res = await paymentService.regenerateDemoPayment(orderId)
      setAmount(res.data.amount)
      setExpiresAt(new Date(res.data.expires_at).getTime())
      setStatus(res.data.status)
      pollRef.current = window.setInterval(fetchStatus, 2000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Không tạo lại được mã QR')
      setStatus('expired')
    }
  }

  const mm = Math.floor(remainingMs / 60000)
  const ss = Math.floor((remainingMs % 60000) / 1000)
  const qrValue = `${cfg.qrScheme}?orderId=${orderId}&amount=${amount}`

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ color: cfg.color, fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{cfg.name}</div>
        <p style={{ color: 'var(--gray-600)', fontSize: 14, marginBottom: 20 }}>
          Quét mã để thanh toán đơn hàng {orderId ? formatOrderId(Number(orderId)) : ''}
        </p>

        {status === 'loading' && <div className="spinner" style={{ margin: '40px auto' }} />}

        {status === 'pending' && (
          <>
            <div style={{ display: 'inline-block', padding: 16, border: `2px solid ${cfg.color}`, borderRadius: 12, marginBottom: 16 }}>
              <QRCodeSVG value={qrValue} size={200} fgColor={cfg.color} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{formatCurrency(amount)}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 16 }}>
              Mã đơn hàng: {orderId ? formatOrderId(Number(orderId)) : ''}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: remainingMs < 15000 ? 'var(--error)' : cfg.color, marginBottom: 20 }}>
              ⏱ {mm}:{String(ss).padStart(2, '0')}
            </div>
            <button
              onClick={handleScan}
              className="btn btn-lg"
              style={{ width: '100%', background: cfg.color, color: '#fff', border: 'none', fontWeight: 700 }}
            >
              📱 Quét QR (mở app {cfg.name})
            </button>
            {error && <p style={{ color: 'var(--error)', fontSize: 13, marginTop: 12 }}>{error}</p>}
          </>
        )}

        {status === 'expired' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
            <p style={{ fontWeight: 700, marginBottom: 16 }}>Mã đã hết hạn</p>
            <button onClick={handleRegenerate} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              Tạo lại mã QR
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <p style={{ fontWeight: 700, marginBottom: 16 }}>{error || 'Có lỗi xảy ra'}</p>
            <Link to="/cart" className="btn btn-outline btn-lg">Quay lại giỏ hàng</Link>
          </>
        )}

        <p style={{ fontSize: 11, color: '#999', marginTop: 24 }}>
          * Mô phỏng luồng thanh toán {cfg.name} — phục vụ trình bày đồ án, không phải giao dịch thật.
        </p>
      </div>
    </div>
  )
}

export default MomoQRPage
