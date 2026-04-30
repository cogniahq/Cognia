import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { organizationService } from './organization.service'
import { prisma } from '../../lib/prisma.lib'
import { decryptString } from '../../utils/auth/crypto.util'
import { randomUUID } from 'node:crypto'

after(async () => {
  await prisma.$disconnect()
})

test('updateSecurity: writes typed SSO columns and encrypts client_secret', async () => {
  const org = await prisma.organization.create({
    data: { name: `s-${randomUUID()}`, slug: `s-${randomUUID()}` },
  })
  await organizationService.updateSecurity(org.id, {
    ssoEnabled: true,
    ssoProvider: 'oidc',
    ssoIdpOidcIssuer: 'https://login.microsoftonline.com/test/v2.0',
    ssoIdpOidcClientId: 'test-client',
    ssoIdpOidcClientSecret: 'super-secret-value',
    ssoEmailDomains: ['example.com'],
    ssoEnforced: false,
    ssoRoleMapping: { 'okta-admins': 'ADMIN' },
  })
  const after = await prisma.organization.findUnique({ where: { id: org.id } })
  assert.equal(after?.sso_enabled, true)
  assert.equal(after?.sso_provider, 'oidc')
  assert.deepEqual(after?.sso_email_domains, ['example.com'])
  // Encrypted at rest
  assert.notEqual(after?.sso_idp_oidc_client_secret, 'super-secret-value')
  // Decrypts to original
  const key = process.env.TOKEN_ENCRYPTION_KEY!
  assert.equal(decryptString(after!.sso_idp_oidc_client_secret!, key), 'super-secret-value')
})
