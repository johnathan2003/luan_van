import axios from 'axios'
import { getToken, getRefreshToken, setToken, setRefreshToken, removeToken } from '../utils/localStorage'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Request interceptor – attach token
API.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor – auto refresh token
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    // 401 = token hết hạn/không hợp lệ (có gửi nhưng sai).
    // 403 với detail "Not authenticated" = FastAPI HTTPBearer báo KHÔNG có
    // Authorization header nào cả (token đã bị xoá khỏi localStorage, ví dụ
    // do checkAuth() thất bại trước đó). Nếu không xử lý case này, mọi
    // request sau đó cứ 403 lặp lại mãi mà không bao giờ thử refresh hay
    // đưa người dùng về lại trang login — y hệt lỗi "⚠️ Not authenticated"
    // treo mãi trên chatbot.
    const isAuthError =
      error.response?.status === 401 ||
      (error.response?.status === 403 && error.response?.data?.detail === 'Not authenticated')
    if (isAuthError && !original._retry) {
      original._retry = true
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        try {
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/auth/refresh-token`,
            { refresh_token: refreshToken }
          )
          setToken(res.data.access_token)
          setRefreshToken(res.data.refresh_token)
          original.headers.Authorization = `Bearer ${res.data.access_token}`
          return API(original)
        } catch {
          removeToken()
          if (window.location.pathname !== '/login') window.location.href = '/login'
        }
      } else if (window.location.pathname !== '/login') {
        // Không có refresh_token để thử lại → đưa về login. Chỉ redirect khi
        // CHƯA ở trang login, tránh vòng lặp reload liên tục (App mount lại →
        // checkAuth chạy lại → 403 → redirect → App mount lại → ...).
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default API
