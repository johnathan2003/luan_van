import { useEffect, useMemo, useState } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { fetchNotifications, markAsRead, markAllAsRead, addNotification } from '../store/slices/notificationSlice'
import { checkAuth } from '../store/slices/authSlice'
import { getSocket } from '../services/notificationService'
import { toast } from 'react-toastify'
import { getNotificationsFor, markLocalRead, markAllLocalReadFor, onNotificationsChanged, type NotificationRecipientType } from '../utils/notificationStore'

// Notification types that grant new roles → cần refresh auth để lấy role mới
const ROLE_GRANT_TYPES = ['shop_approved', 'shipper_approved', 'employee_assigned']

export const useNotifications = () => {
  const dispatch = useAppDispatch()
  const { notifications, unread_count, loading } = useAppSelector(s => s.notification)
  const { user, isAuthenticated } = useAppSelector(s => s.auth)

  // Thong bao mock (luu localStorage) gan voi vai tro + user_id dang dang nhap —
  // dung de demo "admin xu ly khieu nai -> gui thong bao cho cac ben lien quan"
  const recipientType = (user?.current_role as NotificationRecipientType) || 'user'
  const [localVersion, setLocalVersion] = useState(0)

  useEffect(() => {
    if (isAuthenticated) dispatch(fetchNotifications())
  }, [isAuthenticated, dispatch])

  useEffect(() => {
    if (!isAuthenticated || !user) return
    const socket = getSocket(user.user_id)
    socket.on('notification', (data: any) => {
      dispatch(addNotification({
        notification_id: data.notification_id || Date.now(),
        title: data.title,
        message: data.message,
        type: data.type,
        is_read: false,
        action_url: data.action_url,
        created_at: new Date().toISOString(),
      }))
      toast.info(`🔔 ${data.title}: ${data.message}`, { autoClose: 4000 })

      // Nếu được cấp role mới → refresh /me để frontend có đủ roles ngay lập tức
      if (ROLE_GRANT_TYPES.includes(data.type)) {
        dispatch(checkAuth())
      }
    })
    return () => { socket.off('notification') }
  }, [isAuthenticated, user, dispatch])

  // Lang nghe thong bao mock moi (vi du admin vua xu ly khieu nai) de cap nhat ngay
  useEffect(() => {
    const unsub = onNotificationsChanged(() => setLocalVersion(v => v + 1))
    return unsub
  }, [])

  const localNotifications = useMemo(
    () => (user ? getNotificationsFor(recipientType) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, recipientType, localVersion]
  )

  const combinedNotifications = useMemo(
    () => [...localNotifications, ...notifications].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    ),
    [localNotifications, notifications]
  )

  const combinedUnreadCount = unread_count + localNotifications.filter(n => !n.is_read).length

  const read = (id: number) => {
    if (localNotifications.some(n => n.notification_id === id)) {
      markLocalRead(id)
      setLocalVersion(v => v + 1)
    } else {
      dispatch(markAsRead(id))
    }
  }

  const readAll = () => {
    if (user) {
      markAllLocalReadFor(recipientType)
      setLocalVersion(v => v + 1)
    }
    dispatch(markAllAsRead())
  }

  return { notifications: combinedNotifications, unread_count: combinedUnreadCount, loading, read, readAll }
}
