import API from './api'

export const shopService = {
  getMyShop: () => API.get('/api/v1/shop/me'),
  updateShop: (data: any) => API.put('/api/v1/shop/me', data),
  getProducts: (params: any = {}) => API.get('/api/v1/shop/products', { params }),
  getOrders: (params: any = {}) => API.get('/api/v1/shop/orders', { params }),
  getAnalytics: (days = 30) => API.get(`/api/v1/shop/analytics?days=${days}`),
  // Employees
  getEmployees: () => API.get('/api/v1/shop/employees'),
  addEmployee: (data: any) => API.post('/api/v1/shop/employees', data),
  updateEmployeePermissions: (id: number, permissions: string[]) =>
    API.put(`/api/v1/shop/employees/${id}/permissions`, { permissions }),
  removeEmployee: (id: number) => API.delete(`/api/v1/shop/employees/${id}`),
  // Vouchers
  getVouchers: () => API.get('/api/v1/shop/vouchers'),
  createVoucher: (data: any) => API.post('/api/v1/shop/vouchers', data),
}
