import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { Notification } from '../../types/notification'
import API from '../../services/api'

interface NotificationState {
  notifications: Notification[]
  unread_count: number
  total: number
  loading: boolean
}

const initialState: NotificationState = {
  notifications: [],
  unread_count: 0,
  total: 0,
  loading: false,
}

export const fetchNotifications = createAsyncThunk('notification/fetch', async () => {
  const res = await API.get('/api/v1/notifications?limit=50')
  return res.data.data ?? res.data
})

export const markAsRead = createAsyncThunk('notification/markRead', async (id: number) => {
  await API.put(`/api/v1/notifications/${id}/read`)
  return id
})

export const markAllAsRead = createAsyncThunk('notification/markAllRead', async () => {
  await API.put('/api/v1/notifications/read-all')
})

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    addNotification(state, action: PayloadAction<Notification>) {
      state.notifications.unshift(action.payload)
      state.unread_count += 1
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.notifications = action.payload.notifications
        state.unread_count = action.payload.unread_count
        state.total = action.payload.total
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const n = state.notifications.find(n => n.notification_id === action.payload)
        if (n && !n.is_read) { n.is_read = true; state.unread_count = Math.max(0, state.unread_count - 1) }
      })
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.notifications.forEach(n => { n.is_read = true })
        state.unread_count = 0
      })
  },
})

export const { addNotification } = notificationSlice.actions
export default notificationSlice.reducer
