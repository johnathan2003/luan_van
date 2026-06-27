import API from './api'

export const adminService = {
  getDashboard: () => API.get('/api/v1/admin/dashboard'),
  // Users
  getUsers: (params: any = {}) => API.get('/api/v1/admin/users', { params }),
  banUser: (id: number) => API.put(`/api/v1/admin/users/${id}/ban`),
  unbanUser: (id: number) => API.put(`/api/v1/admin/users/${id}/unban`),
  // Shop registrations
  getShopRegistrations: (status = 'pending') => API.get(`/api/v1/admin/shop-registrations?status=${status}`),
  approveShop: (id: number) => API.put(`/api/v1/admin/shop-registrations/${id}/approve`),
  rejectShop: (id: number, reason: string) => API.put(`/api/v1/admin/shop-registrations/${id}/reject`, { reason }),
  // Shipper registrations
  getShipperRegistrations: (status = 'pending') => API.get(`/api/v1/admin/shipper-registrations?status=${status}`),
  approveShipper: (id: number) => API.put(`/api/v1/admin/shipper-registrations/${id}/approve`),
  rejectShipper: (id: number, reason: string) => API.put(`/api/v1/admin/shipper-registrations/${id}/reject`, { reason }),
  // Products
  getAllProducts: (status?: string, search?: string, page = 1) => {
    const params = new URLSearchParams({ page: String(page) })
    if (status && status !== 'all') params.set('status', status)
    if (search) params.set('search', search)
    return API.get(`/api/v1/admin/products?${params}`)
  },
  updateProductImage: (id: number, imageUrls: string[]) =>
    API.patch(`/api/v1/admin/products/${id}/image`, { image_urls: imageUrls }),
  getPendingProducts: () => API.get('/api/v1/admin/products/pending'),
  approveProduct: (id: number) => API.put(`/api/v1/admin/products/${id}/approve`),
  rejectProduct: (id: number, reason: string) => API.put(`/api/v1/admin/products/${id}/reject`, { reason }),
  // Deletion requests
  getDeletionRequests: (status = 'pending') => API.get(`/api/v1/admin/deletion-requests?status=${status}`),
  // Disputes
  getDisputes: () => API.get('/api/v1/admin/disputes'),
  resolveDispute: (id: number, data: any) => API.put(`/api/v1/admin/disputes/${id}/resolve`, data),
  // System employees
  getSystemEmployees: () => API.get('/api/v1/admin/system-employees'),
  createSystemEmployee: (data: any) => API.post('/api/v1/admin/system-employees', data),
  // Logs
  getLogs: (page = 1) => API.get(`/api/v1/admin/logs?page=${page}`),
  // Mall requests
  getMallRequests: () => API.get('/api/v1/admin/mall-requests'),
  approveMall: (shopId: number) => API.put(`/api/v1/admin/mall-requests/${shopId}/approve`),
  rejectMall: (shopId: number) => API.put(`/api/v1/admin/mall-requests/${shopId}/reject`),
  // Orders
  getOrders: (params: { page?: number; limit?: number; order_status?: string; search?: string } = {}) =>
    API.get('/api/v1/admin/orders', { params }),
  // Vouchers
  getAllVouchers: (params: { page?: number; limit?: number; voucher_type?: string } = {}) =>
    API.get('/api/v1/admin/vouchers', { params }),
  // Banners
  getBanners: (status?: string) => API.get('/api/v1/admin/banners', { params: status ? { status } : {} }),
  createBanner: (data: any) => API.post('/api/v1/admin/banners', data),
  updateBanner: (id: number, data: any) => API.patch(`/api/v1/admin/banners/${id}`, data),
  deleteBanner: (id: number) => API.delete(`/api/v1/admin/banners/${id}`),
  // Feedbacks
  getFeedbacks: (params: { page?: number; limit?: number; status?: string; type?: string } = {}) =>
    API.get('/api/v1/admin/feedbacks', { params }),
  updateFeedback: (id: number, data: { status?: string; admin_note?: string }) =>
    API.patch(`/api/v1/admin/feedbacks/${id}`, data),
  // Finance
  getRevenueMonthly: (months = 6) => API.get('/api/v1/admin/finance/revenue-monthly', { params: { months } }),
  getFinanceTransactions: (params: { page?: number; limit?: number; type?: string } = {}) =>
    API.get('/api/v1/admin/finance/transactions', { params }),
  // Shipping zones
  getShippingZones: () => API.get('/api/v1/admin/shipping-zones'),
  createShippingZone: (data: any) => API.post('/api/v1/admin/shipping-zones', data),
  updateShippingZone: (id: number, data: any) => API.put(`/api/v1/admin/shipping-zones/${id}`, data),
  deleteShippingZone: (id: number) => API.delete(`/api/v1/admin/shipping-zones/${id}`),
  // Shipping methods
  getShippingMethods: () => API.get('/api/v1/admin/shipping-methods'),
  createShippingMethod: (data: any) => API.post('/api/v1/admin/shipping-methods', data),
  updateShippingMethod: (id: number, data: any) => API.put(`/api/v1/admin/shipping-methods/${id}`, data),
  deleteShippingMethod: (id: number) => API.delete(`/api/v1/admin/shipping-methods/${id}`),
  // Reports
  getReportUserGrowth: (months = 6) => API.get('/api/v1/admin/reports/user-growth', { params: { months } }),
  getReportTopProducts: (limit = 5) => API.get('/api/v1/admin/reports/top-products', { params: { limit } }),
  getReportOrderStatus: () => API.get('/api/v1/admin/reports/order-status'),
  getReportVoucherUsage: (limit = 10) => API.get('/api/v1/admin/reports/voucher-usage', { params: { limit } }),
  // Assign shipper
  assignShipperToOrder: (orderId: number, shipperId: number) =>
    API.post(`/api/v1/admin/orders/${orderId}/assign-shipper`, { shipper_id: shipperId }),
}
