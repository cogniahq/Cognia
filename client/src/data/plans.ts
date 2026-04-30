// Tier metadata mirror of `api/src/services/billing/plans.config.ts`.
// Kept in sync manually for now — when a tier changes server-side, update
// this file as well. Limits use -1 to mean "unlimited" (matches API).
//
// Note: prices shown here are display-only. Actual billing is driven by the
// Razorpay plan_ids configured on the server (RAZORPAY_PLAN_PRO /
// RAZORPAY_PLAN_ENTERPRISE) and surfaced to the client via
// VITE_RAZORPAY_PLAN_PRO.

export type PlanId = "free" | "pro" | "enterprise"

export interface PlanTier {
  id: PlanId
  displayName: string
  priceMonthlyCents: number | null
  priceMonthlyDisplay: string
  maxSeats: number
  maxMemories: number
  maxIntegrations: number
  features: string[]
  cta: string
  highlighted?: boolean
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "free",
    displayName: "Free",
    priceMonthlyCents: 0,
    priceMonthlyDisplay: "$0",
    maxSeats: 1,
    maxMemories: 100,
    maxIntegrations: 1,
    features: [
      "1 seat",
      "100 memories",
      "1 integration",
      "Daily sync",
      "Basic search",
      "Browser extension",
      "Community support",
    ],
    cta: "Start free",
  },
  {
    id: "pro",
    displayName: "Pro",
    priceMonthlyCents: 2000,
    priceMonthlyDisplay: "$20/user/mo",
    maxSeats: 10,
    maxMemories: 10000,
    maxIntegrations: 5,
    features: [
      "Up to 10 seats",
      "10,000 memories",
      "5 integrations",
      "Hourly sync",
      "Workspaces",
      "Tags",
      "Priority email support",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    id: "enterprise",
    displayName: "Enterprise",
    priceMonthlyCents: null,
    priceMonthlyDisplay: "Talk to sales",
    maxSeats: -1,
    maxMemories: -1,
    maxIntegrations: -1,
    features: [
      "Unlimited seats",
      "Unlimited memories",
      "Unlimited integrations",
      "Real-time sync",
      "SSO / SCIM",
      "Audit logs",
      "SOC 2",
      "BYOK",
      "Dedicated support",
    ],
    cta: "Contact sales",
  },
]

export function formatLimit(value: number): string {
  return value === -1 ? "Unlimited" : value.toLocaleString()
}

export function getPlanTier(id: string | null | undefined): PlanTier | null {
  if (!id) return null
  return PLAN_TIERS.find((t) => t.id === id) ?? null
}
