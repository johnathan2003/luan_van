/**
 * notificationStore — mock thông báo nội bộ lưu localStorage (giống disputeStore),
 * dùng để demo luồng "admin xử lý khiếu nại -> gửi thông báo cho các bên liên quan"
 * mà không cần backend thật.
 *
 * LƯU Ý: thông báo được gửi theo VAI TRÒ (recipient_type) chứ KHÔNG khớp chính xác
 * theo user_id thật — vì dữ liệu khiếu nại demo dùng ID giả không trùng với ID tài
 * khoản thật trong DB (giống lý do MyDisputesPage phải fallback demo trước đó).
 * Tài khoản nào đang đăng nhập với current_role khớp recipient_type sẽ thấy thông báo
 * này, trộn chung với thông báo thật lấy từ API (xem hooks/useNotifications.ts).
 * recipient_id vẫn được lưu lại để hiển thị/tham khảo nhưng không dùng để lọc.
 */
import type { Notification } from '../types/notification'

export type NotificationRecipientType = 'user' | 'shop' | 'shipper' | 'admin'

export interface LocalNotification extends Notification {
  recipient_type: NotificationRecipientType
  recipient_id: number
}

const STORAGE_KEY = 'buyzo_notifications_v1'
const EVENT_NAME = 'buyzo-notifications-updated'

function readAll(): LocalNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(items: LocalNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  // Bao cho cac component dang lang nghe (cung tab) biet co thong bao moi
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function onNotificationsChanged(handler: () => void): () => void {
  window.addEventListener(EVENT_NAME, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(EVENT_NAME, handler)
    window.removeEventListener('storage', handler)
  }
}

export function getNotificationsFor(type: NotificationRecipientType, _id?: number): LocalNotification[] {
  // Loc theo vai tro (broadcast) — xem giai thich o dau file vi sao khong loc theo id
  return readAll()
    .filter(n => n.recipient_type === type)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
}

export interface AddNotificationInput {
  title: string
  message: string
  type?: string
  action_url?: string
  related_entity_type?: string
  related_entity_id?: number
}

export function addNotificationFor(type: NotificationRecipientType, id: number, input: AddNotificationInput): LocalNotification {
  const items = readAll()
  const notif: LocalNotification = {
    notification_id: Date.now() + Math.floor(Math.random() * 1000),
    recipient_type: type,
    recipient_id: id,
    is_read: false,
    created_at: new Date().toISOString(),
    ...input,
  }
  items.unshift(notif)
  writeAll(items)
  return notif
}

export function markLocalRead(notificationId: number) {
  const items = readAll()
  const n = items.find(n => n.notification_id === notificationId)
  if (n && !n.is_read) {
    n.is_read = true
    writeAll(items)
  }
}

export function markAllLocalReadFor(type: NotificationRecipientType, _id?: number) {
  const items = readAll()
  let changed = false
  items.forEach(n => {
    if (n.recipient_type === type && !n.is_read) {
      n.is_read = true
      changed = true
    }
  })
  if (changed) writeAll(items)
}
