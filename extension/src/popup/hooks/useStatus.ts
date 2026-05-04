import { useState, useEffect } from 'react'
import { runtime, storage } from '@/lib/browser'
import { getAuthToken, requireAuthToken } from '@/utils/auth'
import { STORAGE_KEYS } from '@/utils/core/constants.util'

export function useStatus() {
  const [isConnected, setIsConnected] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingHealth, setIsCheckingHealth] = useState(true)
  const [lastCaptureTime, setLastCaptureTime] = useState<number | null>(null)
  const [dlpBlockCount, setDlpBlockCount] = useState<number>(0)
  const [dlpLastBlockedAt, setDlpLastBlockedAt] = useState<number | null>(null)

  const checkStatus = async () => {
    setIsCheckingHealth(true)
    try {
      const healthResponse = await new Promise<any>(resolve => {
        runtime.sendMessage({ type: 'CHECK_API_HEALTH' }, resolve)
      })
      if (healthResponse && healthResponse.success) {
        setIsConnected(healthResponse.healthy)
      } else {
        setIsConnected(false)
      }

      let isAuth = false
      try {
        const stored = await storage.local.get(['auth_token'])
        if (stored && stored.auth_token) {
          isAuth = true
        } else {
          const token = getAuthToken()
          if (token) {
            isAuth = true
          } else {
            try {
              await requireAuthToken()
              isAuth = true
            } catch {
              isAuth = false
            }
          }
        }
      } catch (_error) {
        isAuth = false
      }
      setIsAuthenticated(isAuth)
    } catch (_error) {
      setIsConnected(false)
      setIsAuthenticated(false)
    } finally {
      setIsCheckingHealth(false)
    }
  }

  const loadLastCaptureTime = async () => {
    try {
      const stored = await storage.local.get(['last_capture_time'])
      if (stored?.last_capture_time) {
        setLastCaptureTime(stored.last_capture_time)
      }
    } catch (_error) {
      // Ignore
    }
  }

  const loadDlpStatus = async () => {
    try {
      const stored = await storage.local.get([
        STORAGE_KEYS.DLP_BLOCK_COUNT,
        STORAGE_KEYS.DLP_LAST_BLOCKED_AT,
      ])
      const count = stored?.[STORAGE_KEYS.DLP_BLOCK_COUNT]
      const last = stored?.[STORAGE_KEYS.DLP_LAST_BLOCKED_AT]
      setDlpBlockCount(typeof count === 'number' ? count : 0)
      setDlpLastBlockedAt(typeof last === 'number' ? last : null)
    } catch (_error) {
      // Ignore
    }
  }

  useEffect(() => {
    checkStatus()
    loadLastCaptureTime()
    loadDlpStatus()
    const interval = setInterval(() => {
      checkStatus()
      loadLastCaptureTime()
      loadDlpStatus()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  return {
    isConnected,
    isAuthenticated,
    isCheckingHealth,
    lastCaptureTime,
    dlpBlockCount,
    dlpLastBlockedAt,
    refreshStatus: checkStatus,
  }
}
