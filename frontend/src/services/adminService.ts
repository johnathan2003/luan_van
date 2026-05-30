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
}
