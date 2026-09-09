import api from './client'
import type { Store, Review, StoreAnalytics } from '../types'

export interface CreateStorePayload {
  name: string
  address: string
  phone?: string
  latitude?: number
  longitude?: number
}

export interface CreateReviewPayload {
  rating: number
  comment: string
  orderId?: string
}

export const registerStore = (payload: CreateStorePayload) =>
  api.post<Store>('/stores', payload).then((r) => r.data)

export const getAllStores = () =>
  api.get<Store[]>('/stores').then((r) => r.data)

export const getMyStore = () =>
  api.get<Store>('/stores/my-store').then((r) => r.data)

export const getStoreById = (id: string) =>
  api.get<Store>(`/stores/${id}`).then((r) => r.data)

export const getStoreReviews = (storeId: string) =>
  api.get<Review[]>(`/stores/${storeId}/reviews`).then((r) => r.data)

export const postStoreReview = (storeId: string, payload: CreateReviewPayload) =>
  api.post<Review>(`/stores/${storeId}/reviews`, payload).then((r) => r.data)

export const getStoreAnalytics = (storeId: string = 'me') =>
  api.get<StoreAnalytics>(`/stores/${storeId}/analytics`).then((r) => r.data)
