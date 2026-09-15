import { createContext, useEffect, useState, useCallback } from 'react'
import * as authApi from '../api/auth'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const bootstrap = useCallback(async () => {
    const accessToken = localStorage.getItem('access_token')
    if (!accessToken) {
      setUser(null)
      setIsLoading(false)
      return
    }
    try {
      const me = await authApi.fetchMe()
      setUser(me)
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  useEffect(() => {
    const handleForcedLogout = () => setUser(null)
    window.addEventListener('auth:logout', handleForcedLogout)
    return () => window.removeEventListener('auth:logout', handleForcedLogout)
  }, [])

  const login = useCallback(async (username, password) => {
    const { access, refresh } = await authApi.login(username, password)
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    const me = await authApi.fetchMe()
    setUser(me)
    return me
  }, [])

  const register = useCallback(
    async (fullName, username, email, password, confirmPassword) => {
      await authApi.register({ fullName, username, email, password, confirmPassword })
      return login(username, password)
    },
    [login]
  )

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await authApi.fetchMe()
    setUser(me)
    return me
  }, [])

  // Saves part of the signed-in user's own record. Applied up front, so a quick run of
  // changes (ticking several columns) each builds on the last rather than on whatever the
  // server had echoed back so far; if the save fails, the real record is fetched again.
  const updateMe = useCallback(async (payload) => {
    setUser((prev) => (prev ? { ...prev, ...payload } : prev))
    try {
      return await authApi.updateMe(payload)
    } catch (err) {
      setUser(await authApi.fetchMe())
      throw err
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, refreshUser, updateMe }}
    >
      {children}
    </AuthContext.Provider>
  )
}
