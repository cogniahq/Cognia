/**
 * OAuth sign-in routes — "Sign in with Google" / "Sign in with Microsoft".
 *
 *   GET /api/auth/oauth/:provider/start
 *     Mints PKCE verifier + signed state, redirects to provider's authorize URL.
 *
 *   GET /api/auth/oauth/:provider/callback
 *     Verifies state signature, exchanges code (with PKCE verifier) for tokens,
 *     fetches userinfo, upserts User + OAuthIdentity, mints our JWT +
 *     refresh-token cookie, audit-logs `login_success`, redirects to returnTo.
 */

import { Router } from 'express'
import {
  buildAuthorizeUrl,
  handleOAuthCallback,
  generateCodeVerifier,
} from '../services/auth/oauth-providers.service'
import { createSignInOAuthState, parseSignInOAuthState } from '../utils/auth/oauth-state.util'
import { generateToken } from '../utils/auth/jwt.util'
import { issueRefreshToken } from '../services/auth/refresh-token.service'
import { auditLogService } from '../services/core/audit-log.service'

const router = Router()

const SUPPORTED_PROVIDERS = new Set(['google', 'microsoft'])

router.get('/:provider/start', (req, res) => {
  const provider = req.params.provider
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return res.status(400).json({ message: 'Unknown provider' })
  }
  try {
    const codeVerifier = generateCodeVerifier()
    const returnTo = (req.query.returnTo as string) || '/'
    const state = createSignInOAuthState({
      provider: provider as 'google' | 'microsoft',
      codeVerifier,
      returnTo,
    })
    const url = buildAuthorizeUrl(provider as 'google' | 'microsoft', state, codeVerifier)
    return res.redirect(url)
  } catch (err) {
    return res.status(500).json({ message: (err as Error).message })
  }
})

router.get('/:provider/callback', async (req, res) => {
  const provider = req.params.provider
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return res.status(400).json({ message: 'Unknown provider' })
  }
  const code = req.query.code as string | undefined
  const stateParam = req.query.state as string | undefined
  if (!code || !stateParam) {
    return res.status(400).json({ message: 'Missing code or state' })
  }

  let stateData: ReturnType<typeof parseSignInOAuthState>
  try {
    stateData = parseSignInOAuthState(stateParam)
  } catch {
    return res.status(400).json({ message: 'Invalid state' })
  }
  if (stateData.provider !== provider) {
    return res.status(400).json({ message: 'State/provider mismatch' })
  }

  try {
    const { userId, isNewUser } = await handleOAuthCallback(
      provider as 'google' | 'microsoft',
      code,
      stateData.codeVerifier
    )
    const accessToken = generateToken({ userId })
    const { token: refreshToken } = await issueRefreshToken(userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    })
    res.cookie('cognia_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 14 * 24 * 60 * 60 * 1000,
    })
    await auditLogService
      .logEvent({
        userId,
        eventType: 'login_success',
        eventCategory: 'authentication',
        action: `oauth-${provider}`,
        metadata: { provider, isNewUser },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      })
      .catch(() => {
        /* audit log failures must not break the login */
      })

    // Redirect back to the client app with the access token in the query.
    // The client will store it (e.g. in memory) and kick off normal API
    // requests. The httpOnly refresh cookie is already set above.
    const returnTo = stateData.returnTo || '/'
    const sep = returnTo.includes('?') ? '&' : '?'
    return res.redirect(`${returnTo}${sep}token=${encodeURIComponent(accessToken)}`)
  } catch (err) {
    return res.redirect(`/login?error=${encodeURIComponent((err as Error).message)}`)
  }
})

export default router
