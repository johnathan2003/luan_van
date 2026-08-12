// Luu danh gia (review) tam o localStorage - phuc vu demo/test, chua co backend thuc
export interface OrderItemReview {
  orderItemId: number
  rating: number
  comment: string
  images?: string[]
  isAnonymous?: boolean // true = an danh, false/undefined = cong khai (hien ten nguoi mua)
  createdAt: string
}

const KEY = 'buyzo_reviews_v1'

function readAll(): Record<number, OrderItemReview> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(data: Record<number, OrderItemReview>) {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

export function getReview(orderItemId: number): OrderItemReview | undefined {
  return readAll()[orderItemId]
}

export function saveReview(review: OrderItemReview) {
  const all = readAll()
  all[review.orderItemId] = review
  writeAll(all)
}

export function getAllReviews(): Record<number, OrderItemReview> {
  return readAll()
}
