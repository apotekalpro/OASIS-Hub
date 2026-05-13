import { create } from 'zustand'
import type { AppNotification } from '@/types/database'

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  setNotifications: (notifications: AppNotification[]) => void
  addNotification: (notification: AppNotification) => void
  markRead: (id: string) => void
  markAllRead: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter(n => !n.is_read).length }),
  addNotification: (notification) => {
    const notifications = [notification, ...get().notifications]
    set({ notifications, unreadCount: notifications.filter(n => !n.is_read).length })
  },
  markRead: (id) => {
    const notifications = get().notifications.map(n => n.id === id ? { ...n, is_read: true } : n)
    set({ notifications, unreadCount: notifications.filter(n => !n.is_read).length })
  },
  markAllRead: () => {
    const notifications = get().notifications.map(n => ({ ...n, is_read: true }))
    set({ notifications, unreadCount: 0 })
  },
}))
