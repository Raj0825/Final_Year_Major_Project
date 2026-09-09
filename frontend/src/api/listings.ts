import api from './client'
import type { Listing } from '../types'

export const getAllListings = () =>
  api.get<Listing[]>('/listings').then((r) => r.data)

export const getNearbyListings = (lat: number, lng: number, radiusKm = 5) =>
  api
    .get<Listing[]>('/listings/nearby', { params: { lat, lng, radiusKm } })
    .then((r) => r.data)

export const getUrgentListings = () =>
  api.get<Listing[]>('/listings/urgent').then((r) => r.data)
