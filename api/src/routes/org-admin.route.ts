import { Router } from 'express'
import { randomBytes, createHash } from 'node:crypto'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireOrganization, requireOrgAdmin } from '../middleware/organization.middleware'
import type { OrganizationRequest } from '../middleware/organization.middleware'
import { requirePermission } from '../middleware/permission.middleware'
import { auditLogService } from '../services/core/audit-log.service'
import { prisma } from '../lib/prisma.lib'
import type { AuditEventType, AuditEventCategory } from '../types/common.types'
import { offboardMember } from '../services/organization/member-offboarding.service'
import { getWebhookQueue } from '../queues/webhook.queue'
import { setOrgLlmConfig } from '../services/llm/byok-router.service'
import { applyOrgHold, releaseOrgHold } from '../services/compliance/legal-hold.service'
import { searchOrg } from '../services/compliance/ediscovery.service'

const router = Router({ mergeParams: true })

// Apply auth + org membership + admin check to every route
// Phase 7 RBAC: keep `requireOrgAdmin` as a coarse gate, but layer
// `requirePermission(...)` on top per-route so 403s carry the specific
// permission name and clients can map them to UI gates.
router.use('/:slug', authenticateToken, requireOrganization, requireOrgAdmin)

// GET /:slug/activity - paginated audit log
router.get(
  '/:slug/activity',
  requirePermission('audit.read'),
  async (req: OrganizationRequest, res) => {
    const orgId = req.organization!.id
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Number(req.query.offset) || 0
    const eventType = req.query.eventType as AuditEventType | undefined
    const eventCategory = req.query.eventCategory as AuditEventCategory | undefined
    const actorUserId = req.query.actorUserId as string | undefined
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

    const result = await auditLogService.getOrgAuditLogs(orgId, {
      limit,
      offset,
      eventType,
      eventCategory,
      actorUserId,
      startDate,
      endDate,
    })

    res.json({
      success: true,
      data: result.logs,
      pagination: { total: result.total, limit: result.limit, offset: result.offset },
    })
  }
)

// GET /:slug/activity/export.csv
router.get(
  '/:slug/activity/export.csv',
  requirePermission('audit.export'),
  async (req: OrganizationRequest, res) => {
    const orgId = req.organization!.id
    const eventType = req.query.eventType as AuditEventType | undefined
    const eventCategory = req.query.eventCategory as AuditEventCategory | undefined
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

    // Fetch up to 50k rows; streaming would be Phase 1 polish
    const result = await auditLogService.getOrgAuditLogs(orgId, {
      eventType,
      eventCategory,
      startDate,
      endDate,
      limit: 50000,
      offset: 0,
    })

    await auditLogService.logOrgEvent({
      orgId,
      actorUserId: req.user?.id ?? null,
      actorEmail: req.user?.email ?? null,
      eventType: 'data_exported',
      eventCategory: 'data_management',
      action: 'audit_log_csv_export',
      metadata: {
        rows: result.logs.length,
        filters: { eventType, eventCategory, startDate, endDate },
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-${req.params.slug}-${new Date().toISOString().slice(0, 10)}.csv"`
    )

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return ''
      const s = typeof v === 'string' ? v : JSON.stringify(v)
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const header = [
      'timestamp',
      'event_type',
      'event_category',
      'action',
      'actor_user_id',
      'actor_email',
      'target_user_id',
      'target_resource_type',
      'target_resource_id',
      'ip_address',
      'user_agent',
      'metadata',
    ]
    res.write(header.join(',') + '\n')
    for (const log of result.logs) {
      const userEmail =
        (log as unknown as { user?: { email?: string } }).user?.email ?? log.actor_email ?? ''
      const row = [
        log.created_at.toISOString(),
        log.event_type,
        log.event_category,
        log.action,
        log.user_id ?? '',
        userEmail,
        log.target_user_id ?? '',
        log.target_resource_type ?? '',
        log.target_resource_id ?? '',
        log.ip_address ?? '',
        log.user_agent ?? '',
        log.metadata ?? '',
      ]
        .map(escape)
        .join(',')
      res.write(row + '\n')
    }
    res.end()
  }
)

// GET /:slug/members
router.get('/:slug/members', async (req: OrganizationRequest, res) => {
  const orgId = req.organization!.id
  const members = await prisma.organizationMember.findMany({
    where: { organization_id: orgId },
    include: {
      user: { select: { id: true, email: true, two_factor_enabled: true, created_at: true } },
    },
    orderBy: { created_at: 'desc' },
  })
  res.json({ success: true, data: members })
})

// GET /:slug/security-status
router.get('/:slug/security-status', async (req: OrganizationRequest, res) => {
  const orgId = req.organization!.id
  const org = req.organization!

  // Pull additional org settings not present in OrganizationRequest context
  const fullOrg = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      sso_enabled: true,
      password_policy: true,
      data_residency: true,
      audit_retention: true,
    },
  })

  const [memberCount, twoFaEnabledCount] = await Promise.all([
    prisma.organizationMember.count({ where: { organization_id: orgId } }),
    prisma.organizationMember.count({
      where: { organization_id: orgId, user: { two_factor_enabled: true } },
    }),
  ])

  res.json({
    success: true,
    data: {
      twoFaEnrollment: {
        enabled: twoFaEnabledCount,
        total: memberCount,
        percentage: memberCount > 0 ? Math.round((twoFaEnabledCount / memberCount) * 100) : 0,
        required: org.require_2fa,
      },
      sso: {
        enabled: fullOrg?.sso_enabled ?? false,
      },
      ipAllowlist: {
        enabled: org.ip_allowlist.length > 0,
        size: org.ip_allowlist.length,
      },
      session: {
        timeout: org.session_timeout,
      },
      audit: {
        retention: fullOrg?.audit_retention ?? '90d',
      },
      passwordPolicy: fullOrg?.password_policy ?? 'standard',
      dataResidency: fullOrg?.data_residency ?? 'auto',
    },
  })
})

