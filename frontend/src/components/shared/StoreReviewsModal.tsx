import React, { useEffect, useState } from 'react'
import { getStoreReviews, getStoreById } from '../../api/stores'
import type { Review, Store } from '../../types'

interface Props {
  storeId: string
  storeName: string
  onClose: () => void
}

export default function StoreReviewsModal({ storeId, storeName, onClose }: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([getStoreReviews(storeId), getStoreById(storeId)])
      .then(([revRes, storeRes]) => {
        if (revRes.status === 'fulfilled') setReviews(revRes.value)
        if (storeRes.status === 'fulfilled') setStore(storeRes.value)
      })
      .finally(() => setLoading(false))
  }, [storeId])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card card-body"
        style={{ maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{storeName} Reviews ⭐</h3>
            {store && (
              <div className="flex items-center gap-2 mt-1">
                <span className="rating-stars" style={{ fontSize: '1rem' }}>
                  {'★'.repeat(Math.round(store.averageRating || 5))}
                </span>
                <span className="text-sm font-bold">{store.averageRating?.toFixed(1) || '5.0'}</span>
                <span className="text-xs text-muted">({store.reviewCount || reviews.length} reviews)</span>
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }} className="text-muted">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="empty-state-icon">⭐</div>
            <div style={{ fontWeight: 600 }}>No reviews yet</div>
            <div className="text-sm">Be the first to rescue food from here and leave feedback!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.map((r) => (
              <div key={r.id} style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">{r.reviewerName || 'Community Member'}</span>
                  <span className="rating-stars">{'★'.repeat(r.rating)}</span>
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text)' }}>{r.comment}</div>
                <div className="text-xs text-muted mt-1">
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
