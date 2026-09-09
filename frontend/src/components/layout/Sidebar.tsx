import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { getUnreadCount } from '../../api/notifications'

const IconDashboard = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const IconBox = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
)
const IconShop = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
)
const IconOrder = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
)
const IconMap = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
  </svg>
)
const IconBell = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const IconAnalytics = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const IconStore = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const IconUser = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const IconLogout = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

export default function Sidebar() {
  const { user, logout, isStoreRole, isBuyerRole } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    getUnreadCount()
      .then((res) => setUnreadCount(res.unreadCount))
      .catch(() => {})
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const initials = user?.name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) ?? 'U'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="sidebar-logo-icon">🌿</div>
          <span className="sidebar-logo-text">FreshRescue</span>
        </div>
      </div>

      {isStoreRole && (
        <>
          <span className="sidebar-section-label">Store Operations</span>
          <NavLink to="/store/dashboard" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <IconDashboard /> Dashboard
          </NavLink>
          <NavLink to="/store/batches" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <IconBox /> Batches
          </NavLink>
          <NavLink to="/store/orders" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <IconOrder /> Fulfill Orders
          </NavLink>
          <NavLink to="/store/analytics" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <IconAnalytics /> Analytics & ESG
          </NavLink>
          {user?.role === 'STORE_MANAGER' && (
            <NavLink to="/store/register" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <IconStore /> Register Store
            </NavLink>
          )}
        </>
      )}

      {isBuyerRole && (
        <>
          <span className="sidebar-section-label">Discover & Rescue</span>
          <NavLink to="/feed" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <IconShop /> Browse Listings
          </NavLink>
          <NavLink to="/feed/map" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <IconMap /> Map View
          </NavLink>
          <NavLink to="/my-orders" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <IconOrder /> My Orders
          </NavLink>
        </>
      )}

      <span className="sidebar-section-label">General</span>
      <NavLink to="/notifications" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
        <IconBell />
        <span>Notifications</span>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </NavLink>

      <NavLink to="/profile" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
        <IconUser /> Profile & Alerts
      </NavLink>

      <div className="sidebar-footer">
        {/* Theme Toggle Button */}
        <button
          type="button"
          className="btn btn-secondary btn-sm w-full mb-2"
          onClick={toggleTheme}
          style={{ justifyContent: 'center', gap: 8, fontSize: '0.8rem' }}
        >
          {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>

        <div className="user-chip">
          <div className="user-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-muted truncate">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>

        <button className="btn btn-ghost w-full mt-2" onClick={handleLogout} style={{ justifyContent: 'flex-start', gap: 10 }}>
          <IconLogout /> Sign out
        </button>
      </div>
    </aside>
  )
}
