import { Router, Response } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import { integrationService } from '../services/integration'
import { auditLogService } from '../services/core/audit-log.service'
import { SyncFrequency, StorageStrategy } from '@prisma/client'
import { createOAuthState, parseOAuthState } from '../utils/auth/oauth-state.util'
import { prisma } from '../lib/prisma.lib'
import { integrationSyncRateLimiter } from '../middleware/rate-limit.middleware'

const router = Router()
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

/**
 * Get the redirect URI for a provider
 * Uses integration-type-specific env var if set, then legacy provider env var,
 * otherwise falls back to the shared callback endpoint.
 */
function getRedirectUri(provider: string, integrationType: 'user' | 'organization'): string {
  const typeSpecificEnvKey = `${integrationType.toUpperCase()}_${provider.toUpperCase()}_REDIRECT_URI`
  const providerEnvKey = `${provider.toUpperCase()}_REDIRECT_URI`
  const specificUri = process.env[typeSpecificEnvKey] || process.env[providerEnvKey]
  if (specificUri) {
    return specificUri
  }
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000'
  return `${apiBaseUrl}/api/integrations/${provider}/callback`
}

/**
 * GET /api/integrations
 * List available integrations for the current user
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const available = integrationService.listAvailable({
      userId: req.user!.id,
      plan: 'free', // TODO: Get from user's plan
    })

    res.json({ success: true, data: available })
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: getErrorMessage(error, 'Failed to load integrations') })
  }
})

/**
 * GET /api/integrations/connected
 * List user's connected integrations
 */
router.get('/connected', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const integrations = await integrationService.getUserIntegrations(req.user!.id)
    res.json({ success: true, data: integrations })
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: getErrorMessage(error, 'Failed to load integrations') })
  }
})

/**
 * POST /api/integrations/:provider/connect
 * Start OAuth flow - returns authorization URL
 */
router.post(
  '/:provider/connect',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { provider } = req.params

      // Use consistent redirect URI from env or default
      const redirectUri = getRedirectUri(provider, 'user')

      // Generate state with user context
      const state = createOAuthState({
        integrationType: 'user',
        userId: req.user!.id,
        provider,
        timestamp: Date.now(),
      })

      const authUrl = integrationService.getAuthUrl(provider, state, redirectUri)

      res.json({ success: true, data: { authUrl, state } })
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: getErrorMessage(error, 'Failed to connect integration') })
    }
  }
)

/**
 * GET /api/integrations/:provider/callback
 * OAuth callback handler - NO AUTH REQUIRED (uses state parameter for user identification)
 */
router.get('/:provider/callback', async (req, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  let organizationSlug: string | null = null
  const redirectToIntegrations = (
    message: string,
    isError: boolean = true,
    slug?: string | null
  ) => {
    const basePath = slug ? `/o/${slug}/settings/integrations` : '/integrations'
    return res.redirect(
      `${frontendUrl}${basePath}?${isError ? 'error' : 'connected'}=${encodeURIComponent(message)}`
    )
  }

  try {
    const { provider } = req.params
    const { code, state, error: oauthError } = req.query

    // Handle OAuth errors
    if (oauthError) {
      if (typeof state === 'string') {
        try {
          organizationSlug = parseOAuthState(state).organizationSlug || null
        } catch {
          organizationSlug = null
        }
      }
      return redirectToIntegrations(oauthError as string, true, organizationSlug)
    }

    if (typeof code !== 'string' || typeof state !== 'string') {
      return redirectToIntegrations('Missing code or state')
    }

    const stateData = parseOAuthState(state)
    organizationSlug = stateData.organizationSlug || null

    // Verify provider matches
    if (stateData.provider !== provider) {
      return redirectToIntegrations('Provider mismatch', true, organizationSlug)
    }

    if (stateData.integrationType === 'organization') {
      if (!stateData.organizationId || !stateData.organizationSlug) {
        return redirectToIntegrations('Invalid state data')
      }

      const org = await prisma.organization.findUnique({
        where: { id: stateData.organizationId },
        select: {
          slug: true,
          default_sync_frequency: true,
        },
      })

      if (!org || org.slug !== stateData.organizationSlug) {
        return redirectToIntegrations('Organization not found', true, stateData.organizationSlug)
      }

      const redirectUri = getRedirectUri(provider, 'organization')

      const connected = await integrationService.connectOrgIntegration(
        {
          userId: stateData.userId,
          organizationId: stateData.organizationId,
        },
        {
          provider,
          code,
          redirectUri,
          syncFrequency: org.default_sync_frequency || SyncFrequency.HOURLY,
        }
      )

      const actor = await prisma.user
        .findUnique({ where: { id: stateData.userId }, select: { email: true } })
        .catch((): null => null)

      await auditLogService
        .logOrgEvent({
          orgId: stateData.organizationId,
          actorUserId: stateData.userId,
          actorEmail: actor?.email ?? null,
          eventType: 'integration_connected',
          eventCategory: 'integration',
          action: 'connect',
          targetResourceType: 'integration',
          targetResourceId: connected?.id ?? null,
          metadata: { provider },
          ipAddress: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
        })
        .catch(() => {})

      return res.redirect(
        `${frontendUrl}/o/${stateData.organizationSlug}/settings/integrations?connected=${encodeURIComponent(provider)}`
      )
    }

    // Get redirect URI (must match what was sent to OAuth provider)
    const redirectUri = getRedirectUri(provider, 'user')

    // Connect the integration using userId from state
    const connected = await integrationService.connectUserIntegration(
      { userId: stateData.userId },
      {
        provider,
        code,
        redirectUri,
      }
    )

    await auditLogService
      .logEvent({
        userId: stateData.userId,
        eventType: 'integration_connected',
        eventCategory: 'integration',
        action: 'connect',
        targetResourceType: 'integration',
        targetResourceId: connected?.id ?? null,
        metadata: { provider },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      })
      .catch(() => {})

    // Redirect to frontend success page
    return redirectToIntegrations(provider, false)
  } catch (error) {
    console.error('OAuth callback error:', error)
    return redirectToIntegrations(
      getErrorMessage(error, 'Connection failed'),
      true,
      organizationSlug
    )
  }
})

