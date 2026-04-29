import { createHash } from 'node:crypto'
import { logger } from '../../utils/core/logger.util'

const HIBP_BASE = process.env.HIBP_API_BASE || 'https://api.pwnedpasswords.com'
const HIBP_TIMEOUT_MS = 1500

/**
 * k-anonymity password breach check via HaveIBeenPwned.
 * Sends only the first 5 hex chars of SHA-1; the password never leaves this process.
 * Fails open on network/timeout (returns false) but logs a warning — we don't want
 * HIBP outages to block signups, but we do want to know.
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  // Read base each call so tests can override via env at runtime.
  const base = process.env.HIBP_API_BASE || HIBP_BASE
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), HIBP_TIMEOUT_MS)
    const res = await fetch(`${base}/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'cognia-api' },
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return false
    const text = await res.text()
    for (const line of text.split('\n')) {
      const [hash] = line.split(':')
      if (hash.trim() === suffix) return true
    }
    return false
  } catch (err) {
    logger.warn('[hibp] check failed; allowing password', { error: String(err) })
    return false
  }
}
