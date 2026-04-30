/**
 * OAuth 2.0 Authorization Code with PKCE — "Sign in with Google" /
 * "Sign in with Microsoft".
 *
 * This service is provider-agnostic at the call sites: the route layer picks
 * the provider name, and this module:
 *   1. Builds the authorize URL (with PKCE challenge + state).
 *   2. On callback, exchanges the auth code for tokens (with PKCE verifier).
 *   3. Calls the userinfo endpoint to identify the human.
 *   4. Looks up an existing OAuthIdentity → User; otherwise matches by email
 *      and links; otherwise creates a fresh User and links.
 *
 * No real network round-trip is exercised in unit tests — only URL
 * construction and PKCE math. Integration tests run when real provider
 * credentials are configured in a deployed environment.
 */

import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import {
  getOAuthProvider,
  getCallbackUrl,
  OAuthProviderConfig,
  OAuthProviderName,
} from '../../config/oauth-providers.config'
import { deriveCodeChallenge } from '../../utils/auth/pkce.util'

export interface OAuthUserInfo {
  subject: string
  email: string | null
  name?: string | null
}

export function buildAuthorizeUrl(
  provider: OAuthProviderName,
  state: string,
  codeVerifier: string
): string {
  const cfg = getOAuthProvider(provider)
  if (!cfg) throw new Error(`OAuth provider ${provider} not configured`)
  const challenge = deriveCodeChallenge(codeVerifier)
  const url = new URL(cfg.authorizeUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', cfg.clientId)
  url.searchParams.set('redirect_uri', getCallbackUrl(provider))
  url.searchParams.set('scope', cfg.scopes.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  if (provider === 'google') {
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'select_account')
  }
  return url.toString()
}

interface TokenResponse {
  access_token: string
  id_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
}

async function exchangeCodeForToken(
  cfg: OAuthProviderConfig,
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getCallbackUrl(cfg.name),
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: codeVerifier,
  })
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Token exchange failed: ${res.status} ${text.slice(0, 200)}`)
  }
  return (await res.json()) as TokenResponse
}

async function fetchUserInfo(
  cfg: OAuthProviderConfig,
  accessToken: string
): Promise<OAuthUserInfo> {
  const res = await fetch(cfg.userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Userinfo failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const body = (await res.json()) as Record<string, unknown>
  // Both Google and Microsoft return `sub` for OIDC userinfo. Microsoft Graph
  // userinfo also returns it. Email may be `email` or (Graph-style) `mail` /
  // `userPrincipalName`.
  const subject = String(body.sub ?? body.id ?? '')
  const email =
    (typeof body.email === 'string' ? body.email : null) ??
    (typeof body.mail === 'string' ? (body.mail as string) : null) ??
    (typeof body.userPrincipalName === 'string' ? (body.userPrincipalName as string) : null)
  const name = typeof body.name === 'string' ? body.name : null
  if (!subject) throw new Error('Userinfo missing subject')
  return { subject, email, name }
}

export async function handleOAuthCallback(
  provider: OAuthProviderName,
  code: string,
  codeVerifier: string
): Promise<{ userId: string; isNewUser: boolean }> {
  const cfg = getOAuthProvider(provider)
  if (!cfg) throw new Error(`OAuth provider ${provider} not configured`)
  const tokens = await exchangeCodeForToken(cfg, code, codeVerifier)
  const userinfo = await fetchUserInfo(cfg, tokens.access_token)

  // 1. Existing identity? — short-circuit to that user.
  const existingIdentity = await prisma.oAuthIdentity.findUnique({
    where: { provider_subject: { provider, subject: userinfo.subject } },
  })
  if (existingIdentity) {
    return { userId: existingIdentity.user_id, isNewUser: false }
  }

  // 2. No identity yet — try to match by verified email so we link rather
  //    than create a duplicate account.
  let user = userinfo.email
    ? await prisma.user.findUnique({ where: { email: userinfo.email } })
    : null
  let isNewUser = false
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: userinfo.email ?? undefined,
        // Provider has already verified the email for us.
        email_verified_at: userinfo.email ? new Date() : null,
      },
    })
    isNewUser = true
  } else if (userinfo.email && !user.email_verified_at) {
    // Existing user; provider attests the email — stamp verification.
    await prisma.user.update({
      where: { id: user.id },
      data: { email_verified_at: new Date() },
    })
  }

  await prisma.oAuthIdentity.create({
    data: {
      user_id: user.id,
      provider,
      subject: userinfo.subject,
      email: userinfo.email,
    },
  })
  logger.log('[oauth] linked identity', { provider, userId: user.id, isNewUser })
  return { userId: user.id, isNewUser }
}

// Re-export PKCE helpers for callers (so the route only imports from one place).
export { generateCodeVerifier } from '../../utils/auth/pkce.util'
