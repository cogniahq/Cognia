import type { Metadata } from "next";

import { AnalyticsClient } from "@/components/analytics/AnalyticsClient";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

/**
 * Analytics dashboard. The data shape is large (token usage, growth,
 * activity, diversity, content distribution, etc.) but stable, so the
 * fetch happens client-side via AnalyticsClient. The (app) layout already
 * gates session, so we don't need to fetch session here.
 */
export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
