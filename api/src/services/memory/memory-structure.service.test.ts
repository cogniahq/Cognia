import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMemoryPreviewText,
  buildMemoryRetrievalText,
  extractStructuredMemoryData,
} from './memory-structure.service'
import { memoryIngestionService } from './memory-ingestion.service'

test('extracts structured commerce facts from transactional content during ingestion', () => {
  const structured = extractStructuredMemoryData({
    title: 'H&M Order Confirmation',
    url: 'https://mail.google.com/mail/u/0/#inbox/example',
    source: 'extension',
    content: `Subject: H&M Order Confirmation
From: H&M
Your order number is HNM-12345.
Total paid: $48.99.
Expected delivery date: March 28, 2026.
Items: Cotton t-shirt and black jeans.`,
    metadata: {
      content_type: 'email_thread',
      participants: ['H&M', 'vlbhartiya@gmail.com'],
    },
  })

  assert.equal(structured.contentType, 'email_thread')
  assert.ok(structured.categories.includes('commerce'))
  assert.ok(structured.categories.includes('email'))
  assert.deepEqual(structured.extractedEntities.orderNumbers, ['HNM-12345'])
  assert.deepEqual(structured.extractedEntities.currencyAmounts, ['$48.99'])
  assert.ok(structured.searchableTerms.includes('hnm-12345'))
  assert.match(structured.structuredSummary, /H&M Order Confirmation/i)
  assert.match(structured.retrievalText, /Order number: HNM-12345/i)
})

test('buildMemoryPreviewText and buildMemoryRetrievalText prefer structured metadata over raw content', () => {
  const pageMetadata = {
    structuredSummary: 'Order confirmation for a recent H&M purchase.',
    representativeExcerpt: 'Total paid: $48.99.',
    keyFacts: ['Order number: HNM-12345', 'Amount: $48.99'],
    searchableTerms: ['h&m', 'hnm-12345', 'receipt'],
    retrievalText:
      'Summary: Order confirmation for a recent H&M purchase.\nKey facts: Order number: HNM-12345 | Amount: $48.99',
  }

  assert.equal(
    buildMemoryPreviewText({
      title: 'Ignored title',
      content: 'Raw content that should not lead the preview.',
      pageMetadata,
    }),
    'Order confirmation for a recent H&M purchase.'
  )

  assert.match(
    buildMemoryRetrievalText({
      title: 'Ignored title',
      content: 'Raw content that should not lead retrieval.',
      pageMetadata,
    }),
    /HNM-12345/
  )
})

test('memory ingestion flattens source page metadata and stores structured retrieval fields', () => {
  const pageMetadata = memoryIngestionService.buildPageMetadata(
    {
      source: 'extension',
      content_type: 'email_thread',
      page_metadata: {
        email_provider: 'gmail',
        participants: ['H&M', 'vlbhartiya@gmail.com'],
      },
    },
    {
      title: 'H&M Order Confirmation',
      url: 'https://mail.google.com/mail/u/0/#inbox/example',
      source: 'extension',
      content:
        'Subject: H&M Order Confirmation. Your order number is HNM-12345. Total paid: $48.99.',
    }
  )

  assert.equal(pageMetadata.email_provider, 'gmail')
  assert.deepEqual(pageMetadata.participants, ['H&M', 'vlbhartiya@gmail.com'])
  assert.equal(pageMetadata.content_type, 'email_thread')
  assert.equal(pageMetadata.ingestionVersion, 'structured-memory-v1')
  assert.match(String(pageMetadata.structuredSummary), /H&M Order Confirmation/i)
  assert.match(String(pageMetadata.retrievalText), /HNM-12345/)
})

test('memory ingestion normalizes source timestamps to Unix seconds', () => {
  const memory = memoryIngestionService.buildMemoryCreatePayload({
    userId: 'user-123',
    title: 'Imported note',
    url: 'https://example.com/note',
    source: 'notion',
    content: 'Imported content',
    metadata: {
      source_type: 'INTEGRATION',
      timestamp: 1_711_987_200_123,
    },
    canonicalText: 'imported content',
    canonicalHash: 'hash-123',
  })

  assert.equal(memory.timestamp, BigInt(1_711_987_200))
  assert.equal(
    (memory.page_metadata as { timestamp?: number }).timestamp,
    1_711_987_200
  )
})
