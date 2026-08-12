export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  PROFILE: '/profile',
  PRODUCTS: '/products',
  CART: '/cart',
  CHECKOUT: '/checkout',
  ORDERS: '/orders',
  SHOP: '/shop',
  ADMIN: '/admin',
  SHIPPER: '/shipper',
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  ready_to_ship: 'Sẵn sàng giao',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  returned: 'Khiếu nại',
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  ready_to_ship: '#8b5cf6',
  shipping: '#06b6d4',
  delivered: '#10b981',
  completed: '#22c55e',
  cancelled: '#ef4444',
  returned: '#dc2626',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'Thanh toán khi nhận hàng',
  momo: 'Ví MoMo',
  vnpay: 'VNPay',
}

export const ROLE_LABELS: Record<string, string> = {
  user: 'Người dùng',
  shop: 'Chủ shop',
  shipper: 'Shipper',
  admin: 'Quản trị viên',
  employee: 'Nhân viên',
}

export const PERMISSIONS = [
  { code: 'product:create', label: 'Tạo sản phẩm' },
  { code: 'product:update', label: 'Sửa sản phẩm' },
  { code: 'product:delete', label: 'Xóa sản phẩm' },
  { code: 'order:confirm', label: 'Xác nhận đơn hàng' },
  { code: 'order:read', label: 'Xem đơn hàng' },
  { code: 'order:cancel', label: 'Hủy đơn hàng' },
  { code: 'message:read', label: 'Đọc tin nhắn' },
  { code: 'message:send', label: 'Gửi tin nhắn' },
  { code: 'shop:analytics', label: 'Xem thống kê' },
]

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
  { value: 'rating', label: 'Đánh giá cao' },
]
