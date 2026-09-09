import api from './client'
import type { Order } from '../types'

export const reserveListing = (listingId: string, quantity: number) =>
  api
    .post<Order>('/orders/reserve', { listingId, quantity })
    .then((r) => r.data)

export const fulfillOrder = (orderId: string, qrCode: string) =>
  api
    .post<Order>(`/orders/${orderId}/fulfill`, { qrCode })
    .then((r) => r.data)

export const getMyOrders = () =>
  api.get<Order[]>('/orders/my-orders').then((r) => r.data)

export const getStoreOrders = (storeId?: string) =>
  api.get<Order[]>(storeId ? `/orders/store/${storeId}` : '/orders/store').then((r) => r.data)
