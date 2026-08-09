// Cấu hình hiển thị dùng chung cho luồng demo thanh toán (MomoQRPage,
// MomoSimulatorPage) — 1 cặp trang giả lập tái dùng cho cả 3 cổng, chỉ đổi
// màu/tên/prefix QR theo provider. Thêm cổng mới chỉ cần thêm 1 dòng ở đây.
export type PaymentProvider = 'momo' | 'vnpay' | 'zalopay'

export interface PaymentProviderConfig {
  name: string
  color: string
  qrScheme: string
  merchantLabel: string
}

export const PAYMENT_PROVIDERS: Record<PaymentProvider, PaymentProviderConfig> = {
  momo: {
    name: 'MoMo',
    color: '#A50064',
    qrScheme: 'momo://pay',
    merchantLabel: 'Ví MoMo',
  },
  vnpay: {
    name: 'VNPay',
    color: '#005BAA',
    qrScheme: 'vnpay://pay',
    merchantLabel: 'VNPay',
  },
  zalopay: {
    name: 'ZaloPay',
    color: '#0068FF',
    qrScheme: 'zalopay://pay',
    merchantLabel: 'ZaloPay',
  },
}

export function getPaymentProviderConfig(provider?: string): PaymentProviderConfig {
  return PAYMENT_PROVIDERS[(provider as PaymentProvider) || 'momo'] || PAYMENT_PROVIDERS.momo
}
