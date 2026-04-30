import {
  Configuration,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from 'openid-client'
import type { Organization } from '@prisma/client'
import { prisma } from '../../lib/prisma.lib'
import { decryptString } from '../../utils/auth/crypto.util'

const configCache = new Map<string, Configuration>()

export interface OidcOrgClient {
  config: Configuration
  org: Organization
  redirectUri: string
}

/**
 * Build (or retrieve from cache) an openid-client v6 Configuration for the org.
 * Cache key includes the issuer + clientId to invalidate when the org rotates creds.
 */
export async function getOidcClientForOrg(slug: string): Promise<OidcOrgClient | null> {
  const org = await prisma.organization.findUnique({ where: { slug } })
  if (!org || !org.sso_enabled || org.sso_provider !== 'oidc') return null
  if (!org.sso_idp_oidc_issuer || !org.sso_idp_oidc_client_id || !org.sso_idp_oidc_client_secret)
    return null

  const baseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/sso/oidc/${slug}/callback`

  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY not set')

  // Try to decrypt; if it fails (legacy plaintext), fall back to as-is.
  let clientSecret = org.sso_idp_oidc_client_secret
  try {
    clientSecret = decryptString(clientSecret, key)
  } catch {
    /* legacy plaintext */
  }

  const cacheKey = `${org.sso_idp_oidc_issuer}|${org.sso_idp_oidc_client_id}`
  const cached = configCache.get(cacheKey)
  if (cached) {
    return { config: cached, org, redirectUri }
  }

  const config = await discovery(
    new URL(org.sso_idp_oidc_issuer),
    org.sso_idp_oidc_client_id,
    clientSecret
  )
  configCache.set(cacheKey, config)
  return { config, org, redirectUri }
}

export interface OidcAuthStart {
  url: string
  state: string
  nonce: string
  codeVerifier: string
}

/**
 * Build the authorization URL with PKCE + state + nonce.
 * Caller is responsible for persisting (state -> {codeVerifier, nonce}).
 */
export async function buildOidcAuthUrl(
  config: Configuration,
  redirectUri: string,
  scope = 'openid email profile'
): Promise<OidcAuthStart> {
  const codeVerifier = randomPKCECodeVerifier()
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier)
  const nonce = randomNonce()
  const state = randomState()
  const url = buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  }).toString()
  return { url, state, nonce, codeVerifier }
}

export interface OidcCallbackResult {
  email: string
  sub: string
  name?: string
  groups: string[]
}

/**
 * Complete the authorization code grant + ID token validation, returning a
 * normalized profile shape suitable for JIT provisioning.
 */
export async function completeOidcCallback(
  config: Configuration,
  currentUrl: URL,
  expectedNonce: string,
  expectedState: string,
  pkceCodeVerifier: string
): Promise<OidcCallbackResult> {
  const tokens = await authorizationCodeGrant(config, currentUrl, {
    expectedNonce,
    expectedState,
    pkceCodeVerifier,
    idTokenExpected: true,
  })
  const claims = tokens.claims()
  if (!claims) throw new Error('OIDC ID token missing claims')

  const c = claims as Record<string, unknown>
  const email = String(c['email'] ?? c['preferred_username'] ?? '')
  if (!email) throw new Error('OIDC claims missing email')
  const rawGroups = c['groups'] ?? c['roles'] ?? []
  const groups = Array.isArray(rawGroups)
    ? rawGroups.map(String)
    : rawGroups
      ? [String(rawGroups)]
      : []
  return {
    email,
    sub: String(c['sub']),
    name: c['name'] ? String(c['name']) : undefined,
    groups,
  }
}
