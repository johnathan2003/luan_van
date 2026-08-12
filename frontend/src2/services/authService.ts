import API from './api'
import type { LoginRequest, RegisterRequest } from '../types/user'

export const authService = {
  login: (data: LoginRequest) => API.post('/api/v1/auth/login', data),
  register: (data: RegisterRequest) => API.post('/api/v1/auth/register', data),
  logout: () => API.post('/api/v1/auth/logout'),
  refreshToken: (refresh_token: string) => API.post('/api/v1/auth/refresh-token', { refresh_token }),
  forgotPassword: (email: string) => API.post('/api/v1/auth/forgot-password', { email }),
  resetPassword: (token: string, new_password: string) => API.post('/api/v1/auth/reset-password', { token, new_password }),
}
