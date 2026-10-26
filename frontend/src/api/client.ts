import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fr_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = (err.config?.url ?? '')
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/signup')
    const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('fr_token')

    if (err.response?.status === 401 && !isAuthEndpoint && hasToken) {
      localStorage.removeItem('fr_token')
      localStorage.removeItem('fr_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
