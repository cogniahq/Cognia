import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getActiveEmbeddingModelName,
  getConfiguredEmbeddingDimension,
  getEmbedProvider,
  getGenerationProvider,
  getOpenAIChatModel,
  getOpenAIVisionModel,
} from './ai-config'
import { openaiService } from './openai.service'

const ORIGINAL_ENV = { ...process.env }

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value
  }
}

test.afterEach(() => {
  restoreEnv()
})

test('defaults generation and embedding providers to OpenAI', () => {
  delete process.env.AI_PROVIDER
  delete process.env.EMBED_PROVIDER
  delete process.env.GEN_PROVIDER

  assert.equal(getEmbedProvider(), 'openai')
  assert.equal(getGenerationProvider(), 'openai')
})

test('derives OpenAI embedding dimension from the configured embedding model', () => {
  process.env.EMBED_PROVIDER = 'openai'
  process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-large'
  delete process.env.EMBEDDING_DIMENSION

  assert.equal(getConfiguredEmbeddingDimension(), 3072)
  assert.equal(getActiveEmbeddingModelName(), 'text-embedding-3-large')
})

test('derives the small OpenAI embedding dimension when configured for text-embedding-3-small', () => {
  process.env.EMBED_PROVIDER = 'openai'
  process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
  delete process.env.EMBEDDING_DIMENSION

  assert.equal(getConfiguredEmbeddingDimension(), 1536)
  assert.equal(getActiveEmbeddingModelName(), 'text-embedding-3-small')
})

test('honors an explicit embedding dimension override', () => {
  process.env.EMBED_PROVIDER = 'openai'
  process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
  process.env.EMBEDDING_DIMENSION = '2048'

  assert.equal(getConfiguredEmbeddingDimension(), 2048)
})

test('openai service initialization follows the current environment', () => {
  delete process.env.OPENAI_API_KEY
  assert.equal(openaiService.isInitialized, false)

  process.env.OPENAI_API_KEY = 'test-openai-key'
  assert.equal(openaiService.isInitialized, true)
})

test('uses gpt-4o-mini when configured as the OpenAI chat model', () => {
  process.env.OPENAI_CHAT_MODEL = 'gpt-4o-mini'

  assert.equal(getOpenAIChatModel(), 'gpt-4o-mini')
})

test('defaults the OpenAI vision model to gpt-4o-mini', () => {
  delete process.env.OPENAI_VISION_MODEL

  assert.equal(getOpenAIVisionModel(), 'gpt-4o-mini')
})
