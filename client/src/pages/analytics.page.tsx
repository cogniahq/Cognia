import React, { useEffect, useState } from "react"
import {
  AnalyticsService,
  type AnalyticsData,
} from "@/services/analytics.service"
import { requireAuthToken } from "@/utils/auth"
import { useNavigate } from "react-router-dom"

import { PageHeader } from "@/components/shared/PageHeader"

export const Analytics: React.FC = () => {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      requireAuthToken()
      setIsAuthenticated(true)
    } catch (error) {
      navigate("/login")
    }
  }, [navigate])

  useEffect(() => {
    if (!isAuthenticated) return

    const fetchAnalytics = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const analyticsData = await AnalyticsService.getAnalytics()
        setAnalytics(analyticsData)
      } catch (err) {
        const error = err as { message?: string }
        console.error("Error fetching analytics:", err)
        setError(error.message || "Failed to load analytics")
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return null
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-sm font-mono text-gray-600">
          Loading analytics...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-sm font-mono text-red-600">Error: {error}</div>
      </div>
    )
  }

  if (!analytics) {
    return null
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toLocaleString()
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const sortedDates = Object.keys(analytics.tokenUsage.byDate).sort()
  const sortedWeeks = Object.keys(analytics.tokenTrends.byWeek).sort()

  return (
    <div className="min-h-screen bg-background">
      <PageHeader pageName="Analytics" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Analytics</h1>
            <p className="text-xs text-muted-foreground">
              Comprehensive statistics about your memories and usage
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Memories
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatNumber(analytics.overview.totalMemories)}
              </div>
            </div>
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Tokens
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatNumber(analytics.overview.totalTokens)}
              </div>
            </div>
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Searches
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatNumber(analytics.overview.totalSearches)}
              </div>
            </div>
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Memories/Day
              </div>
              <div className="text-2xl font-bold text-foreground">
                {analytics.growthAnalytics.memoriesPerDay.toFixed(1)}
              </div>
            </div>
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Tokens/Day
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatNumber(analytics.growthAnalytics.tokensPerDay)}
              </div>
            </div>
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Days Active
              </div>
              <div className="text-2xl font-bold text-foreground">
                {analytics.growthAnalytics.daysSinceFirst}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Growth Metrics
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last 7 days</span>
                  <span className="font-semibold text-foreground">
                    {analytics.growthAnalytics.recentMemories7Days}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last 30 days</span>
                  <span className="font-semibold text-foreground">
                    {analytics.growthAnalytics.recentMemories30Days}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days since last</span>
                  <span className="font-semibold text-foreground">
                    {analytics.growthAnalytics.daysSinceLast}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Activity Patterns
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Peak hour</span>
                  <span className="font-semibold text-foreground">
                    {analytics.activityAnalytics.peakHour !== null
                      ? `${analytics.activityAnalytics.peakHour}:00`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Peak day</span>
                  <span className="font-semibold text-foreground">
                    {analytics.activityAnalytics.peakDayOfWeek || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unique domains</span>
                  <span className="font-semibold text-foreground">
                    {analytics.diversityAnalytics.uniqueDomains}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Diversity
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Domains</span>
                  <span className="font-semibold text-foreground">
                    {analytics.diversityAnalytics.uniqueDomains}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Categories</span>
                  <span className="font-semibold text-foreground">
                    {analytics.diversityAnalytics.uniqueCategories}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Topics</span>
                  <span className="font-semibold text-foreground">
                    {analytics.diversityAnalytics.uniqueTopics}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Content Length
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average</span>
                  <span className="font-semibold text-foreground">
                    {formatNumber(analytics.contentDistribution.average)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Median</span>
                  <span className="font-semibold text-foreground">
                    {formatNumber(analytics.contentDistribution.median)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min / Max</span>
                  <span className="font-semibold text-foreground">
                    {formatNumber(analytics.contentDistribution.min)} /{" "}
                    {formatNumber(analytics.contentDistribution.max)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Token Usage
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Input tokens</span>
                  <span className="font-semibold text-foreground">
                    {formatNumber(analytics.overview.totalInputTokens)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Output tokens</span>
                  <span className="font-semibold text-foreground">
                    {formatNumber(analytics.overview.totalOutputTokens)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">I/O ratio</span>
                  <span className="font-semibold text-foreground">
                    {analytics.tokenTrends.inputOutputRatio.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg per memory</span>
                  <span className="font-semibold text-foreground">
                    {formatNumber(analytics.tokenTrends.averagePerMemory)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Relationships
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total relations</span>
                  <span className="font-semibold text-foreground">
                    {formatNumber(
                      analytics.relationshipAnalytics.totalRelations
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg per memory</span>
                  <span className="font-semibold text-foreground">
                    {analytics.relationshipAnalytics.averageConnectionsPerMemory.toFixed(
                      2
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Snapshots</span>
                  <span className="font-semibold text-foreground">
                    {formatNumber(analytics.snapshotAnalytics.totalSnapshots)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Token Usage by Operation
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(analytics.tokenUsage.byOperation).length > 0 ? (
                  Object.entries(analytics.tokenUsage.byOperation).map(
                    ([op, stats]) => (
                      <div
                        key={op}
                        className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-foreground capitalize">
                            {op.replace(/_/g, " ")}
                          </div>
                          <div className="text-muted-foreground">{stats.count} ops</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-foreground">
                            {formatNumber(stats.total)}
                          </div>
                          <div className="text-muted-foreground">tokens</div>
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No token usage data
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Top Domains
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {analytics.domainAnalytics.topDomains.length > 0 ? (
                  analytics.domainAnalytics.topDomains
                    .slice(0, 10)
                    .map(({ domain, count }) => (
                      <div
                        key={domain}
                        className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0"
                      >
                        <div className="font-medium text-foreground truncate flex-1">
                          {domain}
                        </div>
                        <div className="font-semibold text-muted-foreground ml-4">
                          {count}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No domain data
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Token Usage Over Time
              </h2>
              {sortedDates.length > 0 ? (
                <div className="space-y-1 max-h-64 overflow-y-auto text-xs">
                  {sortedDates.slice(-30).map((date) => {
                    const usage = analytics.tokenUsage.byDate[date]
                    return (
                      <div
                        key={date}
                        className="flex items-center justify-between py-1 border-b border-border last:border-0"
                      >
                        <span className="text-muted-foreground">
                          {formatDate(date)}
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatNumber(usage.total)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No token usage data
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Token Usage by Week
              </h2>
              {sortedWeeks.length > 0 ? (
                <div className="space-y-1 max-h-64 overflow-y-auto text-xs">
                  {sortedWeeks.slice(-12).map((week) => (
                    <div
                      key={week}
                      className="flex items-center justify-between py-1 border-b border-border last:border-0"
                    >
                      <span className="text-muted-foreground">{formatDate(week)}</span>
                      <span className="font-semibold text-foreground">
                        {formatNumber(analytics.tokenTrends.byWeek[week])}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No weekly token data
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Top Categories
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {analytics.categoryTopicAnalytics.topCategories.length > 0 ? (
                  analytics.categoryTopicAnalytics.topCategories
                    .slice(0, 10)
                    .map(({ category, count }) => (
                      <div
                        key={category}
                        className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0"
                      >
                        <div className="font-medium text-foreground capitalize">
                          {category}
                        </div>
                        <div className="font-semibold text-muted-foreground">
                          {count}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No category data
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Top Topics
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {analytics.categoryTopicAnalytics.topTopics.length > 0 ? (
                  analytics.categoryTopicAnalytics.topTopics
                    .slice(0, 10)
                    .map(({ topic, count }) => (
                      <div
                        key={topic}
                        className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0"
                      >
                        <div className="font-medium text-foreground capitalize">
                          {topic}
                        </div>
                        <div className="font-semibold text-muted-foreground">
                          {count}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No topic data
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Memories by Source
              </h2>
              <div className="space-y-2">
                {Object.entries(analytics.memoryStatistics.bySource).length >
                  0 ? (
                  Object.entries(analytics.memoryStatistics.bySource).map(
                    ([source, count]) => (
                      <div
                        key={source}
                        className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0"
                      >
                        <div className="font-medium text-foreground capitalize">
                          {source}
                        </div>
                        <div className="font-semibold text-muted-foreground">
                          {count}
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No source data
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Sentiment Distribution
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(
                  analytics.categoryTopicAnalytics.sentimentDistribution
                ).length > 0 ? (
                  Object.entries(
                    analytics.categoryTopicAnalytics.sentimentDistribution
                  ).map(([sentiment, count]) => (
                    <div key={sentiment} className="text-center">
                      <div className="text-xl font-bold text-foreground">
                        {count}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {sentiment}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-xs text-muted-foreground text-center py-4">
                    No sentiment data
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
