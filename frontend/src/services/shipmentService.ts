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

  // Bonuses
  getMyBonuses: (params: { page?: number; limit?: number; status?: string } = {}) =>
    API.get('/api/v1/shipments/shipper/me/bonuses', { params }),

  // Earnings
  getMyTransactions: (params: { page?: number; limit?: number; txn_type?: string } = {}) =>
    API.get('/api/v1/shipments/shipper/me/transactions', { params }),
  getMyMonthlyEarnings: (months = 6) =>
    API.get('/api/v1/shipments/shipper/me/earnings/monthly', { params: { months } }),
  getMyBalance: () => API.get('/api/v1/shipments/shipper/me/balance'),

  // Withdrawals
  getMyWithdrawals: (params: { page?: number; limit?: number } = {}) =>
    API.get('/api/v1/shipments/shipper/me/withdrawals', { params }),
  createWithdrawal: (data: { amount: number; bank_name: string; account_number: string; account_holder?: string }) =>
    API.post('/api/v1/shipments/shipper/me/withdrawals', data),

  // Incidents
  getMyIncidents: (params: { page?: number; limit?: number; is_violation?: boolean } = {}) =>
    API.get('/api/v1/shipments/shipper/me/incidents', { params }),
  createIncident: (data: { order_id?: number; type: string; title: string; description?: string }) =>
    API.post('/api/v1/shipments/shipper/me/incidents', data),
}
