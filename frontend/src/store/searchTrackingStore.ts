// ─── Search Tracking Store ────────────────────────────────────────────────────
// Lưu: lịch sử tìm kiếm + sản phẩm vừa xem (>= 4 giây, chưa mua)

const KEY_SEARCH  = 'bzSearch_history'
const KEY_VIEWED  = 'bzSearch_viewed'
const MAX_SEARCH  = 10
const MAX_VIEWED  = 20

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SearchHistoryItem {
  q: string       // từ khoá
  type: 'product' | 'shop' | 'keyword'
  ts: number      // timestamp
}

export interface ViewedProduct {
  product_id: number
  product_name: string
  price: string
  image_url: string | null
  shop_name?: string
  ts: number      // timestamp lần xem gần nhất
}

// ── Search history ─────────────────────────────────────────────────────────────
export function getSearchHistory(): SearchHistoryItem[] {
  try { return JSON.parse(localStorage.getItem(KEY_SEARCH) || '[]') } catch { return [] }
}

export function saveSearchTerm(q: string, type: SearchHistoryItem['type'] = 'keyword') {
  if (!q.trim()) return
  const list = getSearchHistory().filter(i => i.q.toLowerCase() !== q.toLowerCase().trim())
  list.unshift({ q: q.trim(), type, ts: Date.now() })
  localStorage.setItem(KEY_SEARCH, JSON.stringify(list.slice(0, MAX_SEARCH)))
}

export function removeSearchTerm(q: string) {
  const list = getSearchHistory().filter(i => i.q !== q)
  localStorage.setItem(KEY_SEARCH, JSON.stringify(list))
}

export function clearSearchHistory() {
  localStorage.removeItem(KEY_SEARCH)
}

// ── Recently viewed products ───────────────────────────────────────────────────
export function getRecentlyViewed(): ViewedProduct[] {
  try { return JSON.parse(localStorage.getItem(KEY_VIEWED) || '[]') } catch { return [] }
}

export function trackViewedProduct(p: Omit<ViewedProduct, 'ts'>) {
  const list = getRecentlyViewed().filter(i => i.product_id !== p.product_id)
  list.unshift({ ...p, ts: Date.now() })
  localStorage.setItem(KEY_VIEWED, JSON.stringify(list.slice(0, MAX_VIEWED)))
}

export function clearRecentlyViewed() {
  localStorage.removeItem(KEY_VIEWED)
}
