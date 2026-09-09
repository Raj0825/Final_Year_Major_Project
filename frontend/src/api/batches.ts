import api from './client'
import type { Batch } from '../types'

export interface CreateBatchPayload {
  storeId: string
  productName: string
  category: string
  quantity: number
  unit: string
  stockedAt: string
  originalPrice: number
}

export const createBatch = (data: CreateBatchPayload) =>
  api.post<Batch>('/batches', data).then((r) => r.data)

export const getBatch = (id: string) =>
  api.get<Batch>(`/batches/${id}`).then((r) => r.data)

export const getBatchesForStore = (storeId: string) =>
  api.get<Batch[]>(`/batches/store/${storeId}`).then((r) => r.data)

export const scanBatch = (id: string, image: File) => {
  const form = new FormData()
  form.append('image', image)
  return api
    .post<Batch>(`/batches/${id}/scan`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)
}
