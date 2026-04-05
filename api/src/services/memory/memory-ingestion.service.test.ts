import test from 'node:test'
import assert from 'node:assert/strict'

import { memoryIngestionService } from './memory-ingestion.service'
import { prisma } from '../../lib/prisma.lib'

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
  ): Promise<typeof existingMemory[]> => {
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
