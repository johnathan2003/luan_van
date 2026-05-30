import API from './api'

export const userService = {
  getMe: () => API.get('/api/v1/users/me'),
  updateMe: (data: any) => API.put('/api/v1/users/me', data),
  changePassword: (data: any) => API.put('/api/v1/users/me/password', data),
  switchRole: (role: string) => API.put('/api/v1/users/me/current-role', { role }),
  getRoles: () => API.get('/api/v1/users/me/roles'),
  uploadAvatar: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return API.post('/api/v1/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  registerShop: (data: any) => API.post('/api/v1/users/register-shop', data),
  getShopRegistration: () => API.get('/api/v1/users/me/shop-registration'),
  registerShipper: (data: any) => API.post('/api/v1/users/register-shipper', data),
  getShipperRegistration: () => API.get('/api/v1/users/me/shipper-registration'),
  getUserById: (id: number) => API.get(`/api/v1/users/${id}`),
}
