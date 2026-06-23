// Luu danh gia shipper (nguoi giao hang) tam o localStorage - phuc vu demo/test, chua co backend thuc
export interface ShipperReview {
  orderId: number
  shipperId?: number
  rating: number
  comment: string
  isAnonymous?: boolean // true = an danh, false/undefined = cong khai (hien ten nguoi mua)
  createdAt: string
}

const KEY = 'buyzo_shipper_reviews_v1'

function readAll(): Record<number, ShipperReview> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(data: Record<number, ShipperReview>) {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

export function getShipperReview(orderId: number): ShipperReview | undefined {
  return readAll()[orderId]
}

export function saveShipperReview(review: ShipperReview) {
  const all = readAll()
  all[review.orderId] = review
  writeAll(all)
}
