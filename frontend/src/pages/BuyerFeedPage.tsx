import React, { useState, useEffect, useCallback } from "react"
import { getNearbyListings, getUrgentListings } from "../api/listings"
import type { Listing } from "../types"
import ListingCard from "../components/listing/ListingCard"
import ReserveModal from "../components/listing/ReserveModal"
import { SkeletonCard } from "../components/shared/Skeleton"
import AppLayout from "../components/layout/AppLayout"

const CATEGORIES = ["All", "Fruit", "Vegetable", "Dairy", "Bakery", "Meat", "Seafood", "Beverage", "Snack"]

export default function BuyerFeedPage() {
  const [tab, setTab] = useState<"nearby" | "urgent">("nearby")
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [radius, setRadius] = useState(5)
  const [category, setCategory] = useState("All")
  const [search, setSearch] = useState("")
  const [reserving, setReserving] = useState<Listing | null>(null)
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (tab === "nearby") {
      navigator.geolocation?.getCurrentPosition(
        (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setPos({ lat: 28.6139, lng: 77.209 }) // Default: Delhi
      )
    }
  }, [tab])

  const fetchListings = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      let data: Listing[]
      if (tab === "nearby" && pos) {
        data = await getNearbyListings(pos.lat, pos.lng, radius)
      } else if (tab === "urgent") {
        data = await getUrgentListings()
      } else {
        data = []
      }
      setListings(data)
    } catch {
      setError("Failed to load listings. Is the backend running?")
    } finally {
      setLoading(false)
    }
  }, [tab, pos, radius])

  useEffect(() => { fetchListings() }, [fetchListings])

  const filtered = listings.filter((l) => {
    const matchCat = category === "All" || l.category?.toLowerCase() === category.toLowerCase()
    const matchSearch = !search || l.productName?.toLowerCase().includes(search.toLowerCase()) || l.storeName?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Browse Listings 🛒</h1>
        <p className="page-subtitle">Rescue near-expiry produce at up to 60% off before it goes to waste.</p>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ maxWidth: 320, marginBottom: 24 }}>
        <button id="tab-nearby" className={`tab${tab === "nearby" ? " active" : ""}`} onClick={() => setTab("nearby")}>📍 Nearby</button>
        <button id="tab-urgent" className={`tab${tab === "urgent" ? " active" : ""}`} onClick={() => setTab("urgent")}>🔥 Urgent</button>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              id="search-listings"
              className="form-input"
              placeholder="Search by product or store…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {tab === "nearby" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span className="text-sm text-muted">Radius:</span>
              <input
                id="radius-slider"
                type="range" min={1} max={20} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                style={{ width: 100 }}
              />
              <span className="text-sm font-medium">{radius} km</span>
            </div>
          )}
        </div>

        <div className="filter-bar">
          {CATEGORIES.map((c) => (
            <button key={c} className={`filter-chip${category === c ? " active" : ""}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
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
                <div className="text-sm">Try expanding your radius or clearing filters.</div>
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

