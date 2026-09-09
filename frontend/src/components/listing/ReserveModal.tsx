import React, { useState } from "react"
import type { Listing } from "../../types"
import { reserveListing } from "../../api/orders"
import { useToast } from "../../context/ToastContext"

interface Props {
  listing: Listing
  onClose: () => void
  onSuccess: () => void
}

export default function ReserveModal({ listing, onClose, onSuccess }: Props) {
  const { addToast } = useToast()
  const maxQty = listing.quantityAvailable || 1
  const step = listing.unit === "kg" ? 0.5 : 1

  const [qty, setQty] = useState<number>(() => (maxQty >= 1 ? 1 : maxQty))
  const [loading, setLoading] = useState(false)

  const handleAdjust = (delta: number) => {
    setQty((prev) => {
      const next = Math.round((prev + delta) * 10) / 10
      return Math.max(step, Math.min(maxQty, next))
    })
  }

  const handleSelectQuick = (amount: number) => {
    setQty(Math.min(maxQty, amount))
  }

  async function handleReserve() {
    if (qty <= 0 || qty > maxQty) {
      addToast(`Please select a quantity between ${step} and ${maxQty} ${listing.unit}`, "error")
      return
    }
    setLoading(true)
    try {
      const order = await reserveListing(listing.id, qty)
      const prev = JSON.parse(sessionStorage.getItem("my_orders") ?? "[]")
      sessionStorage.setItem("my_orders", JSON.stringify([order, ...prev]))
      addToast(`Reserved ${qty} ${listing.unit} of ${listing.productName}! Check My Orders for your pickup QR code. ✅`, "success")
      onSuccess()
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.response?.data ?? "Reservation failed"
      addToast(typeof msg === "string" ? msg : "Reservation failed", "error")
    } finally {
      setLoading(false)
    }
  }

  const totalPrice = (listing.currentPrice * qty).toFixed(2)
  const savings = ((listing.originalPrice - listing.currentPrice) * qty).toFixed(2)

  // Generate quick quantity suggestions
  const suggestions = [1, 2, 5, 10].filter((val) => val <= maxQty)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">Reserve Food Items 🛒</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Item Summary Card */}
        <div style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "center" }}>
          <div style={{ fontSize: "2.5rem" }}>
            {listing.category?.toLowerCase().includes("fruit") ? "🍎" :
             listing.category?.toLowerCase().includes("vegetable") ? "🥦" :
             listing.category?.toLowerCase().includes("bakery") ? "🍞" :
             listing.category?.toLowerCase().includes("dairy") ? "🥛" : "🛒"}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.15rem" }}>{listing.productName}</div>
            <div className="text-xs text-muted">{listing.storeName}</div>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="listing-current-price" style={{ fontSize: "1.2rem" }}>
                ₹{listing.currentPrice.toFixed(2)}
              </span>
              <span className="listing-original-price">₹{listing.originalPrice.toFixed(2)}</span>
              <span className="discount-chip">-{listing.discountPercent}%</span>
              <span className="text-xs text-muted">/ {listing.unit}</span>
            </div>
          </div>
        </div>

        {/* Quantity Selection Area */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <div className="flex justify-between items-center mb-2">
            <label className="form-label" style={{ marginBottom: 0 }}>Choose Quantity to Buy</label>
            <span className="text-xs text-accent font-semibold">
              {maxQty} {listing.unit} in stock
            </span>
          </div>

          {/* Stepper with - / + */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleAdjust(-step)}
              disabled={qty <= step}
              style={{ width: 44, height: 44, fontSize: "1.3rem", padding: 0 }}
            >
              −
            </button>
            <input
              id="reserve-qty"
              className="form-input"
              type="number"
              min={step}
              max={maxQty}
              step={step}
              value={qty}
              onChange={(e) => {
                const val = Number(e.target.value)
                if (!isNaN(val)) setQty(val)
              }}
              style={{ flex: 1, textAlign: "center", fontSize: "1.2rem", fontWeight: 700 }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleAdjust(step)}
              disabled={qty >= maxQty}
              style={{ width: 44, height: 44, fontSize: "1.3rem", padding: 0 }}
            >
              +
            </button>
          </div>

          {/* Range Slider */}
          <input
            type="range"
            min={step}
            max={maxQty}
            step={step}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-full mt-2"
            style={{ cursor: "pointer" }}
          />

          {/* Quick preset buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {suggestions.map((val) => (
              <button
                key={val}
                type="button"
                className={`filter-chip${qty === val ? " active" : ""}`}
                onClick={() => handleSelectQuick(val)}
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                {val} {listing.unit}
              </button>
            ))}
            <button
              type="button"
              className={`filter-chip${qty === maxQty ? " active" : ""}`}
              onClick={() => handleSelectQuick(maxQty)}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              Max ({maxQty} {listing.unit})
            </button>
          </div>
          <span className="text-xs text-muted" style={{ marginTop: 8, display: "block" }}>
            💡 You only pay for what you reserve. Buy any portion from <strong>{step} {listing.unit}</strong> up to the full batch.
          </span>
        </div>

        {/* Pricing Breakdown */}
        <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius)", padding: "14px 18px", marginBottom: 20 }}>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Unit Rate</span>
            <span>₹{listing.currentPrice.toFixed(2)} / {listing.unit}</span>
          </div>
          <div className="flex justify-between text-sm" style={{ marginTop: 6 }}>
            <span className="text-muted">Selected Quantity</span>
            <span className="font-semibold">{qty} {listing.unit}</span>
          </div>
          {Number(savings) > 0 && (
            <div className="flex justify-between text-sm" style={{ marginTop: 6, color: "var(--accent)" }}>
              <span>You Save (-{listing.discountPercent}%)</span>
              <span>₹{savings}</span>
            </div>
          )}
          <div className="divider" style={{ margin: "10px 0" }} />
          <div className="flex justify-between font-bold" style={{ fontSize: "1.1rem" }}>
            <span>Total Payable</span>
            <span style={{ color: "var(--accent)" }}>₹{totalPrice}</span>
          </div>
        </div>

        <div className="alert alert-warning" style={{ marginBottom: 20, fontSize: "0.85rem" }}>
          ⏱️ A <strong>15-minute pickup hold</strong> starts once confirmed.
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-secondary w-full" onClick={onClose}>Cancel</button>
          <button
            id="confirm-reserve"
            className="btn btn-primary w-full"
            onClick={handleReserve}
            disabled={loading || qty <= 0 || qty > maxQty}
          >
            {loading ? <span className="spinner" /> : `Reserve ${qty} ${listing.unit} (₹${totalPrice})`}
          </button>
        </div>
      </div>
    </div>
  )
}
