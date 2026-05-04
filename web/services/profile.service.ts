"use client"

/**
 * Wraps the /api/profile endpoints — get current profile, force a refresh,
 * fetch the LLM-friendly context string. Mirrors
 * client/src/services/profile/profile.service.ts.
 */

import { getRequest, postRequest } from "@/utils/http"
import type { UserProfile } from "@/types/profile"

export type { UserProfile }

export async function getProfile(): Promise<UserProfile | null> {
  const response = await getRequest("/profile")
  if (response.data?.success === false) {
    throw new Error(response.data?.error || "Failed to load profile")
  }
  return response.data?.data?.profile || null
}

export async function refreshProfile(): Promise<UserProfile> {
  // Profile refresh re-runs the LLM analysis pipeline, so we generously
  // bump the timeout to match the original 5 minute ceiling.
  const response = await postRequest(
    "/profile/refresh",
    {},
    undefined,
    undefined,
    300000
  )
  if (response.data?.success === false) {
    throw new Error(response.data?.error || "Failed to refresh profile")
  }
  return response.data?.data?.profile
}
