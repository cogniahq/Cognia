import { Router, Response } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireOrganization,
  requireOrgAdmin,
  requireOrgViewer,
  OrganizationRequest,
} from '../middleware/organization.middleware'
import { enforceIpAllowlist } from '../middleware/ip-allowlist.middleware'
import { enforceSessionTimeout } from '../middleware/session-timeout.middleware'
import { enforce2FARequirement } from '../middleware/require-2fa.middleware'
import { integrationService } from '../services/integration'
import { auditLogService } from '../services/core/audit-log.service'
import { checkIntegrationQuotaAvailable } from '../services/billing/quota.service'
import { prisma } from '../lib/prisma.lib'
import { SyncFrequency, StorageStrategy } from '@prisma/client'
import { createOAuthState, parseOAuthState } from '../utils/auth/oauth-state.util'

const router = Router()
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

// All routes require organization context
const orgMiddleware = [
  authenticateToken,
  requireOrganization,
  enforceIpAllowlist,
  enforceSessionTimeout,
  enforce2FARequirement,
]

/**
 * GET /api/organizations/:slug/integrations
 * List available integrations for the organization
 */
router.get(
  '/:slug/integrations',
  ...orgMiddleware,
  requireOrgViewer,
  async (req: OrganizationRequest, res: Response) => {
    try {
      const available = integrationService.listAvailable({
        userId: req.user!.id,
        organizationId: req.organization!.id,
        plan: req.organization!.plan,
      })

      res.json({ success: true, data: available })
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: getErrorMessage(error, 'Failed to load integrations') })
    }
  }
)

/**
 * GET /api/organizations/:slug/integrations/connected
 * List organization's connected integrations with their settings
 */
router.get(
  '/:slug/integrations/connected',
  ...orgMiddleware,
  requireOrgViewer,
  async (req: OrganizationRequest, res: Response) => {
    try {
      const integrations = await integrationService.getOrgIntegrations(req.organization!.id)
      res.json({ success: true, data: integrations })
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: getErrorMessage(error, 'Failed to load integrations') })
    }
  }
)

/**
 * GET /api/organizations/:slug/integrations/settings
 * Get organization-level integration sync settings
 */
router.get(
  '/:slug/integrations/settings',
  ...orgMiddleware,
  requireOrgViewer,
  async (req: OrganizationRequest, res: Response) => {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.organization!.id },
        select: {
          default_sync_frequency: true,
          custom_sync_interval_min: true,
        },
      })

      res.json({
        success: true,
        data: {
          defaultSyncFrequency: org?.default_sync_frequency || 'HOURLY',
          customSyncIntervalMin: org?.custom_sync_interval_min,
          // Computed: effective interval in minutes
          effectiveIntervalMin: getEffectiveIntervalMinutes(
            org?.default_sync_frequency || 'HOURLY',
            org?.custom_sync_interval_min
          ),
        },
      })
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: getErrorMessage(error, 'Failed to load settings') })
    }
  }
)

/**
 * PUT /api/organizations/:slug/integrations/settings
 * Update organization-level integration sync settings (admin only)
 */
router.put(
  '/:slug/integrations/settings',
  ...orgMiddleware,
  requireOrgAdmin,
  async (req: OrganizationRequest, res: Response) => {
    try {
      const { defaultSyncFrequency, customSyncIntervalMin } = req.body

      // Validate sync frequency if provided
      if (defaultSyncFrequency && !isValidSyncFrequency(defaultSyncFrequency)) {
        return res.status(400).json({
          success: false,
          error: `Invalid sync frequency. Must be one of: ${Object.values(SyncFrequency).join(', ')}`,
        })
      }

      // Validate custom interval (minimum 5 minutes, max 1440 = 24 hours)
      if (customSyncIntervalMin !== undefined && customSyncIntervalMin !== null) {
        if (
          typeof customSyncIntervalMin !== 'number' ||
          customSyncIntervalMin < 5 ||
          customSyncIntervalMin > 1440
        ) {
          return res.status(400).json({
            success: false,
            error: 'Custom sync interval must be between 5 and 1440 minutes (24 hours)',
          })
        }
      }

      const updated = await prisma.organization.update({
        where: { id: req.organization!.id },
        data: {
          default_sync_frequency: defaultSyncFrequency as SyncFrequency,
          custom_sync_interval_min: customSyncIntervalMin,
        },
        select: {
          default_sync_frequency: true,
          custom_sync_interval_min: true,
        },
      })

      res.json({
        success: true,
        data: {
          defaultSyncFrequency: updated.default_sync_frequency,
          customSyncIntervalMin: updated.custom_sync_interval_min,
          effectiveIntervalMin: getEffectiveIntervalMinutes(
            updated.default_sync_frequency,
            updated.custom_sync_interval_min
          ),
        },
      })
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: getErrorMessage(error, 'Failed to update settings') })
    }
  }
)

/**
 * POST /api/organizations/:slug/integrations/:provider/connect
 * Start OAuth flow for organization integration
 */
