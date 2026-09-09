import React, { useEffect, useState } from "react"
import AppLayout from "../components/layout/AppLayout"
import OrderStatusBadge from "../components/shared/OrderStatusBadge"
import type { Order } from "../types"
import { QRCodeSVG } from "qrcode.react"

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

// In real app, fetch from /api/orders or store locally after reserve
// For now, we read from sessionStorage (orders are stored there after reserve)
export default function MyOrdersPage() {
  const [orders] = useState<Order[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("my_orders") ?? "[]") } catch { return [] }
  })

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">My Orders 📋</h1>
        <p className="page-subtitle">Track your reservations and pickup status.</p>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div style={{ fontWeight: 600 }}>No orders yet</div>
          <div className="text-sm">Reserve some listings from the feed to see them here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {orders.map((o) => (
            <div key={o.id} className="card card-body" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
                  <OrderStatusBadge status={o.status} />
                  <span className="text-sm text-muted">#{o.id.slice(-8)}</span>
                </div>
                <div className="font-bold">Listing: {o.listingId.slice(-10)}</div>
                <div className="text-sm text-muted">Qty: {o.quantity} · ₹{o.priceAtOrder.toFixed(2)}</div>
                <div className="text-sm text-muted" style={{ marginTop: 4 }}>
                  Reserved: {new Date(o.reservedAt).toLocaleString()}
                </div>
                {o.status === "RESERVED" && (
                  <div style={{ marginTop: 8 }}>
                    <CountdownTimer expiresAt={o.holdExpiresAt} />
                  </div>
                )}
                {o.fulfilledAt && (
                  <div className="text-sm" style={{ color: "var(--accent)", marginTop: 4 }}>
                    Fulfilled: {new Date(o.fulfilledAt).toLocaleString()}
                  </div>
                )}
              </div>
              {o.qrCode && o.status === "RESERVED" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div className="qr-container">
                    <QRCodeSVG value={o.qrCode} size={120} />
                  </div>
                  <span className="text-xs text-muted">Show at store</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}

