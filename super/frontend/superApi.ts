/**
 * super/frontend/superApi.ts
 * --------------------------
 * Axios instance riêng cho superadmin.
 * Token lưu ở localStorage['super_token'] — tách biệt với token của hệ thống thường.
 */
import axios from 'axios'

/**
 * Mọi call qua superApi đều tự động prefix /api/super/...
 * Ví dụ: superApi.post('/auth/login') → POST /api/super/auth/login
 *
 * Upload ảnh dùng uploadFile() riêng vì endpoint /api/v1/products/upload-image
 * không thuộc prefix /api/super.
 */
const superApi = axios.create({ baseURL: '/api/super' })

superApi.interceptors.request.use(config => {
  const token = localStorage.getItem('super_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

superApi.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('super_token')
      window.location.href = '/super/login'
    }
    return Promise.reject(err)
  }
)

export default superApi

/**
 * Upload ảnh qua endpoint thường (không cần auth).
 * Trả về URL string của file đã upload.
 */
export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await axios.post('/api/v1/products/upload-image', fd)
  return res.data?.url || res.data
}
