import API from './api'
import type { ProductCreate, ProductUpdate, ProductFilters } from '../types/product'

export const productService = {
  getAll: (filters: ProductFilters = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null) params.set(k, String(v)) })
    return API.get(`/api/v1/products?${params}`)
  },
  getById: (id: number) => API.get(`/api/v1/products/${id}`),
  create: (data: ProductCreate) => API.post('/api/v1/products', data),
  update: (id: number, data: ProductUpdate) => API.put(`/api/v1/products/${id}`, data),
  delete: (id: number) => API.delete(`/api/v1/products/${id}`),
  requestDeletion: (id: number, reason: string) => API.post(`/api/v1/products/${id}/deletion-request`, { reason }),
  getCategories: () => API.get('/api/v1/products/categories'),
  createCategory: (data: any) => API.post('/api/v1/products/categories', data),
  uploadImage: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return API.post('/api/v1/products/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
