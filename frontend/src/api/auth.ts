import api from './client'

export interface SignupRequest {
  name: string
  email: string
  password: string
  role: string
  storeId?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  userId: string
  name: string
  role: string
  storeId?: string   // present for STORE_MANAGER / STORE_STAFF
}

export const signup = (data: SignupRequest) =>
  api.post<AuthResponse>('/auth/signup', data).then((r) => r.data)

export const login = (data: LoginRequest) =>
  api.post<AuthResponse>('/auth/login', data).then((r) => r.data)