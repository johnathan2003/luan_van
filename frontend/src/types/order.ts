export type OrderStatus = 'pending' | 'confirmed' | 'ready_to_ship' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'returned'
export type PaymentMethod = 'momo' | 'cod' | 'vnpay'
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded'

export interface OrderItem {
  order_item_id: number
  product_id: number
  product_name?: string
  product_image?: string
  quantity: number
  price_at_order: string
}

export interface ShipperInfo {
  shipper_id: number
  name: string
  phone?: string
  vehicle_type?: string
  license_plate?: string
  rating: string
}

export interface Shipment {
  shipment_id: number
  status: string
  shipper_id?: number
  pickup_location?: string
  delivery_location?: string
  current_location?: { lat: number; lng: number }
  pickup_time?: string
  delivery_time?: string
}

export interface Order {
  order_id: number
  order_number?: string
  user_id: number
  shop_id?: number
  shop_name?: string
  shop_address?: string
  shipper_id?: number
  shipper_info?: ShipperInfo
  total_price: string
  discount: string
  final_price: string
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  order_status: OrderStatus
  shipping_address: string
  recipient_name?: string
  recipient_phone?: string
  note?: string
  created_at?: string
  items: OrderItem[]
  shipment?: Shipment
}

export interface CartItem {
  cart_id: number
  product_id: number
  product_name?: string
  product_image?: string
  price: string
  quantity: number
  shop_id?: number
  shop_name?: string
  stock_quantity?: number
}

export interface Cart {
  items: CartItem[]
  total: number
  item_count: number
}

export interface CheckoutData {
  items: { product_id: number; quantity: number }[]
  shipping_address: string
  recipient_name?: string
  recipient_phone?: string
  payment_method: PaymentMethod
  voucher_code?: string
  note?: string
}

