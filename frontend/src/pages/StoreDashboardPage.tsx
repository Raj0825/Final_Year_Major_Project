import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "../context/AuthContext"
import { getMyBatches, getBatchesForStore, syncAllListings } from "../api/batches"
import { getMyStore } from "../api/stores"
import { useNavigate } from "react-router-dom"
import type { Batch } from "../types"
import TierBadge from "../components/shared/TierBadge"
import AppLayout from "../components/layout/AppLayout"
import AddBatchModal from "../components/shared/AddBatchModal"
import { useToast } from "../context/ToastContext"

export default function StoreDashboardPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const storeId = user?.storeId ?? ""

  // Auto-resolve storeId if not present in session
  useEffect(() => {
    if (!user?.storeId) {
      getMyStore()
        .then((s) => {
          if (s && s.id && user) {
            login({ ...user, storeId: s.id })
          }
        })
        .catch(() => {})
    }
  }, [user, login])

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMyBatches()
      setBatches(data)
      if (!user?.storeId && data.length > 0 && data[0].storeId && user) {
        login({ ...user, storeId: data[0].storeId })
      }
    } catch {
      if (storeId) {
        try { setBatches(await getBatchesForStore(storeId)) } catch {}
      }
    } finally {
      setLoading(false)
    }
  }, [storeId, user, login])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  // Automatically refresh when window gets focus or periodically
  useEffect(() => {
    const handleFocus = () => fetchBatches()
    window.addEventListener("focus", handleFocus)
    const interval = setInterval(() => {
      fetchBatches()
    }, 8000)
    return () => {
      window.removeEventListener("focus", handleFocus)
      clearInterval(interval)
    }
  }, [fetchBatches])

  const stats = {
    total: batches.length,
    fresh: batches.filter((b) => b.state === "FRESH").length,
    discounted: batches.filter((b) => ["TIER_1","TIER_2","TIER_3"].includes(b.state)).length,
    review: batches.filter((b) => b.needsManualReview).length,
    expired: batches.filter((b) => b.state === "EXPIRED").length,
    totalQty: Math.round(batches.reduce((sum, b) => sum + (b.quantity || 0), 0) * 10) / 10,
  }

  const [syncing, setSyncing] = useState(false)
  const { addToast } = useToast()

  const handleSyncListings = async () => {
    setSyncing(true)
    try {
      await syncAllListings()
      addToast("All batches synced to Customer Listings! 🛒", "success")
      fetchBatches()
    } catch (err: any) {
      addToast("Failed to sync listings", "error")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <AppLayout>
      <div className="page-header flex items-center justify-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Store Dashboard 🏪</h1>
          <p className="page-subtitle">
            Manage batches and track freshness for store <strong>{storeId || "Active Store"}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => fetchBatches()} disabled={loading}>
            {loading ? "Refreshing..." : "🔄 Refresh"}
          </button>
          <button className="btn btn-secondary" onClick={handleSyncListings} disabled={syncing}>
            {syncing ? "Syncing..." : "🔄 Sync Listings"}
          </button>
          <button id="add-batch-btn" className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Add Batch
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Batches ({stats.totalQty} units in stock)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--tier-fresh)" }}>{stats.fresh}</div>
          <div className="stat-label">Fresh</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--tier-2)" }}>{stats.discounted}</div>
          <div className="stat-label">Discounted</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--urgent)" }}>{stats.review}</div>
          <div className="stat-label">Needs Review</div>
        </div>
      </div>

      {/* Review Alert */}
      {stats.review > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 24 }}>
          ⚠️ <strong>{stats.review} batch{stats.review > 1 ? "es" : ""}</strong> need manual review — ML scan failed for these items.
        </div>
      )}

      {/* Batch Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th><th>Category</th><th>State</th><th>Freshness</th>
              <th>Available Qty</th><th>Discount</th><th>Stocked</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading && batches.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8}><div className="skeleton" style={{ height: 32, borderRadius: 4 }} /></td>
                </tr>
              ))
            ) : batches.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
                  No batches registered yet. Click <strong>"+ Add Batch"</strong> to add your first batch.
                </td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.productName}</div>
                    <div className="text-xs text-muted">ID: {b.id.slice(-8)}</div>
                  </td>
                  <td>{b.category}</td>
                  <td><TierBadge tier={b.state} showDiscount /></td>
                  <td>
                    {b.freshnessScore != null ? (
                      <span style={{ color: b.freshnessScore > 0.5 ? "var(--accent)" : "var(--urgent)", fontWeight: 600 }}>
                        {Math.round(b.freshnessScore * 100)}%
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      {b.quantity} {b.unit}
                    </div>
                    {b.quantityReserved != null && b.quantityReserved > 0 && (
                      <div className="text-xs" style={{ color: "#d97706", fontWeight: 600, marginTop: 2 }}>
                        ⏳ {b.quantityReserved} {b.unit} reserved
                      </div>
                    )}
                    {b.quantity <= 0 && (
                      <div className="text-xs" style={{ color: "var(--urgent)", fontWeight: 600, marginTop: 2 }}>
                        Out of stock
                      </div>
                    )}
                  </td>
                  <td>{b.currentDiscountPercent ? `-${b.currentDiscountPercent}%` : "—"}</td>
                  <td className="text-sm text-muted">{new Date(b.stockedAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/store/batch/${b.id}`)}
                    >
                      Scan / Details →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddBatchModal
          storeId={storeId}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false)
            fetchBatches()
          }}
        />
      )}
    </AppLayout>
  )
}
