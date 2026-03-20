import { Response } from 'express'
import { getCookieDomain, getSessionCookieName, isCookieSecure } from '../core/env.util'
import { logger } from '../core/logger.util'

interface CookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  maxAge?: number
  domain?: string
}

function isLoopbackDomain(domain: string): boolean {
  const normalizedDomain = domain.replace(/^\./, '').toLowerCase()
  return normalizedDomain === 'localhost' || normalizedDomain === '127.0.0.1'
}

function isLocalCookieContext(cookieDomain: string): boolean {
  if (typeof process.env.COOKIE_DOMAIN === 'undefined') {
    return process.env.NODE_ENV !== 'production'
  }

  return isLoopbackDomain(cookieDomain)
}

function buildCookieOptions(maxAgeMs?: number): CookieOptions & { isLocalhost: boolean } {
  const cookieDomain = getCookieDomain()
  const isLocalhost = isLocalCookieContext(cookieDomain)

  const cookieOptions: CookieOptions & { isLocalhost: boolean } = {
    httpOnly: true,
    secure: isLocalhost ? false : isCookieSecure(),
    sameSite: isLocalhost ? 'lax' : 'none',
    path: '/',
    isLocalhost,
  }

  if (typeof maxAgeMs === 'number') {
    cookieOptions.maxAge = maxAgeMs
  }

  if (!isLocalhost && cookieDomain) {
    cookieOptions.domain = cookieDomain
  }

  return cookieOptions
}

export function setAuthCookie(
  res: Response,
  value: string,
  maxAgeMs: number = 1000 * 60 * 60 * 24 * 30
): void {
  const name = getSessionCookieName()
  const cookieOptions = buildCookieOptions(maxAgeMs)

  // Log cookie settings for debugging
  logger.log('[AuthCookie] setting cookie', {
    name,
    domain: cookieOptions.domain || 'localhost',
    path: cookieOptions.path,
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    isLocalhost: cookieOptions.isLocalhost,
  })

  res.cookie(name, value, cookieOptions)
}

export function clearAuthCookie(res: Response): void {
  const name = getSessionCookieName()
  const cookieOptions = buildCookieOptions()

  // Clear cookie with domain if set
  if (cookieOptions.domain) {
    res.clearCookie(name, {
      httpOnly: true,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      domain: cookieOptions.domain,
      path: '/',
    })
  }

  // Also clear without domain (for localhost)
  res.clearCookie(name, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
  })
}
