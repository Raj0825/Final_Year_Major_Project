import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "../context/AuthContext"
import { getMyBatches, getBatchesForStore } from "../api/batches"
import { getMyStore } from "../api/stores"
import { useNavigate } from "react-router-dom"
import type { Batch } from "../types"
import TierBadge from "../components/shared/TierBadge"
import AppLayout from "../components/layout/AppLayout"
import AddBatchModal from "../components/shared/AddBatchModal"

const STATES = ["All", "FRESH", "TIER_1", "TIER_2", "TIER_3", "EXPIRED"]

export default function StoreBatchesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const storeId = user?.storeId ?? ""

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMyBatches()
      setBatches(data)
    } catch {
      if (storeId) {
        try { setBatches(await getBatchesForStore(storeId)) } catch {}
      }
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  const filtered = batches.filter((b) => {
    const matchState = filter === "All" || b.state === filter
    const matchSearch = !search || b.productName.toLowerCase().includes(search.toLowerCase())
    return matchState && matchSearch
  })

  const [storeName, setStoreName] = useState("")

  useEffect(() => {
    getMyStore().then((s) => {
      if (s?.name) setStoreName(s.name)
    }).catch(() => {})
  }, [])

  return (
    <AppLayout>
      <div className="page-header flex items-center justify-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">All Batches 📦</h1>
          <p className="page-subtitle">
            Complete inventory view for <strong>{storeName || storeId || "Active Store"}</strong> ({batches.length} total)
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => fetchBatches()}>
            🔄 Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Add Batch
          </button>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 24 }}>
        <div className="search-input-wrapper">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            id="search-batches"
            className="form-input"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {STATES.map((s) => (
          <button
            key={s}
            className={`filter-chip${filter === s ? " active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s === "All" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="grid-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="skeleton" style={{ height: 14, width: "60%", borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 20, width: "40%", borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 12, width: "80%", borderRadius: 4 }} />
              </div>
            ))
          : filtered.length === 0
          ? (
            <div style={{ gridColumn: "1/-1" }}>
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <div style={{ fontWeight: 600 }}>No batches found</div>
                <div className="text-sm">Click "+ Add Batch" to register your first produce batch.</div>
              </div>
            </div>
          )
          : filtered.map((b) => (
            <div key={b.id} className="card" style={{ cursor: "pointer", padding: 20 }} onClick={() => navigate(`/store/batch/${b.id}`)}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <TierBadge tier={b.state} showDiscount />
                {b.needsManualReview && <span className="badge badge-tier-2" style={{ fontSize: ".7rem" }}>⚠ Review</span>}
              </div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{b.productName}</div>
              <div className="text-sm text-muted" style={{ marginBottom: 10 }}>{b.category}</div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Quantity</span>
                <span>{b.quantity} {b.unit}</span>
              </div>
              {b.freshnessScore != null && (
                <div className="flex justify-between text-sm" style={{ marginTop: 6 }}>
                  <span className="text-muted">Freshness</span>
                  <span style={{ color: b.freshnessScore > 0.5 ? "var(--accent)" : "var(--urgent)", fontWeight: 600 }}>
                    {Math.round(b.freshnessScore * 100)}%
                  </span>
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-secondary btn-sm w-full">View Details →</button>
              </div>
            </div>
          ))
        }
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
