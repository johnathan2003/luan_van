/**
 * notificationStore — mock thông báo nội bộ lưu localStorage,
 * dùng để demo luồng "admin xử lý khiếu nại → gửi thông báo cho các bên liên quan".
 *
 * FIX: thêm recipient_email vào mỗi thông báo.
 * - getNotificationsFor(email, type) chỉ trả về thông báo đúng email + role.
 * - addNotificationFor(recipientEmail, type, id, input) ghi recipient_email.
 * - Thông báo không có email (recipient_email='') vẫn hiển thị cho tất cả role đó
 *   (dùng cho thông báo broadcast như "bên thứ 3" trong dispute).
 */
import type { Notification } from '../types/notification'

export type NotificationRecipientType = 'user' | 'shop' | 'shipper' | 'admin'

export interface LocalNotification extends Notification {
  recipient_type: NotificationRecipientType
  recipient_id: number
  /** Email của người nhận. Rỗng = broadcast cho tất cả role đó (backward compat). */
  recipient_email: string
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
  // Giữ tối đa 200 thông báo để tránh localStorage overflow
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 200)))
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

/**
 * Lấy thông báo cho một user cụ thể (email + role).
 * - Trả về thông báo có recipient_email === email (đúng người)
 * - Hoặc recipient_email === '' (broadcast cho toàn bộ role)
 */
export function getNotificationsFor(email: string, type: NotificationRecipientType): LocalNotification[] {
  return readAll()
    .filter(n =>
      n.recipient_type === type &&
      (n.recipient_email === email || n.recipient_email === '')
    )
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

/**
 * Ghi một thông báo cho người nhận cụ thể.
 * @param recipientEmail - email người nhận. Truyền '' để broadcast cho toàn bộ role.
 * @param type - vai trò người nhận
 * @param id - user_id của người nhận (để tham khảo)
 * @param input - nội dung thông báo
 */
export function addNotificationFor(
  recipientEmail: string,
  type: NotificationRecipientType,
  id: number,
  input: AddNotificationInput,
): LocalNotification {
  const items = readAll()
  const notif: LocalNotification = {
    notification_id: Date.now() + Math.floor(Math.random() * 1000),
    recipient_type: type,
    recipient_id: id,
    recipient_email: recipientEmail,
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

export function markAllLocalReadFor(email: string, type: NotificationRecipientType) {
  const items = readAll()
  let changed = false
  items.forEach(n => {
    if (
      n.recipient_type === type &&
      (n.recipient_email === email || n.recipient_email === '') &&
      !n.is_read
    ) {
      n.is_read = true
      changed = true
    }
  })
  if (changed) writeAll(items)
}
