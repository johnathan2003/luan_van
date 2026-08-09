import API from './api'

export const paymentService = {
  createMomo: (order_id: number, amount: number) =>
    API.post('/api/v1/payments/momo/create', { order_id, amount }),
  createVNPay: (order_id: number, amount: number, order_desc?: string) =>
    API.post('/api/v1/payments/vnpay/create', { order_id, amount, order_desc }),
  createZaloPay: (order_id: number, amount: number, order_info?: string) =>
    API.post('/api/v1/payments/zalopay/create', { order_id, amount, order_info }),
  getHistory: () => API.get('/api/v1/payments/history'),
  // queryString: nguyên chuỗi window.location.search (bao gồm dấu "?") mà
  // VNPay/MoMo gắn vào khi redirect trình duyệt về — forward y nguyên để
  // backend tự verify chữ ký, KHÔNG tự suy luận thành công/thất bại ở FE.
  verifyVNPayReturn: (queryString: string) =>
    API.get(`/api/v1/payments/vnpay/return${queryString}`),
  verifyMomoReturn: (queryString: string) =>
    API.get(`/api/v1/payments/momo/return${queryString}`),
  // Demo (giả lập, không gọi cổng thật) — dùng chung cho Momo/VNPay/ZaloPay,
  // tự bật khi backend thiếu key merchant thật. Provider-agnostic: chỉ đọc/
  // ghi theo order_id, xem payment_service.py::is_momo_demo_mode() và tương tự.
  getDemoPaymentStatus: (orderId: string | number) =>
    API.get(`/api/v1/payments/demo/status/${orderId}`),
  confirmDemoPayment: (orderId: string | number) =>
    API.post(`/api/v1/payments/demo/confirm/${orderId}`),
  regenerateDemoPayment: (orderId: string | number) =>
    API.post(`/api/v1/payments/demo/regenerate/${orderId}`),
}
