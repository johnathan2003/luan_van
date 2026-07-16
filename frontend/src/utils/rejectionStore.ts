/**
 * rejectionStore — lưu lý do từ chối + vi phạm admin đã đánh dấu
 * Keyed by product_id; shop đọc lại để hiển thị
 */
const KEY = 'buyzo_rejections_v1'

export interface RejectionRecord {
  product_id: number
  rejected_at: string
  reason: string
  violations: {
    label: string
    note: string
    imgMarkers?: { x: number; y: number }[]
    imageUrl?: string
  }[]
}

type Store = { [k: number]: RejectionRecord }
const load = (): Store => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Store } catch { return {} }
}

export const rejectionStore = {
  save(record: RejectionRecord) {
    const all = load()
    all[record.product_id] = record
    localStorage.setItem(KEY, JSON.stringify(all))
  },
  get(product_id: number): RejectionRecord | null {
    return load()[product_id] ?? null
  },
  clear(product_id: number) {
    const all = load()
    const next: Store = {}
    Object.keys(all).forEach(k => { if (Number(k) !== product_id) next[Number(k)] = all[Number(k)] })
    localStorage.setItem(KEY, JSON.stringify(next))
  },
}
