import API from './api'

export const warehouseService = {
  // Public / all roles
  listWarehouses: () => API.get('/api/v1/warehouses'),

  // Admin
  createWarehouse: (data: { name: string; province: string; address?: string; lat?: number; lng?: number }) =>
    API.post('/api/v1/warehouses', data),
  updateWarehouse: (id: number, data: object) => API.put(`/api/v1/warehouses/${id}`, data),
  assignManager: (warehouseId: number, userId: number) =>
    API.post(`/api/v1/warehouses/${warehouseId}/assign-manager`, { user_id: userId }),

  // Warehouse Manager
  getDashboard: () => API.get('/api/v1/warehouses/manager/dashboard'),
  getAllShipments: (params: { page?: number; limit?: number; shipment_status?: string; shipment_type?: string } = {}) =>
    API.get('/api/v1/warehouses/manager/all-shipments', { params }),
  getIncoming: (params: { page?: number; limit?: number } = {}) =>
    API.get('/api/v1/warehouses/manager/incoming', { params }),
  markArrived: (shipmentId: number) =>
    API.post(`/api/v1/warehouses/manager/shipments/${shipmentId}/mark-arrived`),
}
