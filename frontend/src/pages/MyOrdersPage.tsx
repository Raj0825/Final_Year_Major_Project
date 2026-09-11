import React, { useEffect, useState } from "react"
import AppLayout from "../components/layout/AppLayout"
import OrderStatusBadge from "../components/shared/OrderStatusBadge"
import type { Order } from "../types"
import { QRCodeSVG } from "qrcode.react"
import { getMyOrders } from "../api/orders"
import { postStoreReview } from "../api/stores"
import { useToast } from "../context/ToastContext"

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [secs, setSecs] = useState(() => {
    const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    return Math.max(0, diff)
  })

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const m = Math.floor(secs / 60).toString().padStart(2, "0")
  const s = (secs % 60).toString().padStart(2, "0")
  const isUrgent = secs < 120

  return <span className={`countdown${isUrgent ? " urgent" : ""}`}>⏱ {m}:{s}</span>
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [printOrder, setPrintOrder] = useState<Order | null>(null)
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const { addToast } = useToast()

  const loadOrders = async () => {
    try {
      setLoading(true)
      const data = await getMyOrders()
      if (data && data.length > 0) {
        // Guarantee newest booking is strictly on top
        const sorted = [...data].sort((a, b) => new Date(b.reservedAt || 0).getTime() - new Date(a.reservedAt || 0).getTime())
        setOrders(sorted)
      } else {
        // Fallback to local session storage if available
        const local: Order[] = JSON.parse(sessionStorage.getItem("my_orders") ?? "[]")
        local.sort((a, b) => new Date(b.reservedAt || 0).getTime() - new Date(a.reservedAt || 0).getTime())
        setOrders(local)
      }
    } catch {
      const local: Order[] = JSON.parse(sessionStorage.getItem("my_orders") ?? "[]")
      local.sort((a, b) => new Date(b.reservedAt || 0).getTime() - new Date(a.reservedAt || 0).getTime())
      setOrders(local)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
    const handleFocus = () => loadOrders()
    window.addEventListener("focus", handleFocus)
    const interval = setInterval(loadOrders, 10000)
    return () => {
      window.removeEventListener("focus", handleFocus)
      clearInterval(interval)
    }
  }, [])

  const handlePrint = (order: Order) => {
    setPrintOrder(order)
    setTimeout(() => {
      window.print()
    }, 200)
  }

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewOrder) return
    setSubmittingReview(true)
    try {
      await postStoreReview(reviewOrder.storeId, {
        rating: reviewRating,
        comment: reviewComment,
        orderId: reviewOrder.id,
      })
      addToast('Thank you for rating the store!', 'success')
      setReviewOrder(null)
      setReviewComment('')
      setReviewRating(5)
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to submit review', 'error')
    } finally {
      setSubmittingReview(false)
    }
  }

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">My Orders 📋</h1>
        <p className="page-subtitle">Track your food rescue reservations, print pickup QR slips, and review stores.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }} className="text-muted">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div style={{ fontWeight: 600 }}>No orders yet</div>
          <div className="text-sm">Reserve discounted items from the feed to rescue food.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {orders.map((o) => (
            <div key={o.id} className="card card-body" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
                  <OrderStatusBadge status={o.status} />
                  <span className="text-sm text-muted">Order #{o.id ? o.id.slice(-8) : "N/A"}</span>
                </div>
                <div className="font-bold" style={{ fontSize: "1.15rem", color: "var(--text-main)" }}>
                  {o.productName ? `${o.productName} 🍎` : `Produce Batch #${o.batchId ? o.batchId.slice(-6) : "Rescue"}`}
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                  Store: <strong>{o.storeId || "Local Store"}</strong>
                </div>
                <div className="text-sm" style={{ marginTop: 6 }}>
                  Qty: <strong>{o.quantity} {o.unit || "kg/units"}</strong> · Total Price: <strong className="text-accent">₹{o.priceAtOrder?.toFixed(2)}</strong>
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                  Reserved: {new Date(o.reservedAt).toLocaleString()}
                </div>

                {o.status === "RESERVED" && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
                    <CountdownTimer expiresAt={o.holdExpiresAt} />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handlePrint(o)}
                    >
                      🖨️ Print Slip / QR
                    </button>
                  </div>
                )}

                {o.status === "FULFILLED" && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="text-xs text-accent">✓ Fulfilled at {new Date(o.fulfilledAt || o.reservedAt).toLocaleTimeString()}</span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setReviewOrder(o)}
                      style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                    >
                      ⭐ Rate Store
                    </button>
                  </div>
                )}
              </div>

              {o.qrCode && o.status === "RESERVED" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div className="qr-container" style={{ border: "2px solid var(--accent-glow)" }}>
                    <QRCodeSVG value={o.qrCode} size={110} />
                  </div>
                  <span className="text-xs text-muted">Show at counter</span>
                  {o.holdExpiresAt && <CountdownTimer expiresAt={o.holdExpiresAt} />}
                </div>
              )}
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Store Modal */}
      {reviewOrder && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16
        }}>
          <div className="card card-body" style={{ maxWidth: 440, width: "100%", background: "var(--surface)" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>Rate Store Experience ⭐</h3>
            <p className="text-xs text-muted" style={{ marginBottom: 16 }}>
              Order #{reviewOrder.id.slice(-8)} · Store {reviewOrder.storeId}
            </p>

            <form onSubmit={handleReviewSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="text-xs text-muted font-semibold">Your Rating</label>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn${reviewRating >= star ? " active" : ""}`}
                      onClick={() => setReviewRating(star)}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted font-semibold">Feedback Comment</label>
                <textarea
                  className="w-full mt-2"
                  style={{ padding: "10px 14px", minHeight: 70 }}
                  placeholder="How was the food quality, pickup speed, and store staff?"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-between gap-3" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setReviewOrder(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingReview}
                >
                  {submittingReview ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Pickup Slip */}
      {printOrder && (
        <div className="print-slip" style={{ textAlign: "center", fontFamily: "sans-serif" }}>
          <h2>🌿 FreshRescue — Pickup Order Slip</h2>
          <p>Bring this slip or present the QR code at the counter to claim your rescued item.</p>
          <hr style={{ margin: "16px 0" }} />
          <div style={{ margin: "24px 0", display: "inline-block" }}>
            <QRCodeSVG value={printOrder.qrCode} size={220} />
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>Order Code: {printOrder.id}</div>
          <div style={{ margin: "8px 0" }}>Store ID: {printOrder.storeId}</div>
          <div>Quantity: {printOrder.quantity} · Price: ₹{printOrder.priceAtOrder.toFixed(2)}</div>
          <div style={{ marginTop: 12, color: "#666", fontSize: "0.9rem" }}>
            Reserved at: {new Date(printOrder.reservedAt).toLocaleString()}
          </div>
          <div style={{ color: "#d00", fontWeight: "bold", marginTop: 4 }}>
            Hold Expires at: {new Date(printOrder.holdExpiresAt).toLocaleString()}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
