export interface VoucherLite {
  voucher_id: number
  code: string
  discount_type: string
  discount_value: string
  min_order_value: string | null
  max_discount: string | null
  max_uses: number | null
  current_uses: number
  status: string
  valid_to: string | null
  source: 'platform' | 'shop'
  shop_name: string | null
}
