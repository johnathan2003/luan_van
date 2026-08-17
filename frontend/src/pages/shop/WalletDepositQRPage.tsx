import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { walletService } from '../../services/walletService'
import { formatCurrency } from '../../utils/formatters'
import { getPaymentProviderConfig, type PaymentProvider } from '../../utils/paymentProviders'

// Trang QR gốc cho nạp tiền vào ví shop — cùng pattern với MomoQRPage.tsx bên
// checkout đơn hàng (giả lập, không gọi cổng thanh toán thật), chỉ khác là
// keyed theo txn_id (giao dịch nạp ví) thay vì order_id. Trang này lẫn
// WalletDepositSimulatorPage.tsx đều lấy amount/expires_at từ CÙNG 1 nguồn
// server (GET /wallet/deposit/status/:txnId) nên đồng hồ đếm ngược luôn khớp.

type Status = 'loading' | 'pending' | 'success' | 'expired' | 'failed'

interface Props { provider?: PaymentProvider }

const WalletDepositQRPage: React.FC<Props> = ({ provider }) => {
  const { txnId } = useParams<{ txnId: string }>()
  const navigate = useNavigate()
  const cfg = getPaymentProviderConfig(provider)
  const [status, setStatus] = useState<Status>('loading')
  const [amount, setAmount] = useState(0)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!txnId) return
    try {
      const res = await walletService.getDepositStatus(txnId)
      const data = res.data
      setAmount(data.amount)
      setExpiresAt(new Date(data.expires_at).getTime())
      setStatus(data.status)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Không tải được thông tin giao dịch')
      setStatus('failed')
    }
  }, [txnId])

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

  // Nạp thành công (phát hiện qua polling) → quay lại ví, tiền đã tự cộng
  useEffect(() => {
    if (status === 'success') {
      if (pollRef.current) clearInterval(pollRef.current)
      const t = setTimeout(() => navigate('/shop/wallet?deposited=1', { replace: true }), 1500)
      return () => clearTimeout(t)
    }
  }, [status, navigate])

  const handleScan = () => {
    if (!txnId) return
    const win = window.open(`/wallet-deposit-simulator/${provider || 'momo'}/${txnId}`, '_blank')
    if (!win) {
      setError('Trình duyệt đang chặn cửa sổ mới (popup blocker) — vui lòng cho phép popup cho trang này rồi thử lại.')
    }
  }

  const handleRegenerate = async () => {
    if (!txnId) return
    setStatus('loading')
    setError(null)
    try {
      const res = await walletService.regenerateDeposit(txnId)
      setAmount(res.data.amount)
      setExpiresAt(new Date(res.data.expires_at).getTime())
      setStatus(res.data.status)
      pollRef.current = window.setInterval(fetchStatus, 2000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Không tạo lại được mã')
      setStatus('expired')
    }
  }

  const mm = Math.floor(remainingMs / 60000)
  const ss = Math.floor((remainingMs % 60000) / 1000)
  const qrValue = `${cfg.qrScheme}?wallet_txn=${txnId}&amount=${amount}`

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ color: cfg.color, fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{cfg.name}</div>
        <p style={{ color: 'var(--gray-600)', fontSize: 14, marginBottom: 20 }}>
          Quét mã để nạp tiền vào ví ShopVN
        </p>

        {status === 'loading' && <div className="spinner" style={{ margin: '40px auto' }} />}

        {status === 'pending' && (
          <>
            <div style={{ display: 'inline-block', padding: 16, border: `2px solid ${cfg.color}`, borderRadius: 12, marginBottom: 16 }}>
              <QRCodeSVG value={qrValue} size={200} fgColor={cfg.color} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{formatCurrency(amount)}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 16 }}>
              Giao dịch nạp ví #{txnId}
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

        {status === 'success' && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 800, fontSize: 18 }}>Nạp tiền thành công</p>
            <p style={{ color: 'var(--gray-600)', fontSize: 13, marginTop: 8 }}>{formatCurrency(amount)} đã được cộng vào ví — đang quay lại...</p>
          </div>
        )}

        {status === 'expired' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
            <p style={{ fontWeight: 700, marginBottom: 16 }}>Mã đã hết hạn</p>
            <button onClick={handleRegenerate} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              Tạo lại mã
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <p style={{ fontWeight: 700, marginBottom: 16 }}>{error || 'Có lỗi xảy ra'}</p>
            <Link to="/shop/wallet" className="btn btn-outline btn-lg">Quay lại ví</Link>
          </>
        )}

        <p style={{ fontSize: 11, color: '#999', marginTop: 24 }}>
          * Mô phỏng luồng nạp tiền {cfg.name} — phục vụ trình bày đồ án, không phải giao dịch thật.
        </p>
      </div>
    </div>
  )
}

export default WalletDepositQRPage
