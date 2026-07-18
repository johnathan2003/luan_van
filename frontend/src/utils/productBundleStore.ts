// ── Bundle / Promo / Attribute / Variant stores (localStorage) ──

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

function readAll(key: string): Record<string, any[]> {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}
function writeAll(key: string, data: Record<string, any[]>) {
  localStorage.setItem(key, JSON.stringify(data))
}

// ── Bundle store ──────────────────────────────────────────────────

export const bundleStore = {
  get(productId: number | string): BundleItem[] {
    const items = readAll(BUNDLE_KEY)[String(productId)] || []
    return items.map((b: any) => ({ type: 'accessory' as const, image_urls: b.image_url ? [b.image_url] : [], ...b, image_url: undefined }))
  },
  save(productId: number | string, items: BundleItem[]) {
    const all = readAll(BUNDLE_KEY); all[String(productId)] = items; writeAll(BUNDLE_KEY, all)
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
    const all = readAll(PROMO_KEY); all[String(productId)] = rules; writeAll(PROMO_KEY, all)
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
    const all = readAll(ATTR_KEY); all[String(productId)] = attrs; writeAll(ATTR_KEY, all)
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
    const all = readAll(VARIANT_KEY); all[String(productId)] = variants; writeAll(VARIANT_KEY, all)
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
