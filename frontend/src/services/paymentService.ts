import API from './api'

export const paymentService = {
  createMomo: (order_id: number, amount: number) =>
    API.post('/api/v1/payments/momo/create', { order_id, amount }),
  createVNPay: (order_id: number, amount: number, order_desc?: string) =>
    API.post('/api/v1/payments/vnpay/create', { order_id, amount, order_desc }),
  getHistory: () => API.get('/api/v1/payments/history'),
}
