import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { getLlmCredentialsForOrg, setOrgLlmConfig } from './byok-router.service'
import { prisma } from '../../lib/prisma.lib'

// Ensure TOKEN_ENCRYPTION_KEY is present for the test run.
if (!process.env.TOKEN_ENCRYPTION_KEY) {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('hex')
}

after(async () => {
  await prisma.$disconnect()
})

test('byok: org without config returns system credentials', async () => {
  const org = await prisma.organization.create({
    data: { name: `b-${randomUUID()}`, slug: `b-${randomUUID()}` },
  })
  const creds = await getLlmCredentialsForOrg(org.id)
  assert.equal(creds.provider, 'system')
})

test('byok: setting and reading anthropic key round-trips encrypted', async () => {
  const org = await prisma.organization.create({
    data: { name: `b-${randomUUID()}`, slug: `b-${randomUUID()}` },
  })
  await setOrgLlmConfig(org.id, {
    provider: 'anthropic',
    apiKey: 'sk-ant-test-key',
    config: { region: 'us-east-1' },
  })
  const creds = await getLlmCredentialsForOrg(org.id)
  assert.equal(creds.provider, 'anthropic')
  assert.equal(creds.apiKey, 'sk-ant-test-key')
  assert.equal(creds.config?.region, 'us-east-1')

  // DB column must NOT contain plaintext.
  const fresh = await prisma.organization.findUnique({ where: { id: org.id } })
  assert.notEqual(fresh?.llm_key_encrypted, 'sk-ant-test-key')
  assert.ok(fresh?.llm_key_encrypted && fresh.llm_key_encrypted.length > 16)
})

test('byok: clearing key returns system fallback', async () => {
  const org = await prisma.organization.create({
    data: { name: `b-${randomUUID()}`, slug: `b-${randomUUID()}` },
  })
  await setOrgLlmConfig(org.id, { provider: 'anthropic', apiKey: 'sk-ant-test' })
  await setOrgLlmConfig(org.id, { provider: null, apiKey: null })
  const creds = await getLlmCredentialsForOrg(org.id)
  assert.equal(creds.provider, 'system')
})

test('byok: null orgId returns system credentials', async () => {
  const creds = await getLlmCredentialsForOrg(null)
  assert.equal(creds.provider, 'system')
})
