import { SAML } from '@node-saml/node-saml'
import { prisma } from '../../lib/prisma.lib'

export interface SamlConfig {
  entryPoint: string
  issuer: string
  cert: string
  callbackUrl: string
  identifierFormat?: string
}

export async function getSamlConfigForOrg(slug: string): Promise<SamlConfig | null> {
  const org = await prisma.organization.findUnique({ where: { slug } })
  if (!org || !org.sso_enabled || org.sso_provider !== 'saml') return null
  if (!org.sso_idp_entity_id || !org.sso_idp_sso_url || !org.sso_idp_cert) return null
  const baseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3000'
  return {
    entryPoint: org.sso_idp_sso_url,
    issuer: `${baseUrl}/api/sso/saml/${slug}/metadata`,
    cert: org.sso_idp_cert,
    callbackUrl: `${baseUrl}/api/sso/saml/${slug}/acs`,
  }
}

export function buildSaml(cfg: SamlConfig): SAML {
  return new SAML({
    entryPoint: cfg.entryPoint,
    issuer: cfg.issuer,
    // node-saml v5 uses `idpCert` for the IdP signing certificate.
    idpCert: cfg.cert,
    callbackUrl: cfg.callbackUrl,
    identifierFormat:
      cfg.identifierFormat ?? 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    wantAssertionsSigned: true,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
  })
}

export interface SamlProfile {
  email: string
  externalId: string
  groups?: string[]
  name?: string
}

/**
 * Map a SAML profile (from validatePostResponseAsync) to a normalized shape.
 * Falls back to common claim URIs (Microsoft, OASIS).
 */
export function extractProfile(
  profile: Record<string, unknown> | null | undefined,
  attributeEmail = 'email',
  attributeGroups = 'groups'
): SamlProfile {
  const p = (profile ?? {}) as Record<string, unknown>
  const email =
    (p[attributeEmail] as string | undefined) ??
    (p['email'] as string | undefined) ??
    (p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] as
      | string
      | undefined) ??
    (p['nameID'] as string | undefined)
  const externalId =
    (p['nameID'] as string | undefined) ??
    (p['urn:oid:1.3.6.1.4.1.5923.1.1.1.6'] as string | undefined) ??
    email
  const rawGroups =
    p[attributeGroups] ??
    p['groups'] ??
    p['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
    []
  const groups = Array.isArray(rawGroups)
    ? rawGroups.map(String)
    : rawGroups
      ? [String(rawGroups)]
      : []
  const name =
    (p['displayName'] as string | undefined) ?? (p['cn'] as string | undefined) ?? undefined
  if (!email) throw new Error('SAML assertion missing email')
  return {
    email: String(email),
    externalId: String(externalId ?? email),
    groups,
    name,
  }
}
