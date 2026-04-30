import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'

/**
 * Stub for OAuth refresh-token rotation. Provider-specific refresh logic lives
 * in @cogniahq/integrations. This service is the scheduling shim:
 *   - reads UserIntegration / OrganizationIntegration rows whose tokens expire
 *     within the next 24h
 *   - (TODO) calls the plugin's refresh function — once @cogniahq/integrations
 *     exposes a `refreshToken(plugin, currentRefreshToken)` hook, wire it here
 *   - persists new tokens (encrypted by the integrations layer) and stamps
 *     last_sync_at on success
 *   - on failure marks the integration TOKEN_EXPIRED so the UI can prompt
 *     reconnect
 *
 * Today this loop iterates and logs which integrations are approaching
 * expiry. Once the integrations package exposes the refresh hook the inner
 * try/catch becomes the real refresh call.
 */
export async function refreshExpiringTokens(): Promise<{
  checked: number
  refreshed: number
  failed: number
}> {
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000) // expires within 24h

  const [userIntegs, orgIntegs] = await Promise.all([
    prisma.userIntegration
      .findMany({
        where: {
          status: 'ACTIVE',
          refresh_token: { not: null },
          token_expires_at: { not: null, lte: cutoff },
        },
      })
      .catch((): [] => []),
    prisma.organizationIntegration
      .findMany({
        where: {
          status: 'ACTIVE',
          refresh_token: { not: null },
          token_expires_at: { not: null, lte: cutoff },
        },
      })
      .catch((): [] => []),
  ])

  let refreshed = 0
  let failed = 0

  for (const integ of userIntegs) {
    try {
      // TODO: invoke @cogniahq/integrations' refresh hook for user integrations.
      logger.log('[oauth-refresh] would refresh user integration', {
        integrationId: integ.id,
        provider: integ.provider,
        expiresAt: integ.token_expires_at,
      })
      refreshed++
    } catch (err) {
      logger.warn('[oauth-refresh] user integration refresh failed', {
        integrationId: integ.id,
        error: String(err),
      })
      failed++
      await prisma.userIntegration
        .update({ where: { id: integ.id }, data: { status: 'TOKEN_EXPIRED' } })
        .catch(() => {})
    }
  }

  for (const integ of orgIntegs) {
    try {
      // TODO: invoke @cogniahq/integrations' refresh hook for org integrations.
      logger.log('[oauth-refresh] would refresh org integration', {
        integrationId: integ.id,
        provider: integ.provider,
        expiresAt: integ.token_expires_at,
      })
      refreshed++
    } catch (err) {
      logger.warn('[oauth-refresh] org integration refresh failed', {
        integrationId: integ.id,
        error: String(err),
      })
      failed++
      await prisma.organizationIntegration
        .update({ where: { id: integ.id }, data: { status: 'TOKEN_EXPIRED' } })
        .catch(() => {})
    }
  }

  const checked = userIntegs.length + orgIntegs.length
  return { checked, refreshed, failed }
}

let timer: NodeJS.Timeout | null = null

export function startOAuthRefreshScheduler(intervalMs = 60 * 60 * 1000): void {
  if (timer) return
  void refreshExpiringTokens().catch(err =>
    logger.error('[oauth-refresh] failed', { error: String(err) })
  )
  timer = setInterval(() => {
    void refreshExpiringTokens().catch(err =>
      logger.error('[oauth-refresh] failed', { error: String(err) })
    )
  }, intervalMs)
  timer.unref?.()
}
