import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { memoryIngestionService } from './memory-ingestion.service'
import { prisma } from '../../lib/prisma.lib'

after(async () => {
  await prisma.$disconnect()
})

test('extension ingestion deduplicates repeated captures of the same page even when the content drifts', async () => {
  const originalFindFirst = prisma.memory.findFirst
  const originalFindMany = prisma.memory.findMany

  const existingMemory: {
    id: string
    title: string
    url: string
    timestamp: bigint
    created_at: Date
    content: string
    source: string
    page_metadata: Record<string, unknown> | null
    canonical_text: string
    canonical_hash: string
    importance_score: number
    confidence_score: number
    access_count: number
    memory_type: null
  } = {
    id: 'memory-existing',
    title: 'StatsTerminal',
    url: 'https://www.statsterminal.com/dashboard?session=alpha',
    timestamp: BigInt(1712200000),
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000),
    content:
      'StatsTerminal dashboard. Positions, pnl, market breadth, alerts, sector map, option chain, trade blotter.',
    source: 'extension',
    page_metadata: null,
    canonical_text: 'existing canonical text',
    canonical_hash: 'existing-hash',
    importance_score: 0.7,
    confidence_score: 0.8,
    access_count: 3,
    memory_type: null,
  }

  prisma.memory.findFirst = (async (): Promise<null> => null) as typeof prisma.memory.findFirst

  prisma.memory.findMany = (async (
    args:
      | {
          where?: {
            created_at?: unknown
          }
        }
      | undefined
  ): Promise<(typeof existingMemory)[]> => {
    const createdAt = args?.where && 'created_at' in args.where ? args.where.created_at : undefined
    const gte =
      createdAt &&
      typeof createdAt === 'object' &&
      'gte' in createdAt &&
      createdAt.gte instanceof Date
        ? createdAt.gte
        : undefined

    if (gte && existingMemory.created_at < gte) {
      return []
    }

    return [existingMemory]
  }) as unknown as typeof prisma.memory.findMany

  try {
    const incomingContent =
      'StatsTerminal dashboard. Positions, pnl, market breadth, alerts, sector map, watchlist, rebalance monitor.'
    const canonicalData = memoryIngestionService.canonicalizeContent(
      incomingContent,
      'https://www.statsterminal.com/dashboard?session=beta'
    )

    const duplicate = await memoryIngestionService.findDuplicateMemory({
      userId: 'user-1',
      canonicalHash: 'new-hash',
      canonicalText: canonicalData.canonicalText,
      url: 'https://www.statsterminal.com/dashboard?session=beta',
      title: 'StatsTerminal',
      source: 'extension',
    })

    assert.deepEqual(duplicate, {
      memory: existingMemory,
      reason: 'url',
    })
  } finally {
    prisma.memory.findFirst = originalFindFirst
    prisma.memory.findMany = originalFindMany
  }
})

async function makeUser() {
  return prisma.user.create({ data: { email: `i-${randomUUID()}@x.io` } })
}

async function makeOrg() {
  return prisma.organization.create({
    data: { name: `org-${randomUUID()}`, slug: `org-${randomUUID()}` },
  })
}

async function addMember(orgId: string, userId: string) {
  return prisma.organizationMember.create({
    data: { organization_id: orgId, user_id: userId, role: 'VIEWER' },
  })
}

async function buildBasePayload(userId: string, metadata: Record<string, unknown>) {
  const content = `ingestion test ${randomUUID()}`
  const canonical = memoryIngestionService.canonicalizeContent(content)
  return {
    userId,
    title: 't',
    url: 'https://example.com/x',
    source: 'test',
    content,
    contentPreview: content,
    metadata,
    canonicalText: canonical.canonicalText,
    canonicalHash: canonical.canonicalHash,
  }
}

test('ingestion: workspace_id with valid (org, member, workspace) connects workspace', async () => {
  const u = await makeUser()
  const org = await makeOrg()
  await addMember(org.id, u.id)
  const workspace = await prisma.workspace.create({
    data: {
      organization_id: org.id,
      name: `ws-${randomUUID()}`,
      slug: `ws-${randomUUID()}`,
    },
  })

  const input = await buildBasePayload(u.id, {
    organization_id: org.id,
    workspace_id: workspace.id,
  })
  const created = await memoryIngestionService.buildMemoryCreatePayload(input)
  const memory = await prisma.memory.create({ data: created })

  assert.equal(memory.organization_id, org.id)
  assert.equal(memory.workspace_id, workspace.id)
})

test('ingestion: workspace_id without organization_id throws', async () => {
  const u = await makeUser()
  const org = await makeOrg()
  await addMember(org.id, u.id)
  const workspace = await prisma.workspace.create({
    data: {
      organization_id: org.id,
      name: `ws-${randomUUID()}`,
      slug: `ws-${randomUUID()}`,
    },
  })

  const input = await buildBasePayload(u.id, {
    workspace_id: workspace.id,
  })
  await assert.rejects(
    () => memoryIngestionService.buildMemoryCreatePayload(input),
    /workspace_id requires organization_id/
  )
})

test('ingestion: workspace_id from foreign org rejected', async () => {
  const u = await makeUser()
  const myOrg = await makeOrg()
  await addMember(myOrg.id, u.id)
  const otherOrg = await makeOrg()
  const otherWorkspace = await prisma.workspace.create({
    data: {
      organization_id: otherOrg.id,
      name: `ws-${randomUUID()}`,
      slug: `ws-${randomUUID()}`,
    },
  })

  const input = await buildBasePayload(u.id, {
    organization_id: myOrg.id,
    workspace_id: otherWorkspace.id,
  })
  await assert.rejects(
    () => memoryIngestionService.buildMemoryCreatePayload(input),
    /Workspace not found in the specified organization/
  )
})

test('ingestion: organization_id without workspace_id connects org only (regression)', async () => {
  const u = await makeUser()
  const org = await makeOrg()
  await addMember(org.id, u.id)

  const input = await buildBasePayload(u.id, {
    organization_id: org.id,
  })
  const created = await memoryIngestionService.buildMemoryCreatePayload(input)
  const memory = await prisma.memory.create({ data: created })

  assert.equal(memory.organization_id, org.id)
  assert.equal(memory.workspace_id, null)
})

test('ingestion: organization_id with non-member user throws', async () => {
  const u = await makeUser()
  const org = await makeOrg() // no membership added

  const input = await buildBasePayload(u.id, {
    organization_id: org.id,
  })
  await assert.rejects(
    () => memoryIngestionService.buildMemoryCreatePayload(input),
    /not an active member of the specified organization/
  )
})
