import test from 'node:test'
import assert from 'node:assert/strict'

import { deduplicateSearchRows } from './result-formatter.service'

test('search collapses duplicate extension captures from the same page into the highest-ranked result', () => {
  const deduplicated = deduplicateSearchRows([
    {
      id: 'memory-1',
      title: 'StatsTerminal',
      url: 'https://www.statsterminal.com/dashboard?session=alpha',
      timestamp: 1712200000,
      content:
        'StatsTerminal dashboard with positions, pnl, market breadth, sector map, alerts, and option chain.',
      content_preview: 'Positions, pnl, breadth, and alerts.',
      score: 0.93,
      final_score: 0.93,
      semantic_score: 0.93,
      keyword_score: 0.8,
      coverage_ratio: 1,
      memory_type: null,
      importance_score: 0.7,
      source: 'extension',
      created_at: new Date('2026-04-04T10:00:00.000Z'),
      page_metadata: {},
    },
    {
      id: 'memory-2',
      title: 'StatsTerminal',
      url: 'https://www.statsterminal.com/dashboard?session=beta',
      timestamp: 1712203600,
      content:
        'StatsTerminal dashboard with positions, pnl, market breadth, sector map, alerts, and watchlist rebalance.',
      content_preview: 'Positions, pnl, breadth, alerts, and watchlist rebalance.',
      score: 0.97,
      final_score: 0.97,
      semantic_score: 0.97,
      keyword_score: 0.9,
      coverage_ratio: 1,
      memory_type: null,
      importance_score: 0.72,
      source: 'extension',
      created_at: new Date('2026-04-04T10:05:00.000Z'),
      page_metadata: {},
    },
    {
      id: 'memory-3',
      title: 'StatsTerminal Invoice',
      url: 'https://mail.google.com/mail/u/0/#inbox/abc123',
      timestamp: 1712207200,
      content: 'Email about the StatsTerminal invoice.',
      content_preview: 'Invoice email.',
      score: 0.88,
      final_score: 0.88,
      semantic_score: 0.88,
      keyword_score: 0.7,
      coverage_ratio: 0.8,
      memory_type: null,
      importance_score: 0.4,
      source: 'gmail',
      created_at: new Date('2026-04-04T10:10:00.000Z'),
      page_metadata: {},
    },
  ])

  assert.deepEqual(
    deduplicated.map(row => row.id),
    ['memory-2', 'memory-3']
  )
})
