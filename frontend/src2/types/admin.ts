export interface ShopRegistration {
  reg_id: number
  user_id: number
  shop_name: string
  description?: string
  address: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
  created_at?: string
}

export interface ShipperRegistration {
  reg_id: number
  user_id: number
  vehicle_type?: string
  license_plate?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at?: string
}

export interface Dispute {
  dispute_id: number
  order_id: number
  initiated_party: 'user' | 'shop' | 'shipper'
  reason?: string
  status: 'open' | 'resolved' | 'escalated'
  created_at?: string
}

export interface AdminDashboard {
  total_users: number
  total_shops: number
  total_orders: number
  pending_shop_registrations: number
  pending_shipper_registrations: number
  open_disputes: number
}
