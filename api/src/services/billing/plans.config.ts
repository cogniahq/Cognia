export interface PlanLimits {
  id: 'free' | 'pro' | 'enterprise'
  displayName: string
  maxSeats: number // -1 = unlimited
  maxMemories: number
  maxIntegrations: number
  syncFrequencyMin: number // smallest sync interval allowed in min
  features: string[]
}

export const PLANS: Record<string, PlanLimits> = {
  free: {
    id: 'free',
    displayName: 'Free',
    maxSeats: 1,
    maxMemories: 100,
    maxIntegrations: 1,
    syncFrequencyMin: 1440, // daily
    features: ['Basic search', 'Community support'],
  },
  pro: {
    id: 'pro',
    displayName: 'Pro',
    maxSeats: 10,
    maxMemories: 10000,
    maxIntegrations: 5,
    syncFrequencyMin: 60, // hourly
    features: ['All Free', 'Priority email support', 'Workspaces'],
  },
  enterprise: {
    id: 'enterprise',
    displayName: 'Enterprise',
    maxSeats: -1,
    maxMemories: -1,
    maxIntegrations: -1,
    syncFrequencyMin: 1, // realtime
    features: ['All Pro', 'SSO/SCIM', 'Audit logs', 'SOC 2', 'Dedicated support', 'BYOK'],
  },
}

export function getPlan(id: string): PlanLimits {
  return PLANS[id] ?? PLANS.free
}

export function isUnlimited(value: number): boolean {
  return value === -1
}
