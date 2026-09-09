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
