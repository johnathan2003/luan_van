/**
 * productApprovalStore — cầu nối giữa admin duyệt sản phẩm và shop nhận kết quả
 * Admin ghi vào khi duyệt / từ chối → Shop đọc khi load danh sách sản phẩm
 */
const KEY = 'buyzo_product_status_overrides_v1'

type StatusOverride = {
  product_id: number
  status: 'approved' | 'rejected' | 'active'
  updated_at: string
  product_name?: string
  shop_id?: number
}

type Store = Record<number, StatusOverride>

const load = (): Store => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export const productApprovalStore = {
  /** Admin gọi khi duyệt sản phẩm */
  setApproved(product_id: number, product_name?: string, shop_id?: number) {
    const all = load()
    all[product_id] = { product_id, status: 'approved', updated_at: new Date().toISOString(), product_name, shop_id }
    localStorage.setItem(KEY, JSON.stringify(all))
    window.dispatchEvent(new Event('buyzo-product-status-changed'))
  },

  /** Admin gọi khi từ chối sản phẩm */
  setRejected(product_id: number) {
    const all = load()
    all[product_id] = { product_id, status: 'rejected', updated_at: new Date().toISOString() }
    localStorage.setItem(KEY, JSON.stringify(all))
    window.dispatchEvent(new Event('buyzo-product-status-changed'))
  },

  /** Shop gọi khi bấm "Đăng bán ngay" */
  setActive(product_id: number) {
    const all = load()
    if (all[product_id]) {
      all[product_id] = { ...all[product_id], status: 'active', updated_at: new Date().toISOString() }
      localStorage.setItem(KEY, JSON.stringify(all))
      window.dispatchEvent(new Event('buyzo-product-status-changed'))
    }
  },

  /** Lấy override status của 1 sản phẩm (null nếu không có) */
  getStatus(product_id: number): StatusOverride | null {
    return load()[product_id] ?? null
  },

  /** Lấy tất cả sản phẩm đang ở trạng thái 'approved' (chờ shop đăng bán) */
  getAllApproved(): StatusOverride[] {
    return Object.values(load()).filter(x => x.status === 'approved')
  },

  /** Áp dụng override lên danh sách sản phẩm */
  applyToProducts(products: any[]): any[] {
    const store = load()
    return products.map(p => {
      const override = store[p.product_id]
      if (override) return { ...p, status: override.status }
      return p
    })
  },
}
