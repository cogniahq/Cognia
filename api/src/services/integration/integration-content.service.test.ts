import test from 'node:test'
import assert from 'node:assert/strict'
import type { ResourceContent } from '@cogniahq/integrations'

import { prepareIntegrationContentForSync } from './integration-content.service'

function createBinaryResource(overrides: Partial<ResourceContent> = {}): ResourceContent {
  return {
    id: 'resource-1',
    externalId: 'resource-1',
    type: 'file',
    title: 'Itinerary.pdf',
    content: '[Binary file: Itinerary.pdf]',
    contentHash: 'placeholder-hash',
    mimeType: 'application/pdf',
    url: 'https://example.com/itinerary.pdf',
    metadata: {},
    createdAt: new Date('2026-03-23T00:00:00.000Z'),
    updatedAt: new Date('2026-03-23T00:00:00.000Z'),
    rawContent: Buffer.from('fake-pdf-binary'),
    ...overrides,
  }
}

test('extracts text from binary PDF resources before the unsupported-type check', async () => {
  const content = createBinaryResource()

  const prepared = await prepareIntegrationContentForSync(content, {
    extractText: async () => ({
      text: 'Rome to Naples ticket',
      pageCount: 1,
    }),
  })

  assert.equal(prepared.shouldSkip, false)
  assert.equal(prepared.content.content, 'Rome to Naples ticket')
  assert.notEqual(prepared.content.contentHash, 'placeholder-hash')
})

test('still skips placeholder content when there is no extractable binary payload', async () => {
  const content = createBinaryResource({
    content: '[Unsupported file type: image/heic]',
    mimeType: 'image/heic',
    rawContent: undefined,
  })

  const prepared = await prepareIntegrationContentForSync(content, {
    extractText: async () => {
      throw new Error('should not be called')
    },
  })

  assert.equal(prepared.shouldSkip, true)
  assert.equal(prepared.content.content, '[Unsupported file type: image/heic]')
})
