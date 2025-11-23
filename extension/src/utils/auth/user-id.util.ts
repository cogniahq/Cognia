import { storage, cookies } from '@/lib/browser'
import { env } from '@/utils/core/env.util'

export function getAuthenticatedUserId(): string | null {
  try {
    const token = getAuthToken()
    if (!token) return null

    // Parse JWT token to get user ID
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.userId) {
        return payload.userId
      }
    } catch (_e) {
      // Invalid token format
    }
    return null
  } catch {
    return null
  }
}

export async function getUserId(): Promise<string> {
  const authUserId = getAuthenticatedUserId()
  if (authUserId) {
    return authUserId
  }

  try {
    const token = await getTokenFromCookie()
    if (token) {
      try {
        await storage.local.set({ auth_token: token })
      } catch (_e) {}

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('auth_token', token)
        }
      } catch (_e) {}

      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.userId) {
          return payload.userId
        }
      } catch (_e) {}
    }
  } catch (_e) {}

  throw new Error('User not authenticated. Please log in through the web client first.')
}

async function getTokenFromCookie(): Promise<string | null> {
  try {
    const cookieNames = ['cognia_session', 'cognia_session_dev']
    const apiUrl = await getApiBaseUrl()

    if (!apiUrl) {
      return null
    }

    const apiUrlObj = new URL(apiUrl)
    const domain = apiUrlObj.hostname
    const protocol = apiUrlObj.protocol
    const port = apiUrlObj.port

    const defaultPort = domain === 'localhost' || domain === '127.0.0.1' ? '3000' : port || ''
    const baseUrl = `${protocol}//${domain}${defaultPort ? `:${defaultPort}` : ''}`

    const urlsToTry = [
      baseUrl,
      `${baseUrl}/api`,
      `${baseUrl}/`,
      apiUrl,
      env.API_BASE_URL,
      `${env.API_BASE_URL}/api`,
      `${env.API_BASE_URL}/`,
      `http://127.0.0.1:3000`,
      `http://127.0.0.1:3000/api`,
      `http://127.0.0.1:3000/`,
    ]

    for (const cookieName of cookieNames) {
      for (const url of urlsToTry) {
        try {
          const cookie = await cookies.get({
            url: url,
            name: cookieName,
          })

          if (cookie?.value) {
            return cookie.value
          }
        } catch (_e) {}
      }
    }

    const domainsToTry = [domain, `.${domain}`, 'localhost', '.localhost', '127.0.0.1']

    for (const domainToTry of domainsToTry) {
      try {
        const allCookies = await cookies.getAll({
          domain: domainToTry,
        })

        if (allCookies && allCookies.length > 0) {
          for (const cookieName of cookieNames) {
            const sessionCookie = allCookies.find(c => c.name === cookieName)
            if (sessionCookie?.value) {
              return sessionCookie.value
            }
          }
        }
      } catch (_e) {}
    }

    try {
      const domainPattern = domain.startsWith('.') ? domain : `.${domain}`
      const allCookies = await cookies.getAll({
        domain: domainPattern,
      })

      if (allCookies && allCookies.length > 0) {
        for (const cookieName of cookieNames) {
          const sessionCookie = allCookies.find(c => c.name === cookieName)
          if (sessionCookie?.value) {
            return sessionCookie.value
          }
        }
      }
    } catch (_e) {}

    try {
      const allCookies = await cookies.getAll({})
      if (allCookies) {
        for (const cookieName of cookieNames) {
          const matchingCookies = allCookies.filter(c => c.name === cookieName)
          if (matchingCookies.length > 0) {
            return matchingCookies[0].value
          }
        }
      }
    } catch (_e) {}

    return null
  } catch (_error) {
    return null
  }
}

async function getApiBaseUrl(): Promise<string | null> {
  try {
    const cfg = await storage.sync.get(['apiEndpoint'])
    const endpoint = cfg?.apiEndpoint as string | undefined
    if (endpoint) {
      const u = new URL(endpoint)
      return `${u.protocol}//${u.host}`
    }
    return env.API_BASE_URL
  } catch {
    return env.API_BASE_URL
  }
}

export async function requireAuthToken(): Promise<string> {
  try {
    let token: string | null = null
    try {
      const stored = await storage.local.get(['auth_token'])
      if (stored && stored.auth_token) {
        token = stored.auth_token as string
      }
    } catch {}

    if (!token) {
      token = getAuthToken()
    }

    if (!token) {
      token = await getTokenFromCookie()
      if (token) {
        try {
          await storage.local.set({ auth_token: token })
        } catch {}
        try {
          setAuthToken(token)
        } catch {}
      }
    }

    if (!token) {
      throw new Error('Authentication required. Please log in through the web client first.')
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp * 1000
      if (exp <= Date.now()) {
        await storage.local.remove('auth_token')
        clearAuthToken()
        throw new Error('Authentication token expired. Please log in again.')
      }
      return token
    } catch (e) {
      if (e instanceof Error && (e.message.includes('expired') || e.message.includes('required'))) {
        throw e
      }
      await storage.local.remove('auth_token')
      clearAuthToken()
      throw new Error('Invalid authentication token. Please log in again.')
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Authentication required. Please log in through the web client first.')
  }
}

export function getAuthToken(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('auth_token')
    }
  } catch {}
  return null
}

export function setAuthToken(token: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_token', token)
    }
    storage.local.set({ auth_token: token }).catch(() => {})
  } catch (_error) {}
}

export function clearAuthToken(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth_token')
    }
    storage.local.remove('auth_token').catch(() => {})
  } catch (_error) {}
}