/**
 * GET /api/integrations/:provider
 * Get details of a connected integration
 */
router.get('/:provider', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider } = req.params
    const integrations = await integrationService.getUserIntegrations(req.user!.id)
    const integration = integrations.find(i => i.provider === provider)

    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' })
    }

    res.json({ success: true, data: integration })
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: getErrorMessage(error, 'Failed to load integration') })
  }
})

/**
 * PUT /api/integrations/:provider/config
 * Update integration settings
 */
router.put(
  '/:provider/config',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { provider } = req.params
      const { syncFrequency, storageStrategy, config } = req.body

      const updated = await integrationService.updateUserIntegrationSettings(
        req.user!.id,
        provider,
        {
          syncFrequency: syncFrequency as SyncFrequency,
          storageStrategy: storageStrategy as StorageStrategy,
          config,
        }
      )

      res.json({ success: true, data: updated })
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: getErrorMessage(error, 'Failed to update integration') })
    }
  }
)

/**
 * POST /api/integrations/:provider/sync
 * Trigger manual sync (fire-and-forget - returns immediately, sync runs in background)
 */
router.post(
  '/:provider/sync',
  authenticateToken,
  integrationSyncRateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { provider } = req.params
      const { mode = 'incremental' } = req.body

      const integrations = await integrationService.getUserIntegrations(req.user!.id)
      const integration = integrations.find(i => i.provider === provider)

      if (!integration) {
        return res.status(404).json({ success: false, error: 'Integration not found' })
      }

      // Start sync in background (don't await) - prevents client timeout
      integrationService.triggerSync(integration.id, 'user', mode).catch(err => {
        console.error(`Background sync failed for ${provider}:`, err)
      })

      res.json({ success: true, message: 'Sync started' })
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: getErrorMessage(error, 'Failed to start sync') })
    }
  }
)

/**
 * DELETE /api/integrations/:provider
 * Disconnect integration
 */
router.delete('/:provider', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider } = req.params

    // Snapshot integration id before deletion (best-effort, for audit)
    const existing = await prisma.userIntegration
      .findUnique({
        where: { user_id_provider: { user_id: req.user!.id, provider } },
        select: { id: true },
      })
      .catch((): null => null)

    await integrationService.disconnectUserIntegration(req.user!.id, provider)

    await auditLogService
      .logEvent({
        userId: req.user!.id,
        eventType: 'integration_disconnected',
        eventCategory: 'integration',
        action: 'disconnect',
        targetResourceType: 'integration',
        targetResourceId: existing?.id ?? null,
        metadata: { provider },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      })
      .catch(() => {})

    res.json({ success: true, message: 'Integration disconnected' })
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: getErrorMessage(error, 'Failed to disconnect integration') })
  }
})

export default router
