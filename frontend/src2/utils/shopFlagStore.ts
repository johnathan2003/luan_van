/**
 * shopFlagStore — hệ thống cờ vi phạm cho shop
 * Admin thêm cờ khi từ chối sản phẩm.
 * Shop xem số cờ của mình.
 * 5 cờ = cảnh cáo nghiêm trọng | 10 cờ = tối đa (khoá shop)
 */
const KEY = 'buyzo_shop_flags_v1'

export interface ShopFlagRecord {
  shop_id: number
  total: number
  history: { added_at: string; count: number; reason: string; product_id?: number }[]
}

type Store = { [k: number]: ShopFlagRecord }

const load = (): Store => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Store } catch { return {} }
}

export const shopFlagStore = {
  get(shop_id: number): ShopFlagRecord {
    return load()[shop_id] ?? { shop_id, total: 0, history: [] }
  },

  addFlags(shop_id: number, count: number, reason: string, product_id?: number) {
    const all = load()
    const rec = all[shop_id] ?? { shop_id, total: 0, history: [] }
    rec.total = Math.min(10, rec.total + count)
    rec.history.unshift({ added_at: new Date().toISOString(), count, reason, product_id })
    all[shop_id] = rec
    localStorage.setItem(KEY, JSON.stringify(all))
    return rec
  },

  /** Level badge dựa vào tổng cờ */
  level(total: number): { label: string; color: string; bg: string; icon: string } {
    if (total === 0)  return { label: 'Bình thường', color: '#16A34A', bg: '#DCFCE7', icon: '✅' }
    if (total <= 2)   return { label: `${total} cờ`,  color: '#D97706', bg: '#FEF3C7', icon: '🚩' }
    if (total <= 4)   return { label: `${total} cờ`,  color: '#EA580C', bg: '#FFEDD5', icon: '🚩' }
    if (total <= 7)   return { label: `⚠️ ${total} cờ — Cảnh cáo`, color: '#DC2626', bg: '#FEE2E2', icon: '⚠️' }
    return              { label: `🔴 ${total} cờ — Nguy hiểm`,  color: '#991B1B', bg: '#FEF2F2', icon: '🔴' }
  },
}
