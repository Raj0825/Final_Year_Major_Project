import React, { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getBatch, scanBatch, updateBatchTier } from "../api/batches"
import type { Batch } from "../types"
import TierBadge from "../components/shared/TierBadge"
import FreshnessGauge from "../components/shared/FreshnessGauge"
import AppLayout from "../components/layout/AppLayout"
import { useToast } from "../context/ToastContext"

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [batch, setBatch] = useState<Batch | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [updatingTier, setUpdatingTier] = useState(false)
  const [activeImg, setActiveImg] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    try { setBatch(await getBatch(id)) } catch { addToast("Failed to load batch", "error") } finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  async function handleScan(file: File) {
    if (!id) return
    setScanning(true)
    try {
      const updated = await scanBatch(id, file)
      setBatch(updated)
      addToast("Scan complete! Freshness score updated. 🔬", "success")
    } catch (err: any) {
      addToast(err.response?.data?.message ?? "Scan failed — check ML service", "error")
    } finally { setScanning(false) }
  }

  async function handleSetTier(tier: string, discount: number) {
    if (!id) return
    setUpdatingTier(true)
    try {
      const updated = await updateBatchTier(id, tier, discount)
      setBatch(updated)
      addToast(`Batch updated to ${tier.replace("_", " ")} (-${discount}%) and synced to Customer Feed! 🛒`, "success")
    } catch (err: any) {
      addToast(err.response?.data?.message ?? "Failed to update tier", "error")
    } finally {
      setUpdatingTier(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleScan(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith("image/")) handleScan(f)
  }

  if (loading) return (
    <AppLayout>
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
        <span className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    </AppLayout>
  )

  if (!batch) return (
    <AppLayout>
      <div className="alert alert-error">Batch not found.</div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back to Batches</button>
      </div>

      <div className="page-header flex items-center justify-between" style={{ flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 className="page-title">{batch.productName}</h1>
            <TierBadge tier={batch.state} showDiscount />
          </div>
          <p className="page-subtitle">{batch.category} · Store {batch.storeId}</p>
        </div>
        {batch.freshnessScore != null && <FreshnessGauge score={batch.freshnessScore} size={110} />}
      </div>

      {/* Manual Review Alert */}
      {batch.needsManualReview && (
        <div className="alert alert-warning" style={{ marginBottom: 24 }}>
          ⚠️ <strong>Manual review required.</strong> ML scan encountered an error — you can set the discount tier manually below to list this item immediately!
        </div>
      )}

      {/* Manual Tier / Discount Controls */}
      <div className="card card-body" style={{ marginBottom: 24, border: "1px solid var(--accent)" }}>
        <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 6 }}>
          🏷️ Manage Shelf Tier & Customer Discount
        </h3>
        <p className="text-sm text-muted" style={{ marginBottom: 14 }}>
          Setting a discount tier automatically publishes this item to the Customer Browse Listings feed.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn btn-sm${batch.state === "TIER_1" ? " btn-primary" : " btn-secondary"}`}
            onClick={() => handleSetTier("TIER_1", 20)}
            disabled={updatingTier}
          >
            🟡 Tier 1 (-20% Off)
          </button>
          <button
            type="button"
            className={`btn btn-sm${batch.state === "TIER_2" ? " btn-primary" : " btn-secondary"}`}
            onClick={() => handleSetTier("TIER_2", 40)}
            disabled={updatingTier}
          >
            🟠 Tier 2 (-40% Off)
          </button>
          <button
            type="button"
            className={`btn btn-sm${batch.state === "TIER_3" ? " btn-danger" : " btn-secondary"}`}
            onClick={() => handleSetTier("TIER_3", 60)}
            disabled={updatingTier}
          >
            🔴 Tier 3 (-60% Urgent 🔥)
          </button>
          <button
            type="button"
            className={`btn btn-sm${batch.state === "FRESH" ? " btn-primary" : " btn-secondary"}`}
            onClick={() => handleSetTier("FRESH", 0)}
            disabled={updatingTier}
          >
            🟢 Fresh (0% Full Price)
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        {/* Left: Info + Images */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Image Gallery */}
          <div className="card card-body">
            <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Images</h3>
            {batch.imageUrls?.length > 0 ? (
              <>
                <img
                  src={batch.imageUrls[activeImg]}
                  alt={`Batch scan ${activeImg + 1}`}
                  style={{ width: "100%", height: 240, objectFit: "cover", borderRadius: "var(--radius)", marginBottom: 10 }}
                />
                <div className="image-gallery">
                  {batch.imageUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Scan ${i + 1}`}
                      className={`gallery-thumb${i === activeImg ? " active" : ""}`}
                      onClick={() => setActiveImg(i)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 32, color: "var(--text-subtle)" }}>No images yet — scan the batch to add one.</div>
            )}
          </div>

          {/* Scan Upload */}
          <div className="card card-body">
            <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Rescan Batch 🔬</h3>
            <div
              className={`upload-area${dragOver ? " drag-over" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              {scanning ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <span className="spinner" style={{ width: 32, height: 32 }} />
                  <span className="text-muted">Running ML pipeline…</span>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>📸</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop an image or click to upload</div>
                  <div className="text-sm text-muted">JPG, PNG, WEBP · triggers CNN freshness + OCR scan</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} id="scan-file-input" />
          </div>
        </div>

        {/* Right: Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Batch Info */}
          <div className="card card-body">
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Batch Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Quantity", value: `${batch.quantity} ${batch.unit}` },
                { label: "Reserved", value: `${batch.quantityReserved} ${batch.unit}` },
                { label: "Original Price", value: `₹${batch.originalPrice.toFixed(2)} / ${batch.unit}` },
                { label: "Discount", value: batch.currentDiscountPercent != null ? `${batch.currentDiscountPercent}%` : "None yet" },
                { label: "Stocked At", value: new Date(batch.stockedAt).toLocaleString() },
                { label: "Created", value: new Date(batch.createdAt).toLocaleString() },
                { label: "Last Updated", value: new Date(batch.updatedAt).toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <span className="text-sm text-muted">{label}</span>
                  <span className="text-sm font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ML Results */}
          <div className="card card-body">
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>ML Scan Results 🤖</h3>
            {batch.freshnessScore == null ? (
              <div className="text-muted text-sm">No scan data yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="flex justify-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <span className="text-sm text-muted">Freshness Score</span>
                  <span className="font-bold" style={{ color: batch.freshnessScore > 0.5 ? "var(--accent)" : "var(--urgent)" }}>
                    {(batch.freshnessScore * 100).toFixed(1)}%
                  </span>
                </div>
                {batch.predictedExpiryDate && (
                  <div className="flex justify-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                    <span className="text-sm text-muted">Predicted Expiry</span>
                    <span className="text-sm font-medium">{new Date(batch.predictedExpiryDate).toLocaleDateString()}</span>
                  </div>
                )}
                {batch.ocrExtractedDate && (
                  <div className="flex justify-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                    <span className="text-sm text-muted">OCR Label Date</span>
                    <span className="text-sm font-medium">{batch.ocrExtractedDate}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
