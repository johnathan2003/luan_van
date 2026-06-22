import API from './api'

export const voucherService = {
  getPlatformVouchers: () => API.get('/api/v1/vouchers/platform'),
  getShopVouchers: () => API.get('/api/v1/vouchers/shop'),
  getMyVouchers: () => API.get('/api/v1/vouchers/my'),
  collectVoucher: (voucherId: number) => API.post(`/api/v1/vouchers/${voucherId}/collect`),
}
