import api from './client'
import type { Order } from '../types'

export const reserveListing = (listingId: string, quantity: number) =>
  api
    .post<Order>('/orders/reserve', { listingId, quantity })
    .then((r) => r.data)

export const fulfillOrder = (orderId: string, qrCode?: string) =>
  api
    .post<Order>(`/orders/${orderId}/fulfill`, { qrCode: qrCode || orderId })
    .then((r) => r.data)

export const fulfillOrderByCode = (code: string) =>
  api
    .post<Order>('/orders/fulfill-code', { code })
    .then((r) => r.data)

export const getMyOrders = () =>
  api.get<Order[]>('/orders/my-orders').then((r) => r.data)

export const getStoreOrders = (storeId?: string) =>
  api.get<Order[]>(storeId ? `/orders/store/${storeId}` : '/orders/store').then((r) => r.data)

export const getPendingStoreOrders = () =>
  api.get<Order[]>('/orders/store/pending').then((r) => r.data)
