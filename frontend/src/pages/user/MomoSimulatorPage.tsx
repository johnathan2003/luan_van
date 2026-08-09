import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { paymentService } from '../../services/paymentService'
import { formatCurrency, formatOrderId } from '../../utils/formatters'
import { getPaymentProviderConfig, type PaymentProvider } from '../../utils/paymentProviders'

// Trang "app giả lập" — mở ở TAB MỚI qua window.open() từ MomoQRPage.tsx khi
// bấm "Quét QR". Dùng chung cho Momo/VNPay/ZaloPay qua prop `provider`. Đây
// là mô phỏng UI, không phải app thật. Xem ke-hoach-demo-thanh-toan-momo.md —
// countdown lấy từ CÙNG API status với trang gốc nên luôn khớp giờ dù mở tab
// trễ vài giây.

type Status = 'loading' | 'pending' | 'success' | 'expired' | 'error'

interface Props { provider?: PaymentProvider }

const MomoSimulatorPage: React.FC<Props> = ({ provider }) => {
  const { orderId } = useParams<{ orderId: string }>()
  const cfg = getPaymentProviderConfig(provider)
  const [status, setStatus] = useState<Status>('loading')
  const [amount, setAmount] = useState(0)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await paymentService.getDemoPaymentStatus(orderId)
      const data = res.data
      setAmount(data.amount)
      setExpiresAt(new Date(data.expires_at).getTime())
      setStatus(prev => (prev === 'success' ? prev : data.status)) // không ghi đè lại sau khi đã confirm thành công ở tab này
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Không tải được thông tin thanh toán')
      setStatus('error')
    }
  }, [orderId])

  useEffect(() => {
    fetchStatus()
    pollRef.current = window.setInterval(fetchStatus, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStatus])

  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setRemainingMs(Math.max(0, expiresAt - Date.now()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const handleConfirm = async () => {
    if (!orderId || confirming) return
    setConfirming(true)
    try {
      await paymentService.confirmDemoPayment(orderId)
      if (pollRef.current) clearInterval(pollRef.current)
      setStatus('success')
      toast.success('Thanh toán thành công!')
      // Tự đóng tab sau khi người dùng kịp thấy animation — tab gốc phát hiện
      // qua polling status riêng của nó, không phụ thuộc vào việc tab này có
      // đóng được hay không (một số trình duyệt chặn window.close() nếu tab
      // không phải do script mở — vẫn an toàn vì tab gốc tự chuyển trang).
      setTimeout(() => window.close(), 1200)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Xác nhận thất bại')
      setStatus('expired')
      setConfirming(false)
    }
  }

  const handleCancel = () => window.close()

  const mm = Math.floor(remainingMs / 60000)
  const ss = Math.floor((remainingMs % 60000) / 1000)

  return (
    <div style={{ minHeight: '100vh', background: cfg.color, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: cfg.color }}>{cfg.name[0]}</div>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{cfg.name}</span>
      </div>

      <div style={{ flex: 1, background: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {status === 'loading' && <div className="spinner" style={{ margin: '60px auto' }} />}

        {status === 'pending' && (
          <>
            <p style={{ color: 'var(--gray-600)', fontSize: 14, marginBottom: 8 }}>Thanh toán cho ShopVN</p>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#1a1a1a', marginBottom: 6 }}>{formatCurrency(amount)}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 24 }}>
              Mã đơn hàng: {orderId ? formatOrderId(Number(orderId)) : ''}
            </div>

            <div style={{
              fontSize: 22, fontWeight: 800, marginBottom: 32,
              color: remainingMs < 15000 ? 'var(--error)' : cfg.color,
            }}>
              ⏱ {mm}:{String(ss).padStart(2, '0')}
            </div>

            <button
              onClick={handleConfirm}
              disabled={confirming}
              style={{
                width: '100%', maxWidth: 320, padding: '16px 24px', borderRadius: 12,
                background: cfg.color, color: '#fff', border: 'none', fontWeight: 800,
                fontSize: 17, cursor: confirming ? 'default' : 'pointer', opacity: confirming ? 0.7 : 1,
                marginBottom: 12,
              }}
            >
              {confirming ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
            </button>
            <button
              onClick={handleCancel}
              disabled={confirming}
              style={{
                width: '100%', maxWidth: 320, padding: '12px 24px', borderRadius: 12,
                background: 'transparent', color: 'var(--gray-600)', border: '1px solid var(--border-subtle)',
                fontWeight: 600, fontSize: 15, cursor: 'pointer',
              }}
            >
              Huỷ
            </button>
          </>
        )}

        {status === 'success' && (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
            <p style={{ fontWeight: 800, fontSize: 20 }}>Thanh toán thành công</p>
            <p style={{ color: 'var(--gray-600)', fontSize: 13, marginTop: 8 }}>Tab này sẽ tự đóng...</p>
          </div>
        )}

        {status === 'expired' && (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
            <p style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Mã đã hết hạn</p>
            {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 16 }}>{error}</p>}
            <button onClick={handleCancel} className="btn btn-outline btn-lg">Đóng</button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>❌</div>
            <p style={{ fontWeight: 700, marginBottom: 16 }}>{error || 'Có lỗi xảy ra'}</p>
            <button onClick={handleCancel} className="btn btn-outline btn-lg">Đóng</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MomoSimulatorPage
