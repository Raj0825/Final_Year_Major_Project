import React from "react"

export function SkeletonText({ width = "100%", height = 16 }: { width?: string | number; height?: number }) {
  return <div className="skeleton" style={{ width, height, borderRadius: 4 }} />
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="skeleton" style={{ height: 180, borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }} />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <SkeletonText width="60%" height={14} />
        <SkeletonText width="40%" height={20} />
        <SkeletonText width="80%" height={12} />
      </div>
    </div>
  )
}
