import { Response, NextFunction } from 'express'
import { OrganizationRequest } from './organization.middleware'
import { logger } from '../utils/core/logger.util'

/**
 * Get client IP address from request
 * Handles proxies via X-Forwarded-For header
 */
function getClientIp(req: OrganizationRequest): string {
  // Check X-Forwarded-For header (set by proxies/load balancers)
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    // X-Forwarded-For can be a comma-separated list, first IP is the client
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]
    return ips.trim()
  }

  // Check X-Real-IP header (nginx)
  const realIp = req.headers['x-real-ip']
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp
  }

  // Fall back to socket remote address
  return req.socket?.remoteAddress || req.ip || 'unknown'
}

/**
 * Check if an IP matches a pattern (supports CIDR notation)
 */
function ipMatchesPattern(ip: string, pattern: string): boolean {
  // Normalize IPv6-mapped IPv4 addresses
  const normalizedIp = ip.replace(/^::ffff:/, '')
  const normalizedPattern = pattern.replace(/^::ffff:/, '')

  // Exact match
  if (normalizedIp === normalizedPattern) {
    return true
  }

  // CIDR notation (e.g., 192.168.1.0/24)
  if (normalizedPattern.includes('/')) {
    return ipInCidr(normalizedIp, normalizedPattern)
  }

  // Wildcard match (e.g., 192.168.1.*)
  if (normalizedPattern.includes('*')) {
    const regex = new RegExp(
      '^' + normalizedPattern.replace(/\./g, '\\.').replace(/\*/g, '\\d+') + '$'
    )
    return regex.test(normalizedIp)
  }

  return false
}

/**
 * Check if IP is within a CIDR range
 */
function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split('/')
    const mask = parseInt(bits, 10)

    if (isNaN(mask) || mask < 0 || mask > 32) {
      return false
    }

    const ipParts = ip.split('.').map(Number)
    const rangeParts = range.split('.').map(Number)

    if (ipParts.length !== 4 || rangeParts.length !== 4) {
      return false
    }

    // Convert to 32-bit integers
    const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]
    const rangeNum =
      (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3]

    // Create mask
    const maskBits = ~((1 << (32 - mask)) - 1)

    return (ipNum & maskBits) === (rangeNum & maskBits)
  } catch {
    return false
  }
}

/**
 * Middleware to enforce IP allowlist for organizations
 * Must be used after requireOrganization middleware
 */
export function enforceIpAllowlist(req: OrganizationRequest, res: Response, next: NextFunction) {
  try {
    const org = req.organization

    // If no organization or no allowlist, allow access
    if (!org || !org.ip_allowlist || org.ip_allowlist.length === 0) {
      return next()
    }

    const clientIp = getClientIp(req)

    // Check if client IP matches any allowed pattern
    const isAllowed = org.ip_allowlist.some(pattern => ipMatchesPattern(clientIp, pattern))

    if (!isAllowed) {
      logger.warn('[ip-allowlist] Access denied', {
        organizationId: org.id,
        organizationSlug: org.slug,
        clientIp,
        allowlist: org.ip_allowlist,
      })

      return res.status(403).json({
        success: false,
        message: 'Access denied: IP address not in allowlist',
        code: 'IP_NOT_ALLOWED',
      })
    }

    next()
  } catch (error) {
    logger.error('[ip-allowlist] Error checking IP allowlist', {
      error: error instanceof Error ? error.message : String(error),
    })
    // On error, allow access (fail open) to prevent lockouts
    next()
  }
}
