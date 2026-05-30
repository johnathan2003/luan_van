import { useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { fetchNotifications, markAsRead, markAllAsRead, addNotification } from '../store/slices/notificationSlice'
import { getSocket } from '../services/notificationService'
import { toast } from 'react-toastify'

export const useNotifications = () => {
  const dispatch = useAppDispatch()
  const { notifications, unread_count, loading } = useAppSelector(s => s.notification)
  const { user, isAuthenticated } = useAppSelector(s => s.auth)

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
    })
    return () => { socket.off('notification') }
  }, [isAuthenticated, user, dispatch])

  const read = (id: number) => dispatch(markAsRead(id))
  const readAll = () => dispatch(markAllAsRead())

  return { notifications, unread_count, loading, read, readAll }
}
