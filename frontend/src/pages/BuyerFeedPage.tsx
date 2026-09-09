import React, { useState, useEffect, useCallback } from "react"
import { getNearbyListings, getUrgentListings, getAllListings } from "../api/listings"
import type { Listing } from "../types"
import ListingCard from "../components/listing/ListingCard"
import ReserveModal from "../components/listing/ReserveModal"
import { SkeletonCard } from "../components/shared/Skeleton"
import AppLayout from "../components/layout/AppLayout"

const CATEGORIES = ["All", "Fruit", "Vegetable", "Dairy", "Bakery", "Meat", "Seafood", "Beverage", "Snack"]
const TIERS = ["All", "TIER_1", "TIER_2", "TIER_3"]

export default function BuyerFeedPage() {
  const [tab, setTab] = useState<"all" | "nearby" | "urgent">("all")
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [radius, setRadius] = useState(10)
  const [category, setCategory] = useState("All")
  const [search, setSearch] = useState("")
  const [tierFilter, setTierFilter] = useState("All")
  const [maxPrice, setMaxPrice] = useState<number>(1000)
  const [minDiscount, setMinDiscount] = useState<number>(0)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [reserving, setReserving] = useState<Listing | null>(null)
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (tab === "nearby") {
      navigator.geolocation?.getCurrentPosition(
        (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setPos({ lat: 28.6139, lng: 77.209 }) // Default
      )
    }
  }, [tab])

  const fetchListings = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      let data: Listing[] = []
      if (tab === "nearby" && pos) {
        try {
          data = await getNearbyListings(pos.lat, pos.lng, radius)
        } catch {
          data = await getAllListings()
        }
        if (!data || data.length === 0) {
          data = await getAllListings()
        }
      } else if (tab === "urgent") {
        data = await getUrgentListings()
      } else {
        data = await getAllListings()
      }
      setListings(data || [])
    } catch {
      try {
        const fallback = await getAllListings()
        setListings(fallback || [])
      } catch {
        setError("Failed to load listings. Please ensure the backend is running.")
      }
    } finally {
      setLoading(false)
    }
  }, [tab, pos, radius])

  useEffect(() => { fetchListings() }, [fetchListings])

  const filtered = listings.filter((l) => {
    const matchCat = category === "All" || l.category?.toLowerCase() === category.toLowerCase()
    const matchSearch = !search ||
      l.productName?.toLowerCase().includes(search.toLowerCase()) ||
      l.storeName?.toLowerCase().includes(search.toLowerCase())
    const matchTier = tierFilter === "All" || l.tier === tierFilter
    const matchPrice = l.currentPrice <= maxPrice
    const matchDiscount = l.discountPercent >= minDiscount
    return matchCat && matchSearch && matchTier && matchPrice && matchDiscount
  })

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Browse Listings 🛒</h1>
        <p className="page-subtitle">Rescue near-expiry produce at up to 60% off before it goes to waste.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div className="tabs" style={{ maxWidth: 420 }}>
          <button id="tab-all" className={`tab${tab === "all" ? " active" : ""}`} onClick={() => setTab("all")}>🌟 All Deals</button>
          <button id="tab-nearby" className={`tab${tab === "nearby" ? " active" : ""}`} onClick={() => setTab("nearby")}>📍 Nearby</button>
          <button id="tab-urgent" className={`tab${tab === "urgent" ? " active" : ""}`} onClick={() => setTab("urgent")}>🔥 Urgent</button>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? "▲ Hide Filters" : "⚙️ Advanced Filters"}
        </button>
      </div>

      {/* Main Search & Distance */}
      <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              id="search-listings"
              className="form-input"
              placeholder="Search by product or store name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {tab === "nearby" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span className="text-sm text-muted">Radius:</span>
              <input
                id="radius-slider"
                type="range" min={1} max={30} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                style={{ width: 90 }}
              />
              <span className="text-sm font-medium">{radius} km</span>
            </div>
          )}
        </div>

        {/* Categories Bar */}
        <div className="filter-bar">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`filter-chip${category === c ? " active" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Advanced Filters Panel */}
        {showAdvanced && (
          <div className="card card-body" style={{ background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>Max Price:</span>
                  <span className="text-accent font-bold">₹{maxPrice}</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={2000}
                  step={20}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>Min Discount:</span>
                  <span className="text-accent font-bold">{minDiscount}%+</span>
                </div>
                <div className="flex gap-2">
                  {[0, 20, 40, 50].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`filter-chip${minDiscount === d ? " active" : ""}`}
                      onClick={() => setMinDiscount(d)}
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      {d === 0 ? "Any" : `${d}%+`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold mb-2">Urgency / Decay Tier:</div>
                <div className="flex gap-2">
                  {TIERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`filter-chip${tierFilter === t ? " active" : ""}`}
                      onClick={() => setTierFilter(t)}
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      {t.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 24 }}>⚠️ {error}</div>
      )}

      {/* Count */}
      {!loading && !error && (
        <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
          {filtered.length} listing{filtered.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Grid */}
      <div className="grid-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.length === 0
          ? (
            <div style={{ gridColumn: "1/-1" }}>
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <div style={{ fontWeight: 600 }}>No listings found</div>
                <div className="text-sm">Try expanding your radius or relaxing price/discount filters.</div>
              </div>
            </div>
          )
          : filtered.map((l) => (
            <ListingCard key={l.id} listing={l} onReserve={setReserving} />
          ))
        }
      </div>

      {reserving && (
        <ReserveModal
          listing={reserving}
          onClose={() => setReserving(null)}
          onSuccess={() => { setReserving(null); fetchListings() }}
        />
      )}
    </AppLayout>
  )
}