// GET /:slug/integrations-health
router.get('/:slug/integrations-health', async (req: OrganizationRequest, res) => {
  const orgId = req.organization!.id
  const integrations = await prisma.organizationIntegration.findMany({
    where: { organization_id: orgId },
    select: {
      id: true,
      provider: true,
      status: true,
      connected_at: true,
      updated_at: true,
      last_sync_at: true,
      last_error: true,
      sync_frequency: true,
    },
    orderBy: { connected_at: 'desc' },
  })
  res.json({ success: true, data: integrations })
})

// POST /:slug/scim/tokens - generate a new SCIM bearer token (returned ONCE)
router.post(
  '/:slug/scim/tokens',
  requirePermission('scim.manage'),
  async (req: OrganizationRequest, res) => {
    const orgId = req.organization!.id
    const name = (req.body?.name as string | undefined) ?? null
    const raw = randomBytes(32).toString('base64url')
    const hash = createHash('sha256').update(raw).digest('hex')
    const prefix = raw.slice(0, 8)
    const token = await prisma.scimAccessToken.create({
      data: {
        organization_id: orgId,
        token_hash: hash,
        prefix,
        name,
        created_by_user_id: req.user?.id ?? null,
      },
    })
    res.json({
      success: true,
      data: {
        id: token.id,
        prefix,
        name: token.name,
        created_at: token.created_at,
        // Plaintext token returned ONCE. Frontend must show + copy.
        token: raw,
      },
    })
  }
)

// GET /:slug/scim/tokens - list (metadata only)
router.get(
  '/:slug/scim/tokens',
  requirePermission('scim.manage'),
  async (req: OrganizationRequest, res) => {
    const tokens = await prisma.scimAccessToken.findMany({
      where: { organization_id: req.organization!.id },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        prefix: true,
        name: true,
        created_at: true,
        last_used_at: true,
        revoked_at: true,
      },
    })
    res.json({ success: true, data: tokens })
  }
)

// DELETE /:slug/scim/tokens/:tokenId - revoke
router.delete(
  '/:slug/scim/tokens/:tokenId',
  requirePermission('scim.manage'),
  async (req: OrganizationRequest, res) => {
    await prisma.scimAccessToken.update({
      where: { id: req.params.tokenId },
      data: { revoked_at: new Date() },
    })
    res.json({ success: true })
  }
)

// GET /:slug/webhook-deliveries - inspect webhook delivery rows for this org.
// Defaults to dead-lettered rows; pass ?status=pending|processed|failed|dead.
router.get('/:slug/webhook-deliveries', async (req: OrganizationRequest, res) => {
  const orgId = req.organization!.id
  const status = (req.query.status as string) ?? 'dead'
  const items = await prisma.webhookDelivery.findMany({
    where: { organization_id: orgId, status },
    orderBy: { created_at: 'desc' },
    take: 100,
  })
  res.json({ success: true, data: items })
})

