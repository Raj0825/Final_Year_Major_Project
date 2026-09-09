export interface User {
  userId: string
  name: string
  role: Role
  token: string
  storeId?: string
}

export type Role = 'STORE_MANAGER' | 'STORE_STAFF' | 'NGO' | 'CUSTOMER'

export interface Batch {
  id: string
  storeId: string
  productName: string
  category: string
  quantity: number
  unit: string
  stockedAt: string
  originalPrice: number
  imageUrls: string[]
  freshnessScore?: number
  predictedExpiryDate?: string
  ocrExtractedDate?: string
  needsManualReview: boolean
  state: BatchState
  currentDiscountPercent?: number
  quantityReserved: number
  createdAt: string
  updatedAt: string
}

export type BatchState = 'FRESH' | 'TIER_1' | 'TIER_2' | 'TIER_3' | 'EXPIRED'

export interface Listing {
  id: string
  batchId: string
  storeId: string
  storeName: string
  storeLocation: { type: string; coordinates: [number, number] }
  productName: string
  category: string
  imageUrl?: string
  originalPrice: number
  currentPrice: number
  discountPercent: number
  quantityAvailable: number
  unit: string
  tier: BatchState
  urgent: boolean
  listedAt: string
  updatedAt: string
  distance?: number
}

export interface Order {
  id: string
  listingId: string
  batchId: string
  storeId: string
  buyerId: string
  buyerType: 'NGO' | 'CUSTOMER'
  quantity: number
  priceAtOrder: number
  status: OrderStatus
  qrCode: string
  reservedAt: string
  holdExpiresAt: string
  fulfilledAt?: string
}

export type OrderStatus = 'RESERVED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED_HOLD'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}
