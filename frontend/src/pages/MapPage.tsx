import React, { useEffect, useRef, useState } from "react"
import { getNearbyListings } from "../api/listings"
import type { Listing } from "../types"
import AppLayout from "../components/layout/AppLayout"

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [pos, setPos] = useState<{ lat: number; lng: number }>({ lat: 28.6139, lng: 77.209 })

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    )
  }, [])

  useEffect(() => {
    getNearbyListings(pos.lat, pos.lng, 20)
      .then(setListings)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [pos])

  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return
    import("leaflet").then((L) => {
      if (leafletRef.current) { leafletRef.current.remove() }
      const map = L.map(mapRef.current!).setView([pos.lat, pos.lng], 12)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map)

      // User marker
      L.circleMarker([pos.lat, pos.lng], { radius: 10, color: "#39d353", fillColor: "#39d353", fillOpacity: 0.8 })
        .addTo(map).bindPopup("📍 Your location")

      listings.forEach((l) => {
        if (!l.storeLocation?.coordinates) return
        const [lng, lat] = l.storeLocation.coordinates
        const color = l.urgent ? "#f78166" : "#f7c948"
        L.circleMarker([lat, lng], { radius: 8, color, fillColor: color, fillOpacity: 0.85 })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:160px;font-family:Inter,sans-serif">
              <strong>${l.productName}</strong><br/>
              <span style="color:#8b949e;font-size:.85em">${l.storeName}</span><br/>
              <span style="color:#39d353;font-weight:700">₹${l.currentPrice.toFixed(2)}</span>
              <span style="text-decoration:line-through;color:#6e7681;font-size:.85em;margin-left:6px">₹${l.originalPrice.toFixed(2)}</span>
              <br/><span style="font-size:.8em;color:#f7c948">-${l.discountPercent}% off</span>
              ${l.urgent ? "<br/><span style='color:#f78166;font-size:.8em'>🔥 Urgent pickup</span>" : ""}
            </div>
          `)
      })

      leafletRef.current = map
    })
    return () => { if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null } }
  }, [listings, pos])

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Map View 🗺️</h1>
        <p className="page-subtitle">Find rescue food near you — 🟢 your location, 🟡 discounted, 🔴 urgent.</p>
      </div>
      {loading && <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" style={{ margin: "auto" }} /></div>}
      <div ref={mapRef} className="map-container" style={{ height: "calc(100vh - 200px)" }} />
    </AppLayout>
  )
}

