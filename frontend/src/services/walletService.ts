import API from './api'

// Ví tiền shop — hệ thống demo, không có tiền thật. Nạp tiền qua luồng giả
// lập thanh toán (WalletDepositQRPage + WalletDepositSimulatorPage, cùng
// pattern với MomoQRPage/MomoSimulatorPage bên checkout đơn hàng), tự động
// cộng thẳng vào ví — không qua admin duyệt.
export const walletService = {
  getWallet: () => API.get('/api/v1/wallet/me'),
  getTransactions: (params?: { page?: number; limit?: number; txn_type?: string }) =>
    API.get('/api/v1/wallet/transactions', { params }),

  // Nạp tiền demo — keyed theo txn_id (khác payments/*.ts vốn keyed theo order_id)
  startDeposit: (amount: number, note?: string) =>
    API.post('/api/v1/wallet/deposit/start', { amount, note }),
  getDepositStatus: (txnId: string | number) =>
    API.get(`/api/v1/wallet/deposit/status/${txnId}`),
  confirmDeposit: (txnId: string | number) =>
    API.post(`/api/v1/wallet/deposit/confirm/${txnId}`),
  regenerateDeposit: (txnId: string | number) =>
    API.post(`/api/v1/wallet/deposit/regenerate/${txnId}`),

  // Chuyển Khả dụng -> Tiền đấu giá — tức thời, tự động, không qua admin
  allocateAuction: (amount: number, note?: string) =>
    API.post('/api/v1/wallet/allocate-auction', { amount, note }),
}
