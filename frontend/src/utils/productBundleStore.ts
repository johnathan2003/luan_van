// ── Bundle / Promo / Attribute / Variant stores (localStorage) ──
// Fix: LRU eviction + strip image_urls + quota-safe writeAll

export interface BundleItem {
  id: string; name: string; price: number
  stock_quantity: number; image_urls: string[]; type: 'accessory' | 'gift'
  attrs?: LegacyAttr[]
}
export interface PromoRule {
  id: string; type: 'buy_get_free' | 'buy_pay_less'
  buy_qty: number; bonus_qty: number
}
/** Legacy attribute (no per-value pricing) – used for global attrs display */
export interface ProductAttribute {
  id: string; name: string; values: string[]
}
/** Legacy alias */
type LegacyAttr = ProductAttribute

// ── NEW: Variant system ──────────────────────────────────────────

export interface VariantAttrValue {
  label: string
  price_delta: number   // 0 = same as base price, positive = add to base
}
export interface VariantAttr {
  id: string
  name: string
  values: VariantAttrValue[]
}
export interface VariantLocal {
  id: string
  name: string          // e.g., "Phiên bản chính", "Màu đen", "Size L"
  price: number
  stock: number
  image_urls: string[]
  attrs: VariantAttr[]
  promos: PromoRule[]          // per-variant deals
  bundleItems?: BundleItem[]   // per-variant gifts/accessories
}

// ── Keys ─────────────────────────────────────────────────────────

const BUNDLE_KEY  = 'buyzo_product_bundles_v1'
const PROMO_KEY   = 'buyzo_product_promos_v1'
const ATTR_KEY    = 'buyzo_product_attrs_v1'
const VARIANT_KEY = 'buyzo_product_variants_v2'
const ORDER_KEY   = 'buyzo_store_order_v1'   // LRU order per store key

/** Giới hạn số sản phẩm lưu trong mỗi store key */
const MAX_PRODUCTS = 30

// ── LRU order tracker ─────────────────────────────────────────────

function readOrder(storeKey: string): string[] {
  try { return JSON.parse(localStorage.getItem(`${ORDER_KEY}_${storeKey}`) || '[]') } catch { return [] }
}
function writeOrder(storeKey: string, order: string[]) {
  try { localStorage.setItem(`${ORDER_KEY}_${storeKey}`, JSON.stringify(order)) } catch { /* ignore */ }
}
function touchOrder(storeKey: string, productId: string) {
  const order = readOrder(storeKey).filter(k => k !== productId)
  order.push(productId) // most recently used at end
  writeOrder(storeKey, order)
}
function evictOldest(storeKey: string, data: Record<string, any[]>): Record<string, any[]> {
  const order = readOrder(storeKey)
  // Remove products not in data from order
  const active = order.filter(k => k in data)
  while (active.length > MAX_PRODUCTS) {
    const oldest = active.shift()!
    delete data[oldest]
  }
  writeOrder(storeKey, active)
  return data
}

// ── Core read/write with quota handling ──────────────────────────

function readAll(key: string): Record<string, any[]> {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}

function writeAll(key: string, data: Record<string, any[]>) {
  // 1. Evict oldest entries to stay under MAX_PRODUCTS
  data = evictOldest(key, data)

  const json = JSON.stringify(data)
  try {
    localStorage.setItem(key, json)
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22 || String(e).includes('quota')) {
      // Quota hit: aggressively clear half the entries (oldest first)
      const order = readOrder(key)
      const half = Math.max(1, Math.floor(order.length / 2))
      const toRemove = order.splice(0, half)
      toRemove.forEach(k => delete data[k])
      writeOrder(key, order)
      try {
        localStorage.setItem(key, JSON.stringify(data))
      } catch {
        // Still failing: clear this store entirely
        localStorage.removeItem(key)
        console.warn(`[productBundleStore] Cleared "${key}" due to storage quota.`)
      }
    }
  }
}

// ── Strip image_urls from storage (không cần lưu, fetch lại từ server) ───────

