export interface Role {
  role_id: number
  role_name: string
  status: string
}

export interface User {
  user_id: number
  email: string
  full_name?: string
  phone?: string
  address?: string
  avatar_url?: string
  status: string
  roles: Role[]
  current_role?: string
}

export interface AuthState {
  user: User | null
  access_token: string | null
  refresh_token: string | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
}

export interface ShopRegistrationRequest {
  shop_name: string
  description?: string
  address: string
  phone?: string
  cmnd_url?: string
  business_reg_url?: string
}

export interface ShipperRegistrationRequest {
  vehicle_type: string
  license_plate?: string
  license_url?: string
}
