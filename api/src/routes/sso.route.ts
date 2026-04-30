import { Router, type Request, type Response } from 'express'
import { prisma } from '../lib/prisma.lib'
import { generateToken } from '../utils/auth/jwt.util'
import { issueRefreshToken } from '../services/auth/refresh-token.service'
import { auditLogService } from '../services/core/audit-log.service'
import { provisionFromAssertion } from '../services/sso/jit-provisioning.service'
import { buildSaml, extractProfile, getSamlConfigForOrg } from '../services/sso/saml.service'
import {
  buildOidcAuthUrl,
  completeOidcCallback,
  getOidcClientForOrg,
} from '../services/sso/oidc.service'

const router = Router()

// ─────────────────────────────────────────────────────────────
// In-memory PKCE/nonce store keyed by state. Production-grade
// deployments should persist to Redis. State is short-lived (10m).
// ─────────────────────────────────────────────────────────────
interface OidcStateEntry {
  codeVerifier: string
  nonce: string
  orgSlug: string
  returnTo: string
  expiresAt: number
}
const oidcStateStore = new Map<string, OidcStateEntry>()
function cleanupExpired() {
  const now = Date.now()
  for (const [k, v] of oidcStateStore) if (v.expiresAt < now) oidcStateStore.delete(k)
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie('cognia_refresh', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 14 * 24 * 60 * 60 * 1000,
  })
}

// ============================================================
// SAML
// ============================================================

/** SP metadata XML — give to IdP admin. */
router.get('/saml/:slug/metadata', async (req: Request, res: Response) => {
  const cfg = await getSamlConfigForOrg(req.params.slug)
  if (!cfg) {
    return res.status(404).type('text/plain').send('SAML not configured for this org')
  }
  const saml = buildSaml(cfg)
  // node-saml v5: pass `null` for decryptionCert when SP-initiated decryption isn't used.
  const xml = saml.generateServiceProviderMetadata(null, cfg.cert)
  res.type('application/xml').send(xml)
})

/** Initiate login — redirect to IdP. */
router.get('/saml/:slug/login', async (req: Request, res: Response) => {
  const cfg = await getSamlConfigForOrg(req.params.slug)
  if (!cfg) return res.status(404).json({ message: 'SAML not configured for this org' })
  const saml = buildSaml(cfg)
  const url = await saml.getAuthorizeUrlAsync('', req.headers.host as string, {})
  res.redirect(url)
})

/** Assertion Consumer Service — IdP POSTs SAMLResponse here. */
router.post('/saml/:slug/acs', async (req: Request, res: Response) => {
  const cfg = await getSamlConfigForOrg(req.params.slug)
  if (!cfg) return res.status(404).json({ message: 'SAML not configured for this org' })
  const saml = buildSaml(cfg)
  const samlResponse = (req.body as Record<string, string> | undefined)?.SAMLResponse
  if (!samlResponse) return res.status(400).json({ message: 'Missing SAMLResponse' })
  try {
    const { profile } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse })
    if (!profile) throw new Error('No profile in SAML response')
    const org = await prisma.organization.findUnique({ where: { slug: req.params.slug } })
    const extracted = extractProfile(
      profile as unknown as Record<string, unknown>,
      org?.sso_attribute_email ?? 'email',
      org?.sso_attribute_groups ?? 'groups'
    )
    const result = await provisionFromAssertion({
      email: extracted.email,
      externalId: extracted.externalId,
      groups: extracted.groups,
      name: extracted.name,
      orgSlug: req.params.slug,
    })
    const accessToken = generateToken({ userId: result.userId })
    const { token: refreshToken } = await issueRefreshToken(result.userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    })
    setRefreshCookie(res, refreshToken)
    auditLogService
      .logOrgEvent({
        orgId: result.organizationId,
        actorUserId: result.userId,
        actorEmail: extracted.email,
        eventType: 'sso_login',
        eventCategory: 'authentication',
        action: 'saml-login',
        metadata: {
          isNewUser: result.isNewUser,
          isNewMember: result.isNewMember,
          role: result.role,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      })
      .catch(() => {
        /* audit best-effort */
      })
    const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173'
    res.redirect(`${appUrl}/?token=${encodeURIComponent(accessToken)}`)
  } catch (err) {
    res.status(401).json({ message: 'SAML validation failed', detail: (err as Error).message })
  }
})

