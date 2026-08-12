import { create } from "zustand";
import { notificationAPI } from "../services/api";

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const { data } = await notificationAPI.list();
      set({ notifications: data.results || data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await notificationAPI.list();
      const unread = (data.results || data).filter((n) => !n.is_read).length;
      set({ unreadCount: unread });
    } catch {}
  },

  // Được gọi từ WebSocket khi có notification mới
  addRealtime: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markRead: async (id) => {
    try {
      await notificationAPI.markRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) => n.id === id ? { ...n, is_read: true } : n),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {}
  },

  markAllRead: async () => {
    try {
      await notificationAPI.markAllRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch {}
  },
}));

export default useNotificationStore;
