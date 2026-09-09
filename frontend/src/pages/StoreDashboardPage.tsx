import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "../context/AuthContext"
import { getBatchesForStore, createBatch } from "../api/batches"
import { useNavigate } from "react-router-dom"
import type { Batch } from "../types"
import TierBadge from "../components/shared/TierBadge"
import AppLayout from "../components/layout/AppLayout"
import { useToast } from "../context/ToastContext"

function AddBatchModal({ storeId, onClose, onSaved }: { storeId: string; onClose: () => void; onSaved: () => void }) {
  const { addToast } = useToast()
  const [form, setForm] = useState({
    productName: "", category: "Fruit", quantity: 1, unit: "kg",
    stockedAt: new Date().toISOString().slice(0, 16), originalPrice: 0,
  })
  const [loading, setLoading] = useState(false)

  function set(k: string, v: any) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await createBatch({ ...form, storeId, stockedAt: new Date(form.stockedAt).toISOString() })
      addToast("Batch created successfully! 🎉", "success")
      onSaved()
    } catch (err: any) {
      addToast(err.response?.data?.message ?? "Failed to create batch", "error")
    } finally { setLoading(false) }
  }

  const CATEGORIES = ["Fruit", "Vegetable", "Dairy", "Bakery", "Meat", "Seafood", "Beverage", "Snack"]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add New Batch</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Product Name</label>
            <input id="batch-product" className="form-input" placeholder="e.g. Bananas" value={form.productName} onChange={(e) => set("productName", e.target.value)} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select id="batch-category" className="form-select" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select id="batch-unit" className="form-select" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                <option value="kg">kg</option><option value="unit">units</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input id="batch-qty" className="form-input" type="number" min={0.1} step={0.1} value={form.quantity} onChange={(e) => set("quantity", Number(e.target.value))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Original Price (₹)</label>
              <input id="batch-price" className="form-input" type="number" min={0} step={0.5} value={form.originalPrice} onChange={(e) => set("originalPrice", Number(e.target.value))} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Stocked At</label>
            <input id="batch-stocked" className="form-input" type="datetime-local" value={form.stockedAt} onChange={(e) => set("stockedAt", e.target.value)} required />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary w-full" onClick={onClose}>Cancel</button>
            <button id="save-batch" type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? <span className="spinner" /> : "Add Batch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function StoreDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const storeId = user?.storeId ?? ""

  const fetchBatches = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try { setBatches(await getBatchesForStore(storeId)) } catch {} finally { setLoading(false) }
  }, [storeId])

  useEffect(() => { fetchBatches() }, [fetchBatches])

  const stats = {
    total: batches.length,
    fresh: batches.filter((b) => b.state === "FRESH").length,
    discounted: batches.filter((b) => ["TIER_1","TIER_2","TIER_3"].includes(b.state)).length,
    review: batches.filter((b) => b.needsManualReview).length,
    expired: batches.filter((b) => b.state === "EXPIRED").length,
  }

  return (
    <AppLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Store Dashboard 🏪</h1>
          <p className="page-subtitle">Manage batches and track freshness for store <strong>{storeId || "—"}</strong></p>
        </div>
        <button id="add-batch-btn" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Batch
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Batches</div>
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
              <th>Qty</th><th>Discount</th><th>Stocked</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 14, width: "80%", borderRadius: 4 }} /></td>
                    ))}
                  </tr>
                ))
              : batches.length === 0
              ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No batches yet. Add one to get started.</td></tr>
              : batches.map((b) => (
                <tr key={b.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/store/batch/${b.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.productName}</div>
                    {b.needsManualReview && <span className="badge badge-tier-2" style={{ fontSize: ".7rem", marginTop: 4 }}>⚠ Review</span>}
                  </td>
                  <td className="text-muted">{b.category}</td>
                  <td><TierBadge tier={b.state} /></td>
                  <td>
                    {b.freshnessScore != null
                      ? <span style={{ color: b.freshnessScore > 0.5 ? "var(--accent)" : "var(--urgent)", fontWeight: 600 }}>
                          {Math.round(b.freshnessScore * 100)}%
                        </span>
                      : <span className="text-subtle">—</span>
                    }
                  </td>
                  <td>{b.quantity} {b.unit}</td>
                  <td>{b.currentDiscountPercent != null ? <span className="discount-chip">{b.currentDiscountPercent}% off</span> : "—"}</td>
                  <td className="text-muted text-sm">{new Date(b.stockedAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/store/batch/${b.id}`) }}>
                      View →
                    </button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {showAdd && storeId && (
        <AddBatchModal storeId={storeId} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); fetchBatches() }} />
      )}
      {showAdd && !storeId && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal">
            <div className="alert alert-error">Your account does not have a Store ID. Please contact your administrator.</div>
            <button className="btn btn-secondary w-full" style={{ marginTop: 16 }} onClick={() => setShowAdd(false)}>Close</button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

