import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireOrganization, requireOrgAdmin } from '../middleware/organization.middleware'
import type { OrganizationRequest } from '../middleware/organization.middleware'
import { auditLogService } from '../services/core/audit-log.service'
import { prisma } from '../lib/prisma.lib'
import type { AuditEventType, AuditEventCategory } from '../types/common.types'

const router = Router({ mergeParams: true })

// Apply auth + org membership + admin check to every route
router.use('/:slug', authenticateToken, requireOrganization, requireOrgAdmin)

// GET /:slug/activity - paginated audit log
router.get('/:slug/activity', async (req: OrganizationRequest, res) => {
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
})

// GET /:slug/activity/export.csv
router.get('/:slug/activity/export.csv', async (req: OrganizationRequest, res) => {
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
    metadata: { rows: result.logs.length, filters: { eventType, eventCategory, startDate, endDate } },
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
    const userEmail = (log as unknown as { user?: { email?: string } }).user?.email ?? log.actor_email ?? ''
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
})

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

export default router