function stripImages<T extends { image_urls?: string[] }>(items: T[]): T[] {
  return items.map(item => ({ ...item, image_urls: [] }))
}
function stripBundleImages(items: BundleItem[]): BundleItem[] {
  return items.map(b => ({ ...b, image_urls: [] }))
}
function stripVariantImages(variants: VariantLocal[]): VariantLocal[] {
  return variants.map(v => ({
    ...v,
    image_urls: [],
    bundleItems: v.bundleItems ? stripBundleImages(v.bundleItems) : undefined,
  }))
}

// ── Bundle store ──────────────────────────────────────────────────

export const bundleStore = {
  get(productId: number | string): BundleItem[] {
    const items = readAll(BUNDLE_KEY)[String(productId)] || []
    return items.map((b: any) => ({ type: 'accessory' as const, image_urls: b.image_url ? [b.image_url] : [], ...b, image_url: undefined }))
  },
  save(productId: number | string, items: BundleItem[]) {
    const pid = String(productId)
    const all = readAll(BUNDLE_KEY)
    all[pid] = stripBundleImages(items)
    touchOrder(BUNDLE_KEY, pid)
    writeAll(BUNDLE_KEY, all)
  },
  remove(productId: number | string) {
    const all = readAll(BUNDLE_KEY); delete all[String(productId)]; writeAll(BUNDLE_KEY, all)
  },
  migrate(tempKey: string, realId: number) {
    const all = readAll(BUNDLE_KEY)
    const existing = all[tempKey]
    if (existing) { all[String(realId)] = existing; delete all[tempKey]; writeAll(BUNDLE_KEY, all) }
  },
}

// ── Promo store (legacy global promos) ───────────────────────────

export const promoStore = {
  get(productId: number | string): PromoRule[] {
    return readAll(PROMO_KEY)[String(productId)] || []
  },
  save(productId: number | string, rules: PromoRule[]) {
    const pid = String(productId)
    const all = readAll(PROMO_KEY)
    all[pid] = rules
    touchOrder(PROMO_KEY, pid)
    writeAll(PROMO_KEY, all)
  },
  remove(productId: number | string) {
    const all = readAll(PROMO_KEY); delete all[String(productId)]; writeAll(PROMO_KEY, all)
  },
}

// ── Attribute store (legacy global attrs) ────────────────────────

export const attributeStore = {
  get(productId: number | string): ProductAttribute[] {
    return readAll(ATTR_KEY)[String(productId)] || []
  },
  save(productId: number | string, attrs: ProductAttribute[]) {
    const pid = String(productId)
    const all = readAll(ATTR_KEY)
    all[pid] = attrs
    touchOrder(ATTR_KEY, pid)
    writeAll(ATTR_KEY, all)
  },
  remove(productId: number | string) {
    const all = readAll(ATTR_KEY); delete all[String(productId)]; writeAll(ATTR_KEY, all)
  },
}

// ── Variant store (NEW) ───────────────────────────────────────────

export const variantStore = {
  get(productId: number | string): VariantLocal[] {
    return readAll(VARIANT_KEY)[String(productId)] || []
  },
  save(productId: number | string, variants: VariantLocal[]) {
    const pid = String(productId)
    const all = readAll(VARIANT_KEY)
    all[pid] = stripVariantImages(variants)
    touchOrder(VARIANT_KEY, pid)
    writeAll(VARIANT_KEY, all)
  },
  remove(productId: number | string) {
    const all = readAll(VARIANT_KEY); delete all[String(productId)]; writeAll(VARIANT_KEY, all)
  },
  migrate(tempKey: string, realId: number) {
    const all = readAll(VARIANT_KEY)
    const existing = all[tempKey]
    if (existing) { all[String(realId)] = existing; delete all[tempKey]; writeAll(VARIANT_KEY, all) }
  },
}

// ── Utility: clear toàn bộ store (dùng khi debug / logout) ───────

export function clearAllProductStores() {
  [BUNDLE_KEY, PROMO_KEY, ATTR_KEY, VARIANT_KEY].forEach(k => {
    localStorage.removeItem(k)
    localStorage.removeItem(`${ORDER_KEY}_${k}`)
  })
}
