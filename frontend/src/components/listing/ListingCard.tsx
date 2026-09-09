import React, { useState } from "react"
import type { Listing } from "../../types"
import TierBadge from "../shared/TierBadge"
import StoreReviewsModal from "../shared/StoreReviewsModal"

interface Props {
  listing: Listing
  onReserve: (listing: Listing) => void
}

const CATEGORY_EMOJI: Record<string, string> = {
  fruit: "🍎", vegetable: "🥦", dairy: "🥛", bakery: "🍞",
  meat: "🥩", seafood: "🐟", beverage: "🧃", snack: "🍿", default: "🛒",
}

export default function ListingCard({ listing, onReserve }: Props) {
  const [imgError, setImgError] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const emoji = CATEGORY_EMOJI[listing.category?.toLowerCase()] ?? CATEGORY_EMOJI.default

  return (
    <>
      <div className="listing-card" onClick={() => {}} style={{ display: "flex", flexDirection: "column" }}>
        {listing.imageUrl && !imgError ? (
          <img
            className="listing-card-img"
            src={listing.imageUrl}
            alt={listing.productName}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="listing-card-img-placeholder">{emoji}</div>
        )}

        <div className="listing-card-body" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="flex items-center justify-between gap-2">
            <TierBadge tier={listing.tier} />
            {listing.urgent && <span className="badge badge-urgent">🔥 Urgent</span>}
          </div>

          <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: 4 }}>{listing.productName}</div>
          
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted truncate" style={{ maxWidth: "65%" }}>{listing.storeName}</span>
            <button
              type="button"
              className="btn-ghost"
              onClick={(e) => { e.stopPropagation(); setShowReviews(true) }}
              style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: 4, color: "var(--accent)" }}
            >
              ⭐ Reviews
            </button>
          </div>

          <div className="listing-price-row">
            <span className="listing-current-price">₹{listing.currentPrice.toFixed(2)}</span>
            <span className="listing-original-price">₹{listing.originalPrice.toFixed(2)}</span>
            <span className="discount-chip">-{listing.discountPercent}%</span>
          </div>

          <div className="text-xs text-muted">
            {listing.quantityAvailable} {listing.unit} available
          </div>

          <div style={{ marginTop: "auto", paddingTop: 12 }}>
            <button
              id={`reserve-${listing.id}`}
              className="btn btn-primary w-full btn-sm"
              onClick={(e) => { e.stopPropagation(); onReserve(listing) }}
              disabled={listing.quantityAvailable <= 0}
            >
              {listing.quantityAvailable <= 0 ? "Out of stock" : "Reserve Now"}
            </button>
          </div>
        </div>
      </div>

      {showReviews && (
        <StoreReviewsModal
          storeId={listing.storeId}
          storeName={listing.storeName}
          onClose={() => setShowReviews(false)}
        />
      )}
    </>
  )
}
