import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { Response } from 'express'
import { MemoryCrudController } from './memory-crud.controller'
import type { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma.lib'

after(async () => {
  await prisma.$disconnect()
})

interface CapturedResponse {
  statusCode: number
  body: unknown
}

function makeRes(): { res: Response; captured: CapturedResponse } {
  const captured: CapturedResponse = { statusCode: 200, body: undefined }
  const res = {
    status(code: number) {
      captured.statusCode = code
      return this
    },
    json(payload: unknown) {
      captured.body = payload
      return this
    },
  } as unknown as Response
  return { res, captured }
}

function makeReq(userId: string, query: Record<string, string> = {}): AuthenticatedRequest {
  return {
    user: { id: userId },
    query,
  } as unknown as AuthenticatedRequest
}

async function makeUser() {
  return prisma.user.create({ data: { email: `mc-${randomUUID()}@x.io` } })
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

async function makeMemory(
  userId: string,
  title: string,
  organizationId: string | null = null
) {
  return prisma.memory.create({
    data: {
      user_id: userId,
      organization_id: organizationId,
      source: 'test',
      title,
      content: title,
      memory_type: 'LOG_EVENT',
      confidence_score: 0.5,
      timestamp: BigInt(Date.now()),
    },
  })
}

test('memory-crud: getRecentMemories without organizationId returns only personal memories', async () => {
  const user = await makeUser()
  const org = await makeOrg()
  await addMember(org.id, user.id)
  const personal = await makeMemory(user.id, 'personal-only', null)
  await makeMemory(user.id, 'org-only', org.id)

  const { res, captured } = makeRes()
  await MemoryCrudController.getRecentMemories(makeReq(user.id), res)

  assert.equal(captured.statusCode, 200)
  const body = captured.body as { data: { memories: Array<{ id: string; title: string }> } }
  const ids = body.data.memories.map(m => m.id)
  assert.ok(ids.includes(personal.id))
  assert.equal(body.data.memories.every(m => m.title === 'personal-only'), true)
})

test('memory-crud: getRecentMemories with valid organizationId returns only that org memories', async () => {
  const user = await makeUser()
  const org = await makeOrg()
  await addMember(org.id, user.id)
  await makeMemory(user.id, 'personal-only', null)
  const orgMem = await makeMemory(user.id, 'org-only', org.id)

  const { res, captured } = makeRes()
  await MemoryCrudController.getRecentMemories(
    makeReq(user.id, { organizationId: org.id }),
    res
  )

  assert.equal(captured.statusCode, 200)
  const body = captured.body as { data: { memories: Array<{ id: string; title: string }> } }
  assert.equal(body.data.memories.length, 1)
  assert.equal(body.data.memories[0].id, orgMem.id)
})

test('memory-crud: getRecentMemories with foreign organizationId returns 403', async () => {
  const user = await makeUser()
  const foreignOrg = await makeOrg()
  // user is NOT a member of foreignOrg
  await makeMemory(user.id, 'personal-only', null)

  const { res, captured } = makeRes()
  await MemoryCrudController.getRecentMemories(
    makeReq(user.id, { organizationId: foreignOrg.id }),
    res
  )

  assert.equal(captured.statusCode, 403)
  const body = captured.body as { success: boolean; error: string }
  assert.equal(body.success, false)
  assert.match(body.error, /Not a member/)
})

test('memory-crud: getRecentMemories with deactivated membership returns 403', async () => {
  const user = await makeUser()
  const org = await makeOrg()
  await prisma.organizationMember.create({
    data: {
      organization_id: org.id,
      user_id: user.id,
      role: 'VIEWER',
      deactivated_at: new Date(),
    },
  })

  const { res, captured } = makeRes()
  await MemoryCrudController.getRecentMemories(
    makeReq(user.id, { organizationId: org.id }),
    res
  )

  assert.equal(captured.statusCode, 403)
})

test('memory-crud: getUserMemoryCount scopes by personal vs org context', async () => {
  const user = await makeUser()
  const org = await makeOrg()
  await addMember(org.id, user.id)
  await makeMemory(user.id, 'p1', null)
  await makeMemory(user.id, 'p2', null)
  await makeMemory(user.id, 'o1', org.id)

  const personalCall = makeRes()
  await MemoryCrudController.getUserMemoryCount(makeReq(user.id), personalCall.res)
  assert.equal(personalCall.captured.statusCode, 200)
  const personalBody = personalCall.captured.body as { data: { memoryCount: number } }
  assert.equal(personalBody.data.memoryCount, 2)

  const orgCall = makeRes()
  await MemoryCrudController.getUserMemoryCount(
    makeReq(user.id, { organizationId: org.id }),
    orgCall.res
  )
  assert.equal(orgCall.captured.statusCode, 200)
  const orgBody = orgCall.captured.body as { data: { memoryCount: number } }
  assert.equal(orgBody.data.memoryCount, 1)
})

test('memory-crud: getUserMemoryCount rejects foreign org with 403', async () => {
  const user = await makeUser()
  const foreignOrg = await makeOrg()

  const { res, captured } = makeRes()
  await MemoryCrudController.getUserMemoryCount(
    makeReq(user.id, { organizationId: foreignOrg.id }),
    res
  )
  assert.equal(captured.statusCode, 403)
})
