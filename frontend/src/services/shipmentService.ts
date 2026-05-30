import API from './api'

export const shipmentService = {
  getAvailableShippers: () => API.get('/api/v1/shipments/available'),
  getShipment: (id: number) => API.get(`/api/v1/shipments/${id}`),
  accept: (id: number) => API.post(`/api/v1/shipments/${id}/accept`),
  reject: (id: number, reason: string) => API.post(`/api/v1/shipments/${id}/reject`, { reason }),
  pickup: (id: number) => API.post(`/api/v1/shipments/${id}/pickup`),
  delivered: (id: number) => API.post(`/api/v1/shipments/${id}/delivered`),
  updateLocation: (id: number, lat: number, lng: number) =>
    API.post(`/api/v1/shipments/${id}/update-location`, { lat, lng }),
  getMyDeliveries: (params: any = {}) => API.get('/api/v1/shipments/shipper/me/deliveries', { params }),
  updateStatus: (status: string) => API.put('/api/v1/shipments/shipper/me/status', { status }),
  getMyRating: () => API.get('/api/v1/shipments/shipper/me/rating'),
}
