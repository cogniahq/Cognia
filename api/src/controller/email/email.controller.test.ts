import test from 'node:test'
import assert from 'node:assert/strict'
import type { NextFunction, Response } from 'express'

import { EmailController } from './email.controller'
import type { AuthenticatedRequest } from '../../middleware/auth.middleware'
import { aiProvider } from '../../services/ai/ai-provider.service'
import { profileUpdateService } from '../../services/profile/profile-update.service'
import * as memorySearchService from '../../services/memory/memory-search.service'

test('email controller marks draft generation as an email draft request', async () => {
  const originalGetProfileContext = profileUpdateService.getProfileContext
  const originalSearchMemories = memorySearchService.searchMemories
  const originalGenerateContent = aiProvider.generateContent

  let generationArgs: unknown[] | null = null
  let statusCode: number | null = null
  let jsonPayload: unknown
  let nextError: unknown

  profileUpdateService.getProfileContext = (async () =>
    'profile context') as typeof originalGetProfileContext
  ;(
    memorySearchService as { searchMemories: typeof memorySearchService.searchMemories }
  ).searchMemories = (async () => ({
    query: 'thread',
    results: [] as never[],
    context: 'memory context',
    contextBlocks: [] as never[],
    policy: 'chat',
  })) as unknown as typeof originalSearchMemories
  aiProvider.generateContent = (async (...args: unknown[]) => {
    generationArgs = args
    return JSON.stringify({
      subject: 'Re: Draft',
      body: 'Thanks for the note.',
      summary: 'Drafted reply',
    })
  }) as typeof originalGenerateContent

  const req = {
    user: { id: 'user-1' },
    body: {
      thread_text: 'Original email thread',
      subject: 'Hello',
    },
  } as AuthenticatedRequest

  const res = {
    status(code: number) {
      statusCode = code
      return this
    },
    json(payload: unknown) {
      jsonPayload = payload
      return this
    },
  } as unknown as Response

  const next: NextFunction = error => {
    nextError = error
  }

  try {
    await EmailController.draftEmailReply(req, res, next)

    assert.equal(nextError, undefined)
    assert.equal(statusCode, 200)
    assert.deepEqual(jsonPayload, {
      success: true,
      data: {
        subject: 'Re: Draft',
        body: 'Thanks for the note.',
        summary: 'Drafted reply',
      },
    })
    assert.ok(generationArgs)
    assert.equal(generationArgs?.[1], false)
    assert.equal(generationArgs?.[2], 'user-1')
    assert.equal(generationArgs?.[4], true)
  } finally {
    profileUpdateService.getProfileContext = originalGetProfileContext
    ;(
      memorySearchService as { searchMemories: typeof memorySearchService.searchMemories }
    ).searchMemories = originalSearchMemories
    aiProvider.generateContent = originalGenerateContent
  }
})
