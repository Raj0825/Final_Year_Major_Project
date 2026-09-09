export interface User {
  userId: string
  name: string
  role: Role
  token: string
  storeId?: string
}

export type Role = 'STORE_MANAGER' | 'STORE_STAFF' | 'NGO' | 'CUSTOMER'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: Role
  storeId?: string
  notificationRadiusKm?: number
  preferredCategories?: string[]
  latitude?: number
  longitude?: number
}

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
  productName?: string
  unit?: string
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

export interface NotificationItem {
  id: string
  userId: string
  listingId?: string
  type: 'NEW_DISCOUNT' | 'PRICE_DROP' | 'URGENT' | 'ORDER_CONFIRMED' | 'PICKUP_REMINDER'
  message: string
  read: boolean
  createdAt: string
}

export interface Store {
  id: string
  name: string
  managerId: string
  address: string
  phone?: string
  location?: { type: string; coordinates: [number, number] }
  averageRating: number
  reviewCount: number
  createdAt: string
}

export interface Review {
  id: string
  storeId: string
  reviewerId: string
  reviewerName: string
  rating: number
  comment: string
  orderId?: string
  createdAt: string
}

export interface StoreAnalytics {
  storeId: string
  storeName: string
  totalBatches: number
  activeBatches: number
  expiredBatches: number
  activeListings: number
  totalOrders: number
  fulfilledOrders: number
  revenueRescued: number
  wastePreventedKg: number
  batchStateDistribution: Record<string, number>
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}
