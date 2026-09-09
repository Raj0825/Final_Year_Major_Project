import React from "react"
import type { BatchState } from "../../types"

const TIER_MAP: Record<BatchState, { className: string; label: string; discount?: string }> = {
  FRESH:   { className: "badge badge-fresh",   label: "Fresh" },
  TIER_1:  { className: "badge badge-tier-1",  label: "Tier 1", discount: "20% off" },
  TIER_2:  { className: "badge badge-tier-2",  label: "Tier 2", discount: "40% off" },
  TIER_3:  { className: "badge badge-tier-3",  label: "Tier 3 🔥", discount: "60% off" },
  EXPIRED: { className: "badge badge-expired", label: "Expired" },
}

export default function TierBadge({ tier, showDiscount }: { tier: BatchState; showDiscount?: boolean }) {
  const t = TIER_MAP[tier]
  return (
    <span className={t.className}>
      {t.label}{showDiscount && t.discount ? ` — ${t.discount}` : ""}
    </span>
  )
}
