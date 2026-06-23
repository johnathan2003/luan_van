import type { Order } from '../types/order'

export interface TrackingEvent {
  key: number
  icon: string
  title: string
  desc: string
  time: string
  done: boolean
  current: boolean
}

// Thu tu day du cac moc hanh trinh (chi tiet hon order_status de mo phong "dang di den dau")
const FULL_STEPS = [
  { key: 0, icon: '🛒', title: 'Đặt hàng thành công', descFn: () => 'Đơn hàng đã được tiếp nhận vào hệ thống', offsetHour: 0 },
  { key: 1, icon: '✅', title: 'Người bán xác nhận đơn', descFn: () => 'Shop đã xác nhận và đang chuẩn bị hàng', offsetHour: 1 },
  { key: 2, icon: '📦', title: 'Đã đóng gói, chờ lấy hàng', descFn: () => 'Đơn hàng đã được đóng gói, chờ đơn vị vận chuyển đến lấy', offsetHour: 4 },
  { key: 3, icon: '🚚', title: 'Đơn vị vận chuyển đã lấy hàng', descFn: (city: string) => `Đã lấy hàng tại kho người bán, đang chuyển đến trung tâm phân loại ${city}`, offsetHour: 7 },
  { key: 4, icon: '🏭', title: 'Đến trung tâm phân loại', descFn: (city: string) => `Đơn hàng đang được phân loại tại trung tâm ${city}`, offsetHour: 18 },
  { key: 5, icon: '🛵', title: 'Shipper đang giao hàng', descFn: () => 'Đơn hàng đang trên đường giao đến địa chỉ của bạn', offsetHour: 28 },
  { key: 6, icon: '🏠', title: 'Giao hàng thành công', descFn: () => 'Đơn hàng đã được giao đến bạn', offsetHour: 34 },
  { key: 7, icon: '⭐', title: 'Hoàn thành', descFn: () => 'Đơn hàng đã hoàn thành, cảm ơn bạn đã mua sắm tại BuyZo', offsetHour: 46 },
]

const CITIES = ['TP.HCM', 'Bình Dương', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ']

const STATUS_TO_FULL_INDEX: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  ready_to_ship: 2,
  shipping: 5, // mac dinh, se duoc tinh chi tiet hon o duoi
  delivered: 6,
  completed: 7,
  cancelled: -1,
}

/**
 * Sinh ra hanh trinh van chuyen (mo phong) dua tren trang thai don hang hien tai.
 * Voi trang thai "shipping", dung order_id de gia lap vi tri hien tai (dang o buoc nao trong hanh trinh)
 * giup nhieu don hang khac nhau hien thi vi tri khac nhau khi test.
 */
export function buildTrackingTimeline(order: Order): TrackingEvent[] {
  if (order.order_status === 'cancelled') return []

  const baseTime = order.created_at ? new Date(order.created_at).getTime() : Date.now()
  const hour = 3600 * 1000
  const city = CITIES[order.order_id % CITIES.length]

  let currentIdx = STATUS_TO_FULL_INDEX[order.order_status] ?? 0
  if (order.order_status === 'shipping') {
    // gia lap dang o mot trong 3 chang giua hanh trinh van chuyen
    currentIdx = 3 + (order.order_id % 3)
  }

  return FULL_STEPS.map(step => ({
    key: step.key,
    icon: step.icon,
    title: step.title,
    desc: step.descFn(city),
    time: new Date(baseTime + step.offsetHour * hour).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    }),
    done: step.key <= currentIdx,
    current: step.key === currentIdx,
  }))
}
