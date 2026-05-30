import API from './api'
import type { CheckoutData } from '../types/order'

export const orderService = {
  create: (data: CheckoutData) => API.post('/api/v1/orders', data),
  getMyOrders: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString()
    return API.get(`/api/v1/orders/me?${qs}`)
  },
  getById: (id: number) => API.get(`/api/v1/orders/${id}`),
  cancel: (id: number) => API.put(`/api/v1/orders/${id}/cancel`),
  confirm: (id: number) => API.post(`/api/v1/orders/${id}/confirm`),
  readyToShip: (id: number) => API.post(`/api/v1/orders/${id}/ready-to-ship`),
  confirmReceived: (id: number) => API.post(`/api/v1/orders/${id}/confirm-received`),
  track: (id: number) => API.get(`/api/v1/orders/${id}/tracking`),
}
