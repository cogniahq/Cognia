"use client"

/**
 * Analytics dashboard data fetcher. Reads /api/memory/analytics — same
 * endpoint the Vite client called via client/src/services/analytics/. The
 * envelope follows the same `{ success, data }` convention that the
 * postRequest/getRequest helpers in web/utils/http unwrap.
 */

import { getRequest } from "@/utils/http"
import type { AnalyticsData } from "@/types/analytics"

const EMPTY_ANALYTICS: AnalyticsData = {
  overview: {
    totalMemories: 0,
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalSearches: 0,
    mostActiveDomain: null,
    averageContentLength: 0,
    totalContentProcessed: 0,
  },
  tokenUsage: {
    total: 0,
    totalInput: 0,
    totalOutput: 0,
    count: 0,
    byOperation: {},
    byDate: {},
    averagePerMemory: 0,
  },
  memoryStatistics: {
    total: 0,
    byDomain: {},
    bySource: {},
    byDate: {},
    averageContentLength: 0,
    totalContentProcessed: 0,
  },
  domainAnalytics: {
    topDomains: [],
    totalDomains: 0,
    mostActiveDomain: null,
  },
  contentAnalytics: {
    averageContentLength: 0,
    totalContentProcessed: 0,
    byCategory: {},
    bySentiment: {},
  },
  searchAnalytics: {
    totalSearches: 0,
    averageResultsPerSearch: 0,
    byDate: {},
  },
  activityAnalytics: {
    memoriesByDate: {},
    memoriesByHour: {},
    memoriesByDayOfWeek: {},
    peakHour: null,
    peakDayOfWeek: null,
    totalMemories: 0,
  },
  relationshipAnalytics: {
    totalRelations: 0,
    averageConnectionsPerMemory: 0,
    strongestRelations: [],
  },
  snapshotAnalytics: {
    totalSnapshots: 0,
    averageSnapshotsPerMemory: 0,
  },
  categoryTopicAnalytics: {
    topCategories: [],
    topTopics: [],
    sentimentDistribution: {},
  },
  growthAnalytics: {
    daysSinceFirst: 0,
    daysSinceLast: 0,
    memoriesPerDay: 0,
    tokensPerDay: 0,
    recentMemories7Days: 0,
    recentMemories30Days: 0,
  },
  diversityAnalytics: {
    uniqueDomains: 0,
    uniqueCategories: 0,
    uniqueTopics: 0,
    domainDiversity: 0,
    categoryDiversity: 0,
    topicDiversity: 0,
  },
  contentDistribution: {
    average: 0,
    median: 0,
    min: 0,
    max: 0,
    total: 0,
  },
  tokenTrends: {
    byWeek: {},
    averagePerMemory: 0,
    inputOutputRatio: 0,
  },
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const response = await getRequest("/memory/analytics")
  if (response.data?.success === false) {
    throw new Error(response.data?.error || "Failed to load analytics")
  }
  return response.data?.data || EMPTY_ANALYTICS
}
