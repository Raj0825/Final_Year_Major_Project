import React, { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { fulfillOrderByCode, getStoreOrders, getPendingStoreOrders } from "../api/orders"
import AppLayout from "../components/layout/AppLayout"
import { useToast } from "../context/ToastContext"
import { useAuth } from "../context/AuthContext"
import type { Order } from "../types"
import OrderStatusBadge from "../components/shared/OrderStatusBadge"

export default function StoreFulfillOrdersPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { user } = useAuth()
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [fulfilled, setFulfilled] = useState<Order | null>(null)
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  const loadOrders = useCallback(async () => {
    try {
      // 1. Fetch pending orders using comprehensive manager batch & store resolver
      const orders = await getPendingStoreOrders()
      setPendingOrders(orders)
    } catch {
      // Fallback
      try {
        const fallback = await getStoreOrders(user?.storeId)
        setPendingOrders(fallback.filter((o) => o.status === "RESERVED"))
      } catch {}
    } finally {
      setLoadingOrders(false)
    }
  }, [user?.storeId])

  useEffect(() => {
    loadOrders()
    const handleFocus = () => loadOrders()
    window.addEventListener("focus", handleFocus)
    const interval = setInterval(loadOrders, 5000)
    return () => {
      window.removeEventListener("focus", handleFocus)
      clearInterval(interval)
    }
  }, [loadOrders])

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setCode(text.trim())
        addToast("Pasted from clipboard!", "info")
      }
    } catch (err: any) {
      addToast("Clipboard permission required or unavailable", "error")
    }
  }

  async function executeFulfill(targetCode: string) {
    if (!targetCode.trim()) return
    setLoading(true)
    try {
      const result = await fulfillOrderByCode(targetCode.trim())
      setFulfilled(result)
      addToast(`Order #${result.id.slice(-8)} fulfilled successfully! 🎉`, "success")
      setCode("")
      loadOrders()
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.response?.data ?? "Fulfillment failed"
      addToast(typeof msg === "string" ? msg : "Invalid QR code or order ID", "error")
    } finally {
      setLoading(false)
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    executeFulfill(code)
  }

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Fulfill Orders 📦</h1>
        <p className="page-subtitle">Scan, paste the customer&apos;s pickup QR code, or fulfill directly from the pending list.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24, marginBottom: 32 }}>
        {/* Left: QR / Code Scanner & Input */}
        <div className="card card-body">
          <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 16 }}>
            🔍 Scan or Paste Pickup Code
          </h3>

          <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">QR Code Value or Order ID</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="fulfill-code-input"
                  className="form-input"
                  placeholder="Paste QR UUID or Order ID here..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handlePasteClipboard}
                  title="Paste from clipboard"
                  style={{ flexShrink: 0 }}
                >
                  📋 Paste
                </button>
              </div>
              <span className="text-xs text-muted" style={{ marginTop: 6 }}>
                Accepts any scanned QR code string or short/full Order ID.
              </span>
            </div>

            <button
              id="fulfill-submit"
              className="btn btn-primary btn-lg w-full"
              type="submit"
              disabled={loading || !code.trim()}
            >
              {loading ? <span className="spinner" /> : "✓ Verify & Mark Fulfilled"}
            </button>
          </form>

          {fulfilled && (
            <div className="alert alert-success" style={{ marginTop: 20 }}>
              <div style={{ width: "100%" }}>
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>✅ Pickup Complete & Stock Deducted!</div>
                <div className="text-sm" style={{ marginTop: 4 }}>
                  Order #{fulfilled.id.slice(-8)} · Fulfilled <strong>{fulfilled.quantity} units/kg</strong> · Collected: ₹{fulfilled.priceAtOrder?.toFixed(2)}
                </div>
                <div className="text-xs" style={{ marginTop: 4, color: "#166534" }}>
                  📉 The batch quantity in your Store Dashboard has been reduced by <strong>{fulfilled.quantity}</strong>.
                </div>
                {fulfilled.fulfilledAt && (
                  <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                    Timestamp: {new Date(fulfilled.fulfilledAt).toLocaleTimeString()}
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate("/store/dashboard")}
                    style={{ background: "#fff", borderColor: "#86efac", color: "#166534" }}
                  >
                    🏪 View Updated Stock in Dashboard →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: How pickup works */}
        <div className="card card-body">
          <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 16 }}>
            📋 Pickup Instructions
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { icon: "📱", text: "Customer presents the QR code on their phone or printable pickup slip." },
              { icon: "⚡", text: "Scan with a handheld barcode scanner, or paste the QR code string into the box." },
              { icon: "✅", text: "Click 'Verify & Mark Fulfilled' (or click 'Fulfill' in the pending table below)." },
              { icon: "📦", text: "Hand over the rescued food items to the customer!" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex gap-3 items-center">
                <span style={{ fontSize: "1.3rem" }}>{icon}</span>
                <span className="text-sm text-muted">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Pickup Orders Table */}
      <div className="card card-body">
        <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              ⏳ Pending Reservations ({pendingOrders.length})
            </h3>
            <p className="text-xs text-muted">Customers currently holding orders for pickup at your store.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadOrders}>
            🔄 Refresh List
          </button>
        </div>

        {loadingOrders ? (
          <div style={{ textAlign: "center", padding: 32 }} className="text-muted">Loading orders...</div>
        ) : pendingOrders.length === 0 ? (
          <div className="empty-state" style={{ padding: 36 }}>
            <div className="empty-state-icon">🎉</div>
            <div style={{ fontWeight: 600 }}>No pending reservations</div>
            <div className="text-sm">All customer reservations have been fulfilled or expired.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Total Price</th>
                  <th>Reserved At</th>
                  <th>Hold Expires</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="font-semibold">#{o.id.slice(-8)}</div>
                      <div className="text-xs text-muted truncate" style={{ maxWidth: 120 }}>
                        QR: {o.qrCode ? o.qrCode.slice(0, 8) + "..." : "—"}
                      </div>
                    </td>
                    <td>
                      <div className="font-semibold" style={{ fontSize: "0.95rem" }}>
                        {o.productName ? `${o.productName} 🍎` : `Produce #${o.id.slice(-6)}`}
                      </div>
                      <div className="text-xs text-muted">Store: {o.storeId || "Active"}</div>
                    </td>
                    <td>
                      <strong>{o.quantity} {o.unit || "units"}</strong>
                    </td>
                    <td><strong className="text-accent">₹{o.priceAtOrder?.toFixed(2)}</strong></td>
                    <td className="text-xs text-muted">{new Date(o.reservedAt).toLocaleTimeString()}</td>
                    <td className="text-xs" style={{ color: "var(--urgent)", fontWeight: 600 }}>
                      {new Date(o.holdExpiresAt).toLocaleTimeString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => executeFulfill(o.qrCode || o.id)}
                        disabled={loading}
                      >
                        ✓ Fulfill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
