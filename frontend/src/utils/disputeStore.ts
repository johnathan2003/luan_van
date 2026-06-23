// Luu khieu nai (dispute/complaint) tam o localStorage - phuc vu demo/test, chua co backend thuc
// Bao gom 4 chieu khieu nai: user->shop, user->shipper, shop->user, shop->shipper. Admin xem tat ca.
import type { Dispute, DisputeComplainantType, DisputeTargetType, DisputeStatus } from '../types/dispute'

const KEY = 'buyzo_disputes_v1'

function readAll(): Dispute[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(data: Dispute[]) {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

export function getAllDisputes(): Dispute[] {
  return readAll().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function getDisputesByComplainant(type: DisputeComplainantType, id: number): Dispute[] {
  return getAllDisputes().filter(d => d.complainant_type === type && d.complainant_id === id)
}

// Cac don khieu nai ma 1 doi tuong (shop/user/shipper) la BEN BI khieu nai toi (target)
export function getDisputesByTarget(type: DisputeTargetType, id: number): Dispute[] {
  return getAllDisputes().filter(d => d.target_type === type && d.target_id === id)
}

// Don hang nay co dang lien quan toi khieu nai nao khong (theo ca 2 chieu: gui di / bi gui toi)
export function getDisputesByOrder(orderId: number): Dispute[] {
  return getAllDisputes().filter(d => d.order_id === orderId)
}

export function getDispute(disputeId: number): Dispute | undefined {
  return readAll().find(d => d.dispute_id === disputeId)
}

export interface CreateDisputeInput {
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
  images: string[]
  videoName?: string
}

export function createDispute(input: CreateDisputeInput): Dispute {
  const all = readAll()
  const nextId = (all.reduce((max, d) => Math.max(max, d.dispute_id), 0) || 90000) + 1
  const dispute: Dispute = {
    dispute_id: nextId,
    order_id: input.order_id,
    order_code: input.order_code,
    complainant_type: input.complainant_type,
    complainant_id: input.complainant_id,
    complainant_name: input.complainant_name,
    target_type: input.target_type,
    target_id: input.target_id,
    target_name: input.target_name,
    reason_code: input.reason_code,
    reason_label: input.reason_label,
    content: input.content,
    evidence: { images: input.images || [], videoName: input.videoName },
    status: 'pending',
    created_at: new Date().toISOString(),
  }
  all.push(dispute)
  writeAll(all)
  return dispute
}

export function resolveDispute(disputeId: number, status: DisputeStatus, resolution_note?: string): Dispute | undefined {
  const all = readAll()
  const idx = all.findIndex(d => d.dispute_id === disputeId)
  if (idx === -1) return undefined
  all[idx] = { ...all[idx], status, resolution_note, resolved_at: new Date().toISOString() }
  writeAll(all)
  return all[idx]
}

// Co don khieu nai dang mo (pending/reviewing) cho don hang nay tu phia complainant nay chua?
export function hasOpenDispute(orderId: number, complainantType: DisputeComplainantType, complainantId: number): boolean {
  return readAll().some(d =>
    d.order_id === orderId &&
    d.complainant_type === complainantType &&
    d.complainant_id === complainantId &&
    (d.status === 'pending' || d.status === 'reviewing')
  )
}

// ── Du lieu khieu nai GIA (demo) - tu dong nap vao localStorage neu chua co gi ───────────
// De admin co du lieu xem ngay, dung 8 don khieu nai mau, du ca 4 chieu va 4 trang thai.
const img = (seed: string) => `https://picsum.photos/seed/${seed}/200/200`
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 3600 * 1000).toISOString()

const DEMO_DISPUTES: Dispute[] = [
  {
    dispute_id: 90001,
    order_id: 90008,
    complainant_type: 'user',
    complainant_id: 1,
    complainant_name: 'Trần Quốc Anh',
    target_type: 'shop',
    target_id: 3,
    target_name: 'Shop Điện Máy Xanh Tiện Ích',
    reason_code: 'fake_goods',
    reason_label: 'Hàng giả / hàng nhái',
    content: 'Bàn ủi nhận được không phải hàng chính hãng như mô tả trên sản phẩm, tem chống giả khác hoàn toàn so với hình shop đăng. Mong sàn kiểm tra và hỗ trợ hoàn tiền.',
    evidence: { images: [img('dispute1a'), img('dispute1b')], videoName: 'video_banui_sosanh.mp4' },
    status: 'pending',
    created_at: daysAgo(2),
  },
  {
    dispute_id: 90002,
    order_id: 90004,
    complainant_type: 'user',
    complainant_id: 1,
    complainant_name: 'Trần Quốc Anh',
    target_type: 'shipper',
    target_id: 7,
    target_name: 'Shipper #7 - Lê Văn Hoàng',
    reason_code: 'damaged',
    reason_label: 'Hàng bị móp/hỏng trong quá trình giao',
    content: 'Nồi chiên không dầu khi nhận bị móp một bên, vỏ ngoài trầy xước nhiều so với lúc đặt. Có khả năng shipper làm rơi trong lúc vận chuyển.',
    evidence: { images: [img('dispute2a'), img('dispute2b'), img('dispute2c')] },
    status: 'reviewing',
    created_at: daysAgo(4),
  },
  {
    dispute_id: 90003,
    order_id: 90005,
    complainant_type: 'user',
    complainant_id: 1,
    complainant_name: 'Trần Quốc Anh',
    target_type: 'shipper',
    target_id: 4,
    target_name: 'Shipper #4 - Phạm Minh Tuấn',
    reason_code: 'false_delivered',
    reason_label: 'Hệ thống xác nhận đã giao nhưng chưa nhận được hàng',
    content: 'Đơn hàng hiện trạng thái "đã giao" nhưng tôi chưa hề nhận được hàng hoặc cuộc gọi nào từ shipper. Đề nghị kiểm tra lại.',
    evidence: { images: [img('dispute3a')] },
    status: 'resolved',
    resolution_note: 'Đã xác minh với shipper, xác nhận giao nhầm địa chỉ. Đã hoàn tiền 100% cho khách và nhắc nhở shipper.',
    created_at: daysAgo(7),
    resolved_at: daysAgo(5),
  },
  {
    dispute_id: 90004,
    order_id: 90006,
    complainant_type: 'shop',
    complainant_id: 1,
    complainant_name: 'Shop Thời Trang Việt',
    target_type: 'user',
    target_id: 1,
    target_name: 'Trần Quốc Anh',
    reason_code: 'used_return',
    reason_label: 'Khách trả hàng trong tình trạng đã sử dụng',
    content: 'Khách yêu cầu trả hàng trong hạn 3 ngày nhưng mũ nhận lại đã có dấu hiệu đội/sử dụng, mồ hôi bám phần lót trong, không còn nguyên tem mác như lúc giao.',
    evidence: { images: [img('dispute4a'), img('dispute4b')], videoName: 'video_kiemtra_hangtra.mp4' },
    status: 'pending',
    created_at: daysAgo(1),
  },
  {
    dispute_id: 90005,
    order_id: 90007,
    complainant_type: 'shop',
    complainant_id: 2,
    complainant_name: 'Shop Phụ Kiện Công Nghệ',
    target_type: 'user',
    target_id: 1,
    target_name: 'Trần Quốc Anh',
    reason_code: 'order_bom',
    reason_label: 'Khách đặt hàng rồi "bom" hàng (không nhận hàng)',
    content: 'Khách đặt ví da nam thanh toán COD nhưng từ chối nhận hàng không lý do khi shipper giao tới, gây thiệt hại phí vận chuyển 2 chiều cho shop.',
    evidence: { images: [img('dispute5a')] },
    status: 'rejected',
    resolution_note: 'Qua xác minh, khách có lý do hợp lệ (đổi địa chỉ nhận hàng đột xuất, đã báo trước cho shipper). Không xử phạt khách lần này.',
    created_at: daysAgo(10),
    resolved_at: daysAgo(8),
  },
  {
    dispute_id: 90006,
    order_id: 90004,
    complainant_type: 'shop',
    complainant_id: 3,
    complainant_name: 'Shop Điện Máy Xanh Tiện Ích',
    target_type: 'shipper',
    target_id: 7,
    target_name: 'Shipper #7 - Lê Văn Hoàng',
    reason_code: 'harassment',
    reason_label: 'Shipper có hành vi hiềm khích / gây khó dễ với shop',
    content: 'Shipper liên tục trễ giờ lấy hàng đã hẹn, có lời lẽ thiếu tôn trọng với nhân viên shop qua điện thoại khi bị nhắc nhở.',
    evidence: { images: [], videoName: 'ghiam_cuocgoi.mp4' },
    status: 'reviewing',
    created_at: daysAgo(3),
  },
  {
    dispute_id: 90007,
    order_id: 90002,
    complainant_type: 'user',
    complainant_id: 1,
    complainant_name: 'Trần Quốc Anh',
    target_type: 'shipper',
    target_id: 4,
    target_name: 'Shipper #4 - Phạm Minh Tuấn',
    reason_code: 'unboxed',
    reason_label: 'Phát hiện hàng đã bị mở (unbox) trước khi giao',
    content: 'Hộp tai nghe khi nhận đã bị bóc seal, bên trong thiếu phụ kiện đi kèm (dây sạc) so với mô tả sản phẩm.',
    evidence: { images: [img('dispute7a'), img('dispute7b')] },
    status: 'resolved',
    resolution_note: 'Xác minh hộp hàng bị mở trong quá trình trung chuyển. Đã bồi thường phụ kiện thiếu và nhắc nhở đơn vị vận chuyển.',
    created_at: daysAgo(15),
    resolved_at: daysAgo(13),
  },
  {
    dispute_id: 90008,
    order_id: 90003,
    complainant_type: 'shop',
    complainant_id: 1,
    complainant_name: 'Shop Thời Trang Việt',
    target_type: 'user',
    target_id: 1,
    target_name: 'Trần Quốc Anh',
    reason_code: 'no_pay',
    reason_label: 'Khách nhận hàng nhưng không thanh toán (COD)',
    content: 'Khách đã nhận giày nhưng báo với shipper là "chuyển khoản sau" rồi không thanh toán, liên hệ lại không phản hồi.',
    evidence: { images: [img('dispute8a')] },
    status: 'pending',
    created_at: daysAgo(0.5),
  },
]

function seedDemoDisputesIfEmpty() {
  if (readAll().length > 0) return
  writeAll(DEMO_DISPUTES)
}

seedDemoDisputesIfEmpty()
