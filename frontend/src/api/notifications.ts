import api from './client'
import type { NotificationItem } from '../types'

export const getNotifications = () =>
  api.get<NotificationItem[]>('/notifications').then((r) => r.data)

export const getUnreadCount = () =>
  api.get<{ unreadCount: number }>('/notifications/unread-count').then((r) => r.data)

export const markNotificationAsRead = (id: string) =>
  api.patch<NotificationItem>(`/notifications/${id}/read`).then((r) => r.data)

export const markAllNotificationsRead = () =>
  api.patch<{ message: string }>('/notifications/read-all').then((r) => r.data)
