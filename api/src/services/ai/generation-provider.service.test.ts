import test from 'node:test'
import assert from 'node:assert/strict'

import {
  generationProviderService,
  shouldRetryGenerationError,
} from './generation-provider.service'
import { openaiService } from './openai.service'

test('generation provider does not retry unrecoverable OpenAI rate limit errors', () => {
  assert.equal(
    shouldRetryGenerationError({
      status: 429,
      message:
        '429 Rate limit reached for gpt-4o-mini on requests per day (RPD): Limit 200, Used 200, Requested 1.',
    }),
    false
  )

  assert.equal(
    shouldRetryGenerationError({
      status: 429,
      message:
        '429 Request too large for gpt-4o-mini on tokens per min (TPM): Limit 60000, Requested 111714.',
    }),
    false
  )

  assert.equal(
    shouldRetryGenerationError({
      status: 429,
      message:
        '429 Rate limit reached for gpt-4o-mini on requests per min (RPM): Limit 3, Used 3, Requested 1.',
    }),
    true
  )
})

test('generation provider blocks non-search OpenAI generation when search-only mode is enabled', async () => {
  const originalMode = process.env.OPENAI_SEARCH_ONLY_MODE
  const originalProvider = process.env.GEN_PROVIDER
  const originalGenerateContent = openaiService.generateContent

  let openAICalls = 0

  process.env.OPENAI_SEARCH_ONLY_MODE = 'true'
  process.env.GEN_PROVIDER = 'openai'

  openaiService.generateContent = (async () => {
    openAICalls += 1
    return {
      text: 'should not be called',
      modelUsed: 'gpt-4o-mini',
    }
  }) as typeof openaiService.generateContent

  try {
    await assert.rejects(
      generationProviderService.generateContent('background profile extraction prompt', false),
      /reserved for search/i
    )
    assert.equal(openAICalls, 0)
  } finally {
    if (typeof originalMode === 'undefined') {
      delete process.env.OPENAI_SEARCH_ONLY_MODE
    } else {
      process.env.OPENAI_SEARCH_ONLY_MODE = originalMode
    }

    if (typeof originalProvider === 'undefined') {
      delete process.env.GEN_PROVIDER
    } else {
      process.env.GEN_PROVIDER = originalProvider
    }

    openaiService.generateContent = originalGenerateContent
  }
})

test('generation provider still allows search OpenAI generation when search-only mode is enabled', async () => {
  const originalMode = process.env.OPENAI_SEARCH_ONLY_MODE
  const originalProvider = process.env.GEN_PROVIDER
  const originalGenerateContent = openaiService.generateContent

  let openAICalls = 0

  process.env.OPENAI_SEARCH_ONLY_MODE = 'true'
  process.env.GEN_PROVIDER = 'openai'

  openaiService.generateContent = (async (_prompt: string, isSearchRequest?: boolean) => {
    openAICalls += 1
    assert.equal(isSearchRequest, true)
    return {
      text: 'search answer',
      modelUsed: 'gpt-4o-mini',
    }
  }) as typeof openaiService.generateContent

  try {
    const result = await generationProviderService.generateContent('search prompt', true)
    assert.equal(result, 'search answer')
    assert.equal(openAICalls, 1)
  } finally {
    if (typeof originalMode === 'undefined') {
      delete process.env.OPENAI_SEARCH_ONLY_MODE
    } else {
      process.env.OPENAI_SEARCH_ONLY_MODE = originalMode
    }

    if (typeof originalProvider === 'undefined') {
      delete process.env.GEN_PROVIDER
    } else {
      process.env.GEN_PROVIDER = originalProvider
    }

    openaiService.generateContent = originalGenerateContent
  }
})

test('generation provider allows email draft OpenAI generation when search-only mode is enabled', async () => {
  const originalMode = process.env.OPENAI_SEARCH_ONLY_MODE
  const originalProvider = process.env.GEN_PROVIDER
  const originalGenerateContent = openaiService.generateContent

  let openAICalls = 0

  process.env.OPENAI_SEARCH_ONLY_MODE = 'true'
  process.env.GEN_PROVIDER = 'openai'

  openaiService.generateContent = (async (_prompt: string, isSearchRequest?: boolean) => {
    openAICalls += 1
    assert.equal(isSearchRequest, false)
    return {
      text: 'draft answer',
      modelUsed: 'gpt-4o-mini',
    }
  }) as typeof openaiService.generateContent

  try {
    const result = await generationProviderService.generateContent(
      'email draft prompt',
      false,
      undefined,
      undefined,
      true
    )
    assert.equal(result, 'draft answer')
    assert.equal(openAICalls, 1)
  } finally {
    if (typeof originalMode === 'undefined') {
      delete process.env.OPENAI_SEARCH_ONLY_MODE
    } else {
      process.env.OPENAI_SEARCH_ONLY_MODE = originalMode
    }

    if (typeof originalProvider === 'undefined') {
      delete process.env.GEN_PROVIDER
    } else {
      process.env.GEN_PROVIDER = originalProvider
    }

    openaiService.generateContent = originalGenerateContent
  }
})
