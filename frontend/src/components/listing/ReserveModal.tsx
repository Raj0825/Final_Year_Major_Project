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
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)

  async function handleReserve() {
    setLoading(true)
    try {
      const order = await reserveListing(listing.id, qty)
      // Persist to sessionStorage for MyOrdersPage
      const prev = JSON.parse(sessionStorage.getItem("my_orders") ?? "[]")
      sessionStorage.setItem("my_orders", JSON.stringify([order, ...prev]))
      addToast(`Reserved ${qty} ${listing.unit} of ${listing.productName}! Check My Orders for your QR code. ✅`, "success")
      onSuccess()
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.response?.data ?? "Reservation failed"
      addToast(typeof msg === "string" ? msg : "Reservation failed", "error")
    } finally {
      setLoading(false)
    }
  }

  const total = (listing.currentPrice * qty).toFixed(2)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Reserve Item</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div style={{ fontSize: "2.5rem" }}>🛒</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{listing.productName}</div>
            <div className="text-sm text-muted">{listing.storeName}</div>
            <div style={{ marginTop: 6 }}>
              <span className="listing-current-price">₹{listing.currentPrice.toFixed(2)}</span>
              <span className="listing-original-price" style={{ marginLeft: 8 }}>₹{listing.originalPrice.toFixed(2)}</span>
              <span className="discount-chip" style={{ marginLeft: 6 }}>-{listing.discountPercent}%</span>
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Quantity ({listing.unit})</label>
          <input
            id="reserve-qty"
            className="form-input"
            type="number"
            min={1}
            max={listing.quantityAvailable}
            step={listing.unit === "kg" ? 0.5 : 1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
          <span className="text-xs text-muted">Max: {listing.quantityAvailable} {listing.unit}</span>
        </div>

        <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius)", padding: "14px 18px", marginBottom: 24 }}>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Unit price</span>
            <span>₹{listing.currentPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm" style={{ marginTop: 6 }}>
            <span className="text-muted">Quantity</span>
            <span>{qty} {listing.unit}</span>
          </div>
          <div className="divider" style={{ margin: "12px 0" }} />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span style={{ color: "var(--accent)" }}>₹{total}</span>
          </div>
        </div>

        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          ⏱️ Hold expires in <strong>15 minutes</strong> — please collect in time.
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-secondary w-full" onClick={onClose}>Cancel</button>
          <button id="confirm-reserve" className="btn btn-primary w-full" onClick={handleReserve} disabled={loading || qty <= 0}>
            {loading ? <span className="spinner" /> : "Confirm Reserve"}
          </button>
        </div>
      </div>
    </div>
  )
}
