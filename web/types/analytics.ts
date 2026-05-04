/**
 * Analytics dashboard shape. Mirrors client/src/types/analytics/index.ts —
 * served by GET /api/memory/analytics. Keep this in lock-step with the
 * server's response so the UI's chart sections don't need to re-shape
 * incoming JSON.
 */

export interface AnalyticsData {
  overview: {
    totalMemories: number
    totalTokens: number
    totalInputTokens: number
    totalOutputTokens: number
    totalSearches: number
    mostActiveDomain: string | null
    averageContentLength: number
    totalContentProcessed: number
  }
  tokenUsage: {
    total: number
    totalInput: number
    totalOutput: number
    count: number
    byOperation: Record<
      string,
      { input: number; output: number; total: number; count: number }
    >
    byDate: Record<string, { input: number; output: number; total: number }>
    averagePerMemory: number
  }
  memoryStatistics: {
    total: number
    byDomain: Record<string, number>
    bySource: Record<string, number>
    byDate: Record<string, number>
    averageContentLength: number
    totalContentProcessed: number
  }
  domainAnalytics: {
    topDomains: Array<{ domain: string; count: number }>
    totalDomains: number
    mostActiveDomain: string | null
  }
  contentAnalytics: {
    averageContentLength: number
    totalContentProcessed: number
    byCategory: Record<string, number>
    bySentiment: Record<string, number>
  }
  searchAnalytics: {
    totalSearches: number
    averageResultsPerSearch: number
    byDate: Record<string, number>
  }
  activityAnalytics: {
    memoriesByDate: Record<string, number>
    memoriesByHour: Record<number, number>
    memoriesByDayOfWeek: Record<number, number>
    peakHour: number | null
    peakDayOfWeek: string | null
    totalMemories: number
  }
  relationshipAnalytics: {
    totalRelations: number
    averageConnectionsPerMemory: number
    strongestRelations: Array<{ similarity: number }>
  }
  snapshotAnalytics: {
    totalSnapshots: number
    averageSnapshotsPerMemory: number
  }
  categoryTopicAnalytics: {
    topCategories: Array<{ category: string; count: number }>
    topTopics: Array<{ topic: string; count: number }>
    sentimentDistribution: Record<string, number>
  }
  growthAnalytics: {
    daysSinceFirst: number
    daysSinceLast: number
    memoriesPerDay: number
    tokensPerDay: number
    recentMemories7Days: number
    recentMemories30Days: number
  }
  diversityAnalytics: {
    uniqueDomains: number
    uniqueCategories: number
    uniqueTopics: number
    domainDiversity: number
    categoryDiversity: number
    topicDiversity: number
  }
  contentDistribution: {
    average: number
    median: number
    min: number
    max: number
    total: number
  }
  tokenTrends: {
    byWeek: Record<string, number>
    averagePerMemory: number
    inputOutputRatio: number
  }
}
