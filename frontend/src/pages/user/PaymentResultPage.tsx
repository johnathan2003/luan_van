import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { paymentService } from '../../services/paymentService'
import { spendXu, grantPostPurchaseGifts, type PostPurchaseGift } from '../../utils/eventsStore'
import { useAppDispatch } from '../../store/hooks'
import { clearCart } from '../../store/slices/cartSlice'

type Status = 'checking' | 'success' | 'failed'

interface PendingPayment {
  orderId: string
  xuToApply: number
  shopNames: string[]
}

const PaymentResultPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const [status, setStatus]     = useState<Status>('checking')
  const [orderId, setOrderId]   = useState<string | null>(null)
  const [postGifts, setPostGifts] = useState<PostPurchaseGift[]>([])
  const ran = useRef(false) // tránh chạy 2 lần (React StrictMode dev) → trừ xu/tặng quà trùng

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    // Đơn hàng chỉ thực sự "xong" (trừ xu, tặng quà hậu mãi, xoá giỏ hàng) một
    // lần duy nhất — dữ liệu này do CheckoutPage ghi vào sessionStorage trước
    // khi redirect sang cổng thanh toán. Xoá key ngay khi đọc để nếu người
    // dùng bấm reload trang kết quả này, không bị trừ/tặng lần thứ hai.
    const finalizeOrder = (oid: string) => {
      const key = `buyzo_pending_payment_${oid}`
      try {
        const raw = sessionStorage.getItem(key)
        if (!raw) return
        sessionStorage.removeItem(key)
        const pending: PendingPayment = JSON.parse(raw)
        if (pending.xuToApply > 0) spendXu(pending.xuToApply)
        if (pending.shopNames?.length) setPostGifts(grantPostPurchaseGifts(pending.shopNames))
        dispatch(clearCart())
      } catch {
        /* dữ liệu sessionStorage hỏng → bỏ qua, không chặn hiển thị kết quả */
      }
    }

    const run = async () => {
      const search = window.location.search // vd "?vnp_TxnRef=...&vnp_SecureHash=..."
      const params = new URLSearchParams(search)
      const isDemo  = params.get('demo') === '1'
      const isVNPay = !isDemo && (params.has('vnp_TxnRef') || params.has('vnp_ResponseCode'))
      const isMomo  = !isDemo && !isVNPay && (params.has('partnerCode') || params.has('orderId'))

      // Luồng demo MoMo giả lập: MomoQRPage.tsx điều hướng tới đây sau khi tự
      // polling phát hiện status="success" (đã được MomoSimulatorPage xác
      // nhận qua server) — không có chữ ký MoMo thật để verify, nên đọc lại
      // đúng trạng thái đó qua endpoint demo/status thay vì momo/return.
      if (isDemo) {
        const oid = params.get('orderId')
        if (!oid) { setStatus('failed'); return }
        try {
          const res = await paymentService.getDemoPaymentStatus(oid)
          setOrderId(oid)
          if (res.data?.status === 'success') {
            finalizeOrder(oid)
            setStatus('success')
          } else {
            setStatus('failed')
          }
        } catch {
          setStatus('failed')
        }
        return
      }

      if (!isVNPay && !isMomo) {
        setStatus('failed')
        return
      }

      try {
        // QUAN TRỌNG: không tự đọc resultCode/vnp_ResponseCode trên query string
        // ở trình duyệt để quyết định thành công hay thất bại — các tham số này
        // hoàn toàn có thể bị sửa tay trên thanh địa chỉ. Luôn để backend verify
        // chữ ký (HMAC) rồi mới tin kết quả.
        const res = isVNPay
          ? await paymentService.verifyVNPayReturn(search)
          : await paymentService.verifyMomoReturn(search)

        const data = res.data
        const success = data?.status === 'success'
        const oid = data?.order_id != null ? String(data.order_id) : null
        setOrderId(oid)

        if (success && oid) {
          finalizeOrder(oid)
          setStatus('success')
        } else {
          setStatus('failed')
        }
      } catch {
        setStatus('failed')
      }
    }

    run()
  }, [dispatch])

  return (
    <div className="page-wrapper">

      <div className="container" style={{ paddingTop: 60, paddingBottom: 60, textAlign: 'center' }}>
        {status === 'checking' ? (
          <div><div className="spinner" style={{ margin: '0 auto 20px' }} /><p>Đang xác nhận kết quả thanh toán...</p></div>
        ) : status === 'success' ? (
          <div>
            <div style={{ fontSize: 72, marginBottom: 20 }}>✅</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)', marginBottom: 12 }}>Thanh toán thành công!</h1>
            <p style={{ color: 'var(--gray-600)', marginBottom: 32, fontSize: 16 }}>Đơn hàng của bạn đã được xác nhận và đang được xử lý.</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: postGifts.length ? 32 : 0 }}>
              {orderId && <Link to={`/orders/${orderId}`} className="btn btn-primary btn-lg">Xem đơn hàng</Link>}
              <Link to="/" className="btn btn-outline btn-lg">Tiếp tục mua sắm</Link>
            </div>

            {postGifts.length > 0 && (
              <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>🎁 Quà tặng hậu mãi</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {postGifts.map((g, i) => (
                    <div key={i} style={{ fontSize: 13, padding: '8px 12px', border: '1px dashed var(--border-subtle)', borderRadius: 8 }}>
                      {g.voucher ? `🎟️ ${g.voucher.label} (${g.voucher.code})` : `🏪 ${g.shopName}: lần này chưa có quà, cảm ơn bạn!`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 72, marginBottom: 20 }}>❌</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--error)', marginBottom: 12 }}>Thanh toán thất bại</h1>
            <p style={{ color: 'var(--gray-600)', marginBottom: 32, fontSize: 16 }}>Giao dịch không thành công hoặc đã bị huỷ. Đơn hàng của bạn vẫn được giữ lại ở trạng thái chờ thanh toán.</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <Link to="/cart" className="btn btn-primary btn-lg">Thử lại</Link>
              <Link to="/orders" className="btn btn-outline btn-lg">Xem đơn hàng</Link>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

export default PaymentResultPage
