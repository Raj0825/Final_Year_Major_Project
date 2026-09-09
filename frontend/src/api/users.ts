import api from './client'
import type { UserProfile } from '../types'

export interface UpdateProfilePayload {
  name?: string
  notificationRadiusKm?: number
  preferredCategories?: string[]
  latitude?: number
  longitude?: number
  storeId?: string
}

export const getMyProfile = () =>
  api.get<UserProfile>('/users/me').then((r) => r.data)

export const updateMyProfile = (payload: UpdateProfilePayload) =>
  api.patch<UserProfile>('/users/me', payload).then((r) => r.data)
