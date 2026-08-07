// Axios instance riêng cho chatbot service (tách khỏi backend chính, xem
// ../../chatbot và docker-compose.yml). Cùng cơ chế gắn/làm mới token với
// services/api.ts vì chatbot dùng chung JWT (SECRET_KEY) với backend —
// người dùng đăng nhập 1 lần, token dùng được cho cả 2 service.
import axios from 'axios'
import { getToken, getRefreshToken, setToken, setRefreshToken, removeToken } from '../utils/localStorage'

const CHATBOT_API = axios.create({
  baseURL: import.meta.env.VITE_CHATBOT_URL || 'http://localhost:8002',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // Gemini có thể trả lời chậm hơn API thường
})

CHATBOT_API.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

CHATBOT_API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    // Refresh-token vẫn gọi qua backend chính (nơi giữ logic auth), không
    // phải chatbot — chatbot chỉ verify token, không cấp/làm mới token.
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
          return CHATBOT_API(original)
        } catch {
          removeToken()
          if (window.location.pathname !== '/login') window.location.href = '/login'
        }
      } else if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default CHATBOT_API
