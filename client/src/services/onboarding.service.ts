// Onboarding service — wrappers for the Phase 3A onboarding endpoints.
// Endpoints:
//   POST /api/onboarding/dismiss-demo   — purges DEMO memories
//   POST /api/onboarding/tour-completed — marks the guided tour completed
//   GET  /api/onboarding/state          — returns onboarding-state snapshot

import { axiosInstance } from "@/utils/http"

export interface OnboardingState {
  tourCompleted: boolean
  demoDismissed: boolean
  emailVerified: boolean
  demoMemoryCount: number
}

function unwrap<T>(response: { data?: { data?: T } | T }): T {
  const root = response?.data
  if (
    root &&
    typeof root === "object" &&
    "data" in (root as Record<string, unknown>)
  ) {
    return (root as { data: T }).data
  }
  return root as T
}

export const onboardingService = {
  async getState(): Promise<OnboardingState> {
    const response = await axiosInstance.get("/onboarding/state")
    return unwrap<OnboardingState>(response)
  },

  async dismissDemo(): Promise<{ success: boolean }> {
    const response = await axiosInstance.post("/onboarding/dismiss-demo")
    return unwrap<{ success: boolean }>(response) ?? { success: true }
  },

  async tourCompleted(): Promise<{ success: boolean }> {
    const response = await axiosInstance.post("/onboarding/tour-completed")
    return unwrap<{ success: boolean }>(response) ?? { success: true }
  },
}

export default onboardingService