// ============================================================
// OIDC (openid-client v6 functional API)
// ============================================================

router.get('/oidc/:slug/login', async (req: Request, res: Response) => {
  const out = await getOidcClientForOrg(req.params.slug)
  if (!out) return res.status(404).json({ message: 'OIDC not configured for this org' })
  const { url, state, nonce, codeVerifier } = await buildOidcAuthUrl(out.config, out.redirectUri)
  oidcStateStore.set(state, {
    codeVerifier,
    nonce,
    orgSlug: req.params.slug,
    returnTo: (req.query.returnTo as string) || '/',
    expiresAt: Date.now() + 10 * 60 * 1000,
  })
  cleanupExpired()
  res.redirect(url)
})

router.get('/oidc/:slug/callback', async (req: Request, res: Response) => {
  const out = await getOidcClientForOrg(req.params.slug)
  if (!out) return res.status(404).json({ message: 'OIDC not configured for this org' })
  const stateParam = typeof req.query.state === 'string' ? req.query.state : undefined
  const stateData = stateParam ? oidcStateStore.get(stateParam) : undefined
  if (!stateData || !stateParam) {
    return res.status(400).json({ message: 'Invalid state' })
  }
  oidcStateStore.delete(stateParam)
  if (stateData.orgSlug !== req.params.slug) {
    return res.status(400).json({ message: 'State/org mismatch' })
  }
  try {
    // Construct the absolute callback URL (used as `currentUrl` for the v6 grant).
    const currentUrl = new URL(out.redirectUri)
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') currentUrl.searchParams.set(k, v)
    }
    const profile = await completeOidcCallback(
      out.config,
      currentUrl,
      stateData.nonce,
      stateParam,
      stateData.codeVerifier
    )
    const result = await provisionFromAssertion({
      email: profile.email,
      externalId: profile.sub,
      groups: profile.groups,
      name: profile.name,
      orgSlug: req.params.slug,
    })
    const accessToken = generateToken({ userId: result.userId })
    const { token: refreshToken } = await issueRefreshToken(result.userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    })
    setRefreshCookie(res, refreshToken)
    auditLogService
      .logOrgEvent({
        orgId: result.organizationId,
        actorUserId: result.userId,
        actorEmail: profile.email,
        eventType: 'sso_login',
        eventCategory: 'authentication',
        action: 'oidc-login',
        metadata: {
          isNewUser: result.isNewUser,
          isNewMember: result.isNewMember,
          role: result.role,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      })
      .catch(() => {
        /* audit best-effort */
      })
    const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173'
    const redirectTarget = stateData.returnTo.startsWith('http')
      ? stateData.returnTo
      : `${appUrl}${stateData.returnTo}`
    res.redirect(`${redirectTarget}?token=${encodeURIComponent(accessToken)}`)
  } catch (err) {
    res.status(401).json({ message: 'OIDC callback failed', detail: (err as Error).message })
  }
})

// ============================================================
// Discovery — let the login screen check whether SSO is available
// for an email's domain (and whether it's enforced).
// ============================================================

router.post('/discover', async (req: Request, res: Response) => {
  const { email } = (req.body ?? {}) as { email?: string }
  if (!email) return res.status(400).json({ message: 'email required' })
  const domain = String(email).split('@')[1]?.toLowerCase()
  if (!domain) return res.json({ ssoAvailable: false })
  const orgs = await prisma.organization.findMany({
    where: { sso_enabled: true, sso_email_domains: { has: domain } },
    select: { slug: true, sso_provider: true, sso_enforced: true, name: true },
  })
  if (orgs.length === 0) return res.json({ ssoAvailable: false })
  const org = orgs[0]
  res.json({
    ssoAvailable: true,
    enforced: org.sso_enforced,
    orgSlug: org.slug,
    orgName: org.name,
    loginUrl: `/api/sso/${org.sso_provider}/${org.slug}/login`,
  })
})

export default router