router.post(
  '/:slug/integrations/:provider/connect',
  ...orgMiddleware,
  requireOrgAdmin,
  async (req: OrganizationRequest, res: Response) => {
    try {
      const { provider } = req.params

      // Plan integration quota enforcement (gate before kicking off OAuth)
      const quotaCheck = await checkIntegrationQuotaAvailable(req.organization!.id)
      if (!quotaCheck.ok) {
        return res.status(402).json({
          success: false,
          code: 'QUOTA_EXCEEDED',
          quotaExceeded: 'integrations',
          current: quotaCheck.current,
          limit: quotaCheck.limit,
          plan: quotaCheck.plan,
          message: 'Plan integration limit reached. Upgrade to connect more integrations.',
        })
      }

      const redirectUri = getRedirectUri(provider, 'organization')

      // Generate state with organization context
      const state = createOAuthState({
        integrationType: 'organization',
        userId: req.user!.id,
        organizationId: req.organization!.id,
        organizationSlug: req.organization!.slug,
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
 * GET /api/organizations/:slug/integrations/:provider/callback
 * OAuth callback for organization integration (NO AUTH - uses state)
 */
router.get('/:slug/integrations/:provider/callback', async (req, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  try {
    const { slug, provider } = req.params
    const { code, state, error: oauthError } = req.query

    const errorRedirect = `${frontendUrl}/o/${slug}/settings/integrations`

    if (oauthError) {
      return res.redirect(`${errorRedirect}?error=${encodeURIComponent(oauthError as string)}`)
    }

    if (typeof code !== 'string' || typeof state !== 'string') {
      return res.redirect(`${errorRedirect}?error=${encodeURIComponent('Missing code or state')}`)
    }

    const stateData = parseOAuthState(state)

    if (
      stateData.integrationType !== 'organization' ||
      stateData.organizationSlug !== slug ||
      stateData.provider !== provider
    ) {
      return res.redirect(`${errorRedirect}?error=${encodeURIComponent('Provider mismatch')}`)
    }

    // Get org's default sync settings
    const org = await prisma.organization.findUnique({
      where: { id: stateData.organizationId },
      select: {
        slug: true,
        default_sync_frequency: true,
      },
    })

    if (!org || org.slug !== stateData.organizationSlug) {
      return res.redirect(`${errorRedirect}?error=${encodeURIComponent('Organization not found')}`)
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
        syncFrequency: org?.default_sync_frequency || SyncFrequency.HOURLY,
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

    res.redirect(`${frontendUrl}/o/${slug}/settings/integrations?connected=${provider}`)
  } catch (error) {
    console.error('Org OAuth callback error:', error)
    const { slug } = req.params
    res.redirect(
      `${frontendUrl}/o/${slug}/settings/integrations?error=${encodeURIComponent(
        getErrorMessage(error, 'Connection failed')
      )}`
    )
  }
})

/**
 * PUT /api/organizations/:slug/integrations/:provider/config
 * Update integration settings for a specific provider (admin only)
 */
router.put(
  '/:slug/integrations/:provider/config',
  ...orgMiddleware,
  requireOrgAdmin,
  async (req: OrganizationRequest, res: Response) => {
    try {
      const { provider } = req.params
      const { syncFrequency, storageStrategy, config } = req.body

      // Validate sync frequency
      if (syncFrequency && !isValidSyncFrequency(syncFrequency)) {
        return res.status(400).json({
          success: false,
          error: `Invalid sync frequency. Must be one of: ${Object.values(SyncFrequency).join(', ')}`,
        })
      }

      const updated = await integrationService.updateOrgIntegrationSettings(
        req.organization!.id,
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
 * POST /api/organizations/:slug/integrations/:provider/sync
 * Trigger manual sync for an organization integration (admin only)
 */
router.post(
  '/:slug/integrations/:provider/sync',
  ...orgMiddleware,
  requireOrgAdmin,
  async (req: OrganizationRequest, res: Response) => {
    try {
      const { provider } = req.params
      const { mode = 'incremental' } = req.body

      const integrations = await integrationService.getOrgIntegrations(req.organization!.id)
      const integration = integrations.find(i => i.provider === provider)

      if (!integration) {
        return res.status(404).json({ success: false, error: 'Integration not found' })
      }

      // Start sync in background
      integrationService.triggerSync(integration.id, 'organization', mode).catch(err => {
        console.error(`Background sync failed for org ${provider}:`, err)
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
 * DELETE /api/organizations/:slug/integrations/:provider
 * Disconnect organization integration (admin only)
 */
router.delete(
  '/:slug/integrations/:provider',
  ...orgMiddleware,
  requireOrgAdmin,
  async (req: OrganizationRequest, res: Response) => {
    try {
      const { provider } = req.params

      // Snapshot integration id before deletion (best-effort, for audit)
      const existing = await prisma.organizationIntegration
        .findUnique({
          where: {
            organization_id_provider: { organization_id: req.organization!.id, provider },
          },
          select: { id: true },
        })
        .catch((): null => null)

      await integrationService.disconnectOrgIntegration(req.organization!.id, provider)

      await auditLogService
        .logOrgEvent({
          orgId: req.organization!.id,
          actorUserId: req.user?.id ?? null,
          actorEmail: req.user?.email ?? null,
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
  }
)

// Helper functions

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

function isValidSyncFrequency(value: string): boolean {
  return Object.values(SyncFrequency).includes(value as SyncFrequency)
}

function getEffectiveIntervalMinutes(
  frequency: SyncFrequency,
  customInterval?: number | null
): number {
  // Custom interval takes precedence
  if (customInterval) {
    return customInterval
  }

  // Map frequency enum to minutes
  switch (frequency) {
    case 'REALTIME':
      return 1 // 1 minute polling for "realtime"
    case 'FIFTEEN_MIN':
      return 15
    case 'HOURLY':
      return 60
    case 'DAILY':
      return 1440
    case 'MANUAL':
      return 0 // 0 indicates manual only
    default:
      return 60
  }
}

export default router
