export interface Shop {
  shop_id: number
  shop_name: string
  description?: string
  avatar_url?: string
  address: string
  phone?: string
  rating: string
  total_followers: number
  total_orders: number
  verification_status: 'pending' | 'approved' | 'rejected'
}

export interface Employee {
  employee_id: number
  user_id: number
  employee_name?: string
  position?: string
  status: string
  permissions: string[]
}

export interface Voucher {
  voucher_id: number
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: string
  min_order_value?: string
  max_uses?: number
  current_uses: number
  status: 'active' | 'inactive' | 'expired'
  valid_from?: string
  valid_to?: string
}

export interface Analytics {
  total_revenue: number
  total_orders: number
  total_products: number
  top_products: { product_id: number; product_name: string; sales: number }[]
  order_status_counts: Record<string, number>
}