// POST /:slug/webhook-deliveries/:id/retry - re-enqueue a dead-lettered delivery.
router.post('/:slug/webhook-deliveries/:id/retry', async (req: OrganizationRequest, res) => {
  const item = await prisma.webhookDelivery.findFirst({
    where: { id: req.params.id, organization_id: req.organization!.id },
  })
  if (!item) return res.status(404).json({ message: 'Not found' })
  await prisma.webhookDelivery.update({
    where: { id: item.id },
    data: { status: 'pending', last_error: null },
  })
  const q = getWebhookQueue()
  await q.add(
    'process',
    { deliveryId: item.id },
    { attempts: 5, backoff: { type: 'exponential', delay: 1000 } }
  )
  res.json({ success: true })
})

// PUT /:slug/llm-config - set/update BYOK provider + encrypted API key (Enterprise only)
router.put(
  '/:slug/llm-config',
  requirePermission('llm.configure'),
  async (req: OrganizationRequest, res) => {
    const sub = await prisma.subscription.findUnique({
      where: { organization_id: req.organization!.id },
    })
    const planId = sub?.plan_id ?? 'free'
    if (planId !== 'enterprise') {
      return res
        .status(402)
        .json({ success: false, code: 'QUOTA_EXCEEDED', message: 'BYOK requires Enterprise plan' })
    }
    try {
      await setOrgLlmConfig(req.organization!.id, {
        provider: (req.body?.provider as string | null | undefined) ?? null,
        config: req.body?.config as Record<string, unknown> | undefined,
        apiKey: req.body?.apiKey as string | null | undefined,
      })
      await auditLogService
        .logOrgEvent({
          orgId: req.organization!.id,
          actorUserId: req.user?.id ?? null,
          actorEmail: req.user?.email ?? null,
          eventType: 'organization_settings_changed',
          eventCategory: 'security',
          action: 'byok_config_updated',
          metadata: { provider: req.body?.provider ?? null, hasKey: req.body?.apiKey != null },
          ipAddress: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
        })
        .catch(() => {})
      res.json({ success: true })
    } catch (err) {
      res.status(400).json({ success: false, message: (err as Error).message })
    }
  }
)

// GET /:slug/llm-config - read current BYOK config (no plaintext key returned)
router.get(
  '/:slug/llm-config',
  requirePermission('llm.configure'),
  async (req: OrganizationRequest, res) => {
    const org = await prisma.organization.findUnique({
      where: { id: req.organization!.id },
      select: { llm_provider: true, llm_config: true, llm_key_encrypted: true },
    })
    res.json({
      success: true,
      data: {
        provider: org?.llm_provider ?? null,
        config: org?.llm_config ?? null,
        hasKey: !!org?.llm_key_encrypted,
      },
    })
  }
)

// POST /:slug/legal-hold - apply legal hold to org
router.post(
  '/:slug/legal-hold',
  requirePermission('legal_hold.apply'),
  async (req: OrganizationRequest, res) => {
    const until = new Date(req.body?.until)
    if (Number.isNaN(until.getTime()))
      return res.status(400).json({ message: 'Invalid until date' })
    await applyOrgHold(
      req.organization!.id,
      until,
      req.user!.id,
      req.user!.email ?? null,
      req.body?.reason
    )
    res.json({ success: true })
  }
)

// DELETE /:slug/legal-hold - release legal hold
router.delete(
  '/:slug/legal-hold',
  requirePermission('legal_hold.apply'),
  async (req: OrganizationRequest, res) => {
    await releaseOrgHold(req.organization!.id, req.user!.id, req.user!.email ?? null)
    res.json({ success: true })
  }
)

// POST /:slug/ediscovery - admin-only cross-org search
router.post(
  '/:slug/ediscovery',
  requirePermission('ediscovery.search'),
  async (req: OrganizationRequest, res) => {
    const { query, limit, startDate, endDate } = req.body ?? {}
    if (!query) return res.status(400).json({ message: 'query required' })
    const out = await searchOrg({
      orgId: req.organization!.id,
      query,
      limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      actorUserId: req.user!.id,
      actorEmail: req.user!.email ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    })
    res.json({ success: true, data: out })
  }
)

// POST /:slug/members/:memberId/offboard
router.post(
  '/:slug/members/:memberId/offboard',
  requirePermission('member.remove'),
  async (req: OrganizationRequest, res) => {
    try {
      await offboardMember({
        organizationId: req.organization!.id,
        memberId: req.params.memberId,
        actorUserId: req.user!.id,
        actorEmail: req.user!.email ?? null,
        reassignDocsToUserId: req.body?.reassignDocsToUserId,
        hardDelete: !!req.body?.hardDelete,
        reason: req.body?.reason,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      })
      res.json({ success: true })
    } catch (err) {
      res.status(400).json({ success: false, message: (err as Error).message })
    }
  }
)

export default router
