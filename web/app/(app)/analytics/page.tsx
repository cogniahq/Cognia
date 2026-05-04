import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

/**
 * Analytics — placeholder shell.
 *
 * The Vite version (client/src/pages/analytics.page.tsx, 571 lines) renders
 * a multi-section dashboard backed by /api/memory/analytics: overview tiles,
 * token-usage charts, memory-by-date series, domain breakdown, growth,
 * diversity, content distribution. The shape lives in client/src/types/
 * analytics/index.ts.
 *
 * TODO(phase-3-followup): port the AnalyticsData type, the
 * /api/memory/analytics fetch (server-side via apiFetch is fine — the
 * shape is stable), and the chart sections. Charts are SVG (no chart
 * library), so the port is mechanical.
 */
export default function AnalyticsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Analytics</h1>
          <p className="text-xs text-gray-600">
            Comprehensive statistics about your memories and usage.
          </p>
        </div>
        <div className="border border-gray-200 rounded-xl p-6 text-sm font-mono text-gray-600">
          Analytics charts ship in the Phase 3 follow-up. The shape and
          per-section layout are mechanical to port from
          client/src/pages/analytics.page.tsx.
        </div>
      </div>
    </div>
  );
}
