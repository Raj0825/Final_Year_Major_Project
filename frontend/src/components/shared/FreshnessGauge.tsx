import React from "react"

interface Props { score: number; size?: number }

export default function FreshnessGauge({ score, size = 120 }: Props) {
  const r = 45
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, score))
  const dash = pct * circ

  let color = "#39d353"
  if (pct < 0.3) color = "#f78166"
  else if (pct < 0.5) color = "#f7c948"
  else if (pct < 0.7) color = "#a5d96a"

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="freshness-ring"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: "stroke-dasharray 0.6s ease" }}
        />
        <text x="50" y="56" textAnchor="middle" fontSize="18" fontWeight="800" fill={color}>
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <span className="text-xs text-muted font-medium">Freshness Score</span>
    </div>
  )
}
