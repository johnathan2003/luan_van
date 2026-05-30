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
    if (error.response?.status === 401 && !original._retry) {
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
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default API
