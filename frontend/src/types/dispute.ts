// Kieu du lieu cho he thong khieu nai (dispute/complaint) - demo, luu localStorage
// 5 chieu khieu nai: user->shop, user->shipper, shop->user, shop->shipper (admin xu ly tat ca)

export type DisputeComplainantType = 'user' | 'shop'
export type DisputeTargetType = 'shop' | 'shipper' | 'user'
export type DisputeStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected'

export interface DisputeEvidence {
  images: string[]      // base64 data-url, chi de preview/demo, khong nen dung that voi anh lon
  videoName?: string     // ten file video nguoi dung chon - CHI hien thi ten, khong luu noi dung file
}

export interface Dispute {
  dispute_id: number
  order_id: number
  order_code?: string
  complainant_type: DisputeComplainantType
  complainant_id: number
  complainant_name: string
  target_type: DisputeTargetType
  target_id?: number
  target_name: string
  reason_code: string
  reason_label: string
  content: string
  evidence: DisputeEvidence
  status: DisputeStatus
  resolution_note?: string
  created_at: string
  resolved_at?: string
}

export interface DisputeReasonOption {
  code: string
  label: string
}

// Danh sach ly do theo tung chieu khieu nai "complainantType->targetType"
export const DISPUTE_REASONS: Record<string, DisputeReasonOption[]> = {
  'user->shop': [
    { code: 'fake_goods', label: 'Hàng giả / hàng nhái' },
    { code: 'wrong_desc', label: 'Hàng không đúng mô tả / chất lượng kém' },
    { code: 'other', label: 'Lý do khác' },
  ],
  'user->shipper': [
    { code: 'damaged', label: 'Hàng bị móp/hỏng trong quá trình giao' },
    { code: 'false_delivered', label: 'Hệ thống xác nhận đã giao nhưng chưa nhận được hàng' },
    { code: 'unboxed', label: 'Phát hiện hàng đã bị mở (unbox) trước khi giao' },
    { code: 'other', label: 'Lý do khác' },
  ],
  'shop->user': [
    { code: 'used_return', label: 'Khách trả hàng trong tình trạng đã sử dụng' },
    { code: 'repack_return', label: 'Khách đóng gói lại hàng đã dùng để trả như hàng mới' },
    { code: 'no_pay', label: 'Khách nhận hàng nhưng không thanh toán (COD)' },
    { code: 'order_bom', label: 'Khách đặt hàng rồi "bom" hàng (không nhận hàng)' },
    { code: 'other', label: 'Lý do khác' },
  ],
  'shop->shipper': [
    { code: 'harassment', label: 'Shipper có hành vi hiềm khích / gây khó dễ với shop' },
    { code: 'other', label: 'Lý do khác' },
  ],
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  pending: 'Chờ xử lý',
  reviewing: 'Đang xem xét',
  resolved: 'Đã giải quyết',
  rejected: 'Đã từ chối',
}

export const DISPUTE_STATUS_COLORS: Record<DisputeStatus, string> = {
  pending: '#f59e0b',
  reviewing: '#3b82f6',
  resolved: '#22c55e',
  rejected: '#ef4444',
}

export const DISPUTE_TARGET_LABELS: Record<DisputeTargetType, string> = {
  shop: 'Shop',
  shipper: 'Shipper',
  user: 'Người mua',
}
