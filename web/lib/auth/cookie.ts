import "server-only"
import { cookies } from "next/headers"

const SESSION_COOKIE = "cognia_session"

/**
 * Cookie attributes mirror api/src/utils/auth/auth-cookie.util.ts so the
 * cookie we forward to the browser is functionally identical to the one the
 * API would have set directly on its own subdomain. The API issues
 * Domain=.cogniahq.tech so the browser sends it back to both api.* and the
 * marketing/web subdomains; we replicate that here in production. In dev
 * (localhost) we omit the domain attribute and downgrade SameSite to "lax"
 * so HTTP works without Secure.
 */
function cookieAttributes() {
  const isProd = process.env.NODE_ENV === "production"
  const cookieDomain = process.env.COOKIE_DOMAIN
  return {
    domain: isProd ? (cookieDomain ?? ".cogniahq.tech") : undefined,
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  }
}

/**
 * Forward a Set-Cookie header from an upstream API response onto the
 * Server Action's response. The API may emit multiple cookies (cognia_session
 * + cognia_refresh); we extract the access cookie by name and store it via
 * Next's cookie store so it round-trips back to the browser as part of the
 * action response.
 *
 * Returns true if a cognia_session was forwarded, false otherwise.
 */
export async function forwardSessionCookie(
  setCookieHeader: string | null
): Promise<boolean> {
  if (!setCookieHeader) return false
  // A single getter call may return multiple Set-Cookie headers concatenated
  // with a comma; that's the spec but it's also ambiguous because cookies can
  // contain commas in Expires. Simplest reliable parse: scan for our cookie
  // name and read until the first semicolon.
  const match = setCookieHeader.match(
    new RegExp(`${SESSION_COOKIE}=([^;]+)`, "i")
  )
  if (!match) return false
  const value = match[1]
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, value, cookieAttributes())
  return true
}

/**
 * Clear the session cookie from the browser. Must mirror the attributes used
 * to set it, otherwise the browser refuses to overwrite. We clear with the
 * domain-qualified attributes when in prod.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete({
    name: SESSION_COOKIE,
    path: "/",
    domain: cookieAttributes().domain,
  })
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
