import React from "react"
import type { OrderStatus } from "../../types"

const MAP: Record<OrderStatus, { cls: string; label: string }> = {
  RESERVED:     { cls: "badge badge-reserved",     label: "Reserved" },
  FULFILLED:    { cls: "badge badge-fulfilled",    label: "Fulfilled ✓" },
  CANCELLED:    { cls: "badge badge-cancelled",    label: "Cancelled" },
  EXPIRED_HOLD: { cls: "badge badge-expired-hold", label: "Expired Hold" },
}

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const m = MAP[status]
  return <span className={m.cls}>{m.label}</span>
}
