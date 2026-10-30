import api from './client'
import type { WatchItem } from '../types'

export interface CreateWatchPayload {
  keyword: string
  category?: string
  maxPrice?: number
  radiusKm?: number
}

export const getWatchlist = () =>
  api.get<WatchItem[]>('/watchlist').then((r) => r.data)

export const createWatch = (data: CreateWatchPayload) =>
  api.post<WatchItem>('/watchlist', data).then((r) => r.data)

export const deleteWatch = (id: string) =>
  api.delete(`/watchlist/${id}`).then((r) => r.data)

