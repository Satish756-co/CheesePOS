import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const _base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const api = axios.create({
  baseURL: _base ? `${_base}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { refreshToken, logout, setToken } = useAuthStore.getState()
      if (refreshToken) {
        try {
          const res = await axios.post('/api/auth/refresh', {}, {
            headers: { Authorization: `Bearer ${refreshToken}` }
          })
          setToken(res.data.access_token)
          error.config.headers.Authorization = `Bearer ${res.data.access_token}`
          return axios(error.config)
        } catch {
          logout()
          window.location.href = '/login'
        }
      } else {
        logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
