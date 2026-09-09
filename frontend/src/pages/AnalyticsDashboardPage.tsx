import React, { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { getStoreAnalytics } from '../api/stores'
import type { StoreAnalytics } from '../types'
import { useToast } from '../context/ToastContext'

export default function AnalyticsDashboardPage() {
  const [analytics, setAnalytics] = useState<StoreAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  useEffect(() => {
    getStoreAnalytics('me')
      .then(setAnalytics)
      .catch((err) => {
        addToast(err.response?.data?.message || 'Failed to load analytics', 'error')
      })
      .finally(() => setLoading(false))
  }, [])

  const stateColors: Record<string, string> = {
    FRESH: 'var(--tier-fresh)',
    TIER_1: 'var(--tier-1)',
    TIER_2: 'var(--tier-2)',
    TIER_3: 'var(--tier-3)',
    EXPIRED: 'var(--tier-expired)',
  }

  const rescueRate = analytics && analytics.totalBatches > 0
    ? Math.round(((analytics.totalBatches - analytics.expiredBatches) / analytics.totalBatches) * 100)
    : 100

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Store Analytics & Impact 📊</h1>
        <p className="page-subtitle">
          Track revenue rescued, food waste prevented, and batch decay trends for {analytics?.storeName || 'your store'}.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }} className="text-muted">Loading store analytics...</div>
      ) : !analytics ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div style={{ fontWeight: 600 }}>No analytics available</div>
          <div className="text-sm">Make sure you have registered your store and added batches.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Key Impact Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="card card-body">
              <div className="text-xs text-muted font-semibold uppercase">Revenue Rescued</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent)', marginTop: 6 }}>
                ₹{analytics.revenueRescued.toLocaleString()}
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>from fulfilled orders</div>
            </div>

            <div className="card card-body">
              <div className="text-xs text-muted font-semibold uppercase">Food Waste Prevented</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--tier-1)', marginTop: 6 }}>
                {analytics.wastePreventedKg.toLocaleString()} kg
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>diverted from landfills</div>
            </div>

            <div className="card card-body">
              <div className="text-xs text-muted font-semibold uppercase">Rescue Success Rate</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--status-reserved)', marginTop: 6 }}>
                {rescueRate}%
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>batches saved prior to expiry</div>
            </div>

            <div className="card card-body">
              <div className="text-xs text-muted font-semibold uppercase">Fulfilled Orders</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>
                {analytics.fulfilledOrders} / {analytics.totalOrders}
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>pickup completions</div>
            </div>
          </div>

          {/* Batch State Distribution Breakdown */}
          <div className="card card-body">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
              Batch Freshness & Lifecycle Distribution
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(analytics.batchStateDistribution || {}).map(([stateKey, count]) => {
                const total = analytics.totalBatches || 1
                const pct = Math.round((count / total) * 100)
                const color = stateColors[stateKey] || 'var(--text-muted)'
                return (
                  <div key={stateKey}>
                    <div className="flex justify-between text-sm" style={{ marginBottom: 4 }}>
                      <span className="font-medium" style={{ color }}>
                        ● {stateKey.replace('_', ' ')}
                      </span>
                      <span className="text-muted">
                        {count} batches ({pct}%)
                      </span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Additional Info Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div className="card card-body">
              <h4 style={{ fontWeight: 600, marginBottom: 8 }}>📦 Active Catalog Overview</h4>
              <div className="flex justify-between text-sm" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="text-muted">Active Batches in Inventory</span>
                <span className="font-bold">{analytics.activeBatches}</span>
              </div>
              <div className="flex justify-between text-sm" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="text-muted">Live Listings on Buyer Feed</span>
                <span className="font-bold text-accent">{analytics.activeListings}</span>
              </div>
              <div className="flex justify-between text-sm" style={{ padding: '8px 0' }}>
                <span className="text-muted">Expired Batches</span>
                <span className="font-bold text-urgent">{analytics.expiredBatches}</span>
              </div>
            </div>

            <div className="card card-body">
              <h4 style={{ fontWeight: 600, marginBottom: 8 }}>🌱 Sustainability & ESG Impact</h4>
              <p className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
                By dynamic discounting and enabling fast local rescue, your store has saved an estimated{' '}
                <strong className="text-accent">{(analytics.wastePreventedKg * 2.5).toFixed(1)} kg CO₂ equivalent</strong>{' '}
                emissions! Keep batches updated with regular shelf scans to maintain high rescue rates.
              </p>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
