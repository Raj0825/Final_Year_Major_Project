import React, { useState } from "react"
import { fulfillOrder } from "../api/orders"
import AppLayout from "../components/layout/AppLayout"
import { useToast } from "../context/ToastContext"
import type { Order } from "../types"

export default function StoreFulfillOrdersPage() {
  const { addToast } = useToast()
  const [orderId, setOrderId] = useState("")
  const [qrCode, setQrCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [fulfilled, setFulfilled] = useState<Order | null>(null)

  async function handleFulfill(e: React.FormEvent) {
    e.preventDefault()
    if (!orderId.trim() || !qrCode.trim()) return
    setLoading(true)
    try {
      const result = await fulfillOrder(orderId, qrCode)
      setFulfilled(result)
      addToast("Order fulfilled successfully! ✅", "success")
      setOrderId("")
      setQrCode("")
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.response?.data ?? "Fulfillment failed"
      addToast(typeof msg === "string" ? msg : "Invalid QR code or order ID", "error")
    } finally { setLoading(false) }
  }

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Fulfill Orders 📦</h1>
        <p className="page-subtitle">Enter the order ID and scan the customer&apos;s QR code to complete pickup.</p>
      </div>

      <div style={{ maxWidth: 520 }}>
        <div className="card card-body" style={{ marginBottom: 24 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Scan QR Code</h3>
          <form onSubmit={handleFulfill} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Order ID</label>
              <input
                id="fulfill-order-id"
                className="form-input"
                placeholder="Enter order ID"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">QR Code Value</label>
              <input
                id="fulfill-qr-code"
                className="form-input"
                placeholder="Scan or paste QR code"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                required
              />
              <span className="text-xs text-muted">Use a barcode scanner or manually paste the code value.</span>
            </div>
            <button id="fulfill-submit" className="btn btn-primary btn-lg" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : "✓ Mark as Fulfilled"}
            </button>
          </form>
        </div>

        {fulfilled && (
          <div className="alert alert-success">
            <div>
              <div style={{ fontWeight: 700 }}>Order fulfilled!</div>
              <div className="text-sm" style={{ marginTop: 4 }}>
                Order #{fulfilled.id.slice(-8)} · {fulfilled.quantity} items · ₹{fulfilled.priceAtOrder.toFixed(2)}
              </div>
              {fulfilled.fulfilledAt && (
                <div className="text-sm" style={{ marginTop: 4 }}>
                  At: {new Date(fulfilled.fulfilledAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="card card-body" style={{ marginTop: 24 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>How it works</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { icon: "1️⃣", text: "Customer reserves a listing and receives a QR code." },
              { icon: "2️⃣", text: "Customer arrives at the store within the 15-minute hold window." },
              { icon: "3️⃣", text: "Staff enters the order ID + scans/pastes the QR code above." },
              { icon: "4️⃣", text: "Order is marked fulfilled and inventory updated automatically." },
            ].map(({ icon, text }) => (
              <div key={icon} className="flex gap-3 items-center">
                <span style={{ fontSize: "1.2rem" }}>{icon}</span>
                <span className="text-sm text-muted">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

