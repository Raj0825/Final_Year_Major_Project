import React, { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { getNotifications, markNotificationAsRead, markAllNotificationsRead } from '../api/notifications'
import type { NotificationItem } from '../types'
import { useToast } from '../context/ToastContext'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { addToast } = useToast()

  const loadNotifs = async () => {
    try {
      setLoading(true)
      const data = await getNotifications()
      setNotifications(data)
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to load notifications', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifs()
  }, [])

  const handleMarkOne = async (id: string) => {
    try {
      await markNotificationAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch (err: any) {
      addToast('Failed to mark notification as read', 'error')
    }
  }

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      addToast('All notifications marked as read', 'success')
    } catch (err: any) {
      addToast('Failed to mark all as read', 'error')
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'NEW_DISCOUNT': return '🏷️'
      case 'PRICE_DROP': return '📉'
      case 'URGENT': return '⚡'
      case 'ORDER_CONFIRMED': return '✅'
      case 'PICKUP_REMINDER': return '⏰'
      default: return '🔔'
    }
  }

  const filtered = notifications.filter((n) => (filter === 'unread' ? !n.read : true))
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <AppLayout>
      <div className="page-header flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Notifications 🔔</h1>
          <p className="page-subtitle">Alerts for food discounts, urgent rescue opportunities, and orders.</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={handleMarkAll}>
            ✓ Mark all as read
          </button>
        )}
      </div>

      <div className="filter-bar mb-4">
        <button
          className={`filter-chip${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({notifications.length})
        </button>
        <button
          className={`filter-chip${filter === 'unread' ? ' active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }} className="text-muted">Loading notifications...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔕</div>
          <div style={{ fontWeight: 600 }}>No {filter === 'unread' ? 'unread' : ''} notifications</div>
          <div className="text-sm">You are all caught up!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((n) => (
            <div
              key={n.id}
              className="card card-body"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                borderLeft: n.read ? '1px solid var(--border)' : '4px solid var(--accent)',
                opacity: n.read ? 0.75 : 1,
              }}
            >
              <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>{getIcon(n.type)}</div>
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2">
                  <span className="badge" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    {n.type.replace('_', ' ')}
                  </span>
                  {!n.read && <span className="badge badge-fresh">NEW</span>}
                </div>
                <div style={{ marginTop: 6, fontSize: '0.95rem' }}>{n.message}</div>
                <div className="text-xs text-muted" style={{ marginTop: 6 }}>
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
              {!n.read && (
                <button
                  className="btn btn-ghost btn-sm text-xs"
                  onClick={() => handleMarkOne(n.id)}
                  title="Mark as read"
                >
                  ✓ Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
