export interface ApiResponse<T = any> {
  message?: string
  data?: T
  detail?: string
}

export interface PaginatedResponse<T> {
  items?: T[]
  total: number
  page: number
  pages: number
}

export interface ApiError {
  detail: string
  errors?: { field: string; message: string }[]
}
