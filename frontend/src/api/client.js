import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
})

client.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('access_token')
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let refreshPromise = null

function forceLogout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  window.dispatchEvent(new Event('auth:logout'))
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }
  const { data } = await axios.post('/api/token/refresh/', { refresh: refreshToken })
  localStorage.setItem('access_token', data.access)
  if (data.refresh) {
    localStorage.setItem('refresh_token', data.refresh)
  }
  return data.access
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error
    if (response?.status === 401 && !config._retry) {
      config._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null
          })
        }
        const newAccessToken = await refreshPromise
        config.headers.Authorization = `Bearer ${newAccessToken}`
        return client(config)
      } catch (refreshError) {
        forceLogout()
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

export default client
