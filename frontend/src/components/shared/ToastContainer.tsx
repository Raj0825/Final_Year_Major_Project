import React from 'react'
import { useToast } from '../../context/ToastContext'

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()
  if (!toasts.length) return null
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => removeToast(t.id)} style={{ cursor: 'pointer' }}>
          <span style={{ fontSize: '1.1rem' }}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span style={{ flex: 1, color: 'var(--text)' }}>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
