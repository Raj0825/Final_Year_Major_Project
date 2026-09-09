import React, { createContext, useContext, useState, useCallback } from 'react'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  login: (user: User) => void
  logout: () => void
  isStoreRole: boolean
  isBuyerRole: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('fr_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const login = useCallback((u: User) => {
    localStorage.setItem('fr_token', u.token)
    localStorage.setItem('fr_user', JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('fr_token')
    localStorage.removeItem('fr_user')
    setUser(null)
  }, [])

  const isStoreRole = user?.role === 'STORE_MANAGER' || user?.role === 'STORE_STAFF'
  const isBuyerRole = user?.role === 'NGO' || user?.role === 'CUSTOMER'

  return (
    <AuthContext.Provider value={{ user, login, logout, isStoreRole, isBuyerRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
