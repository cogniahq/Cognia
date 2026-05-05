"use client"

import { env } from "@/lib/env"
import {
  deleteRequest,
  getRequest,
  postRequest,
  putRequest,
} from "@/utils/http"

import type {
  ConnectedIntegration,
  ConnectResponse,
  IntegrationInfo,
} from "@/types/integration"

/**
 * Integration service. Ported from client/src/services/integration/
 * integration.service.ts but routed through the apiClient axios instance
 * (which already handles 401/403 redirects). The /api/auth replay path is
 * dropped — that was the Vite-era requireAuthToken() check; the Next.js
 * middleware + (app)/layout already enforce auth before we get here.
 */

export async function getAvailableIntegrations(): Promise<IntegrationInfo[]> {
  const response = await getRequest("/integrations")
  if (response.data?.success === false) {
    throw new Error(response.data?.error || "Failed to fetch integrations")
  }
  return response.data?.data || []
}

export async function getConnectedIntegrations(): Promise<
  ConnectedIntegration[]
> {
  const response = await getRequest("/integrations/connected")
  if (response.data?.success === false) {
    throw new Error(
      response.data?.error || "Failed to fetch connected integrations"
    )
  }
  return response.data?.data || []
}

export async function connectIntegration(
  provider: string
): Promise<ConnectResponse> {
  // The OAuth callback hits the API host directly; the API then redirects
  // back to the web origin with ?connected=… query params.
  const apiBaseUrl = env.publicApiUrl
  const redirectUri = `${apiBaseUrl}/api/integrations/${provider}/callback`
  const response = await postRequest(`/integrations/${provider}/connect`, {
    redirectUri,
  })
  if (response.data?.success === false) {
    throw new Error(response.data?.error || "Failed to initiate connection")
  }
  return response.data?.data
}

export async function disconnectIntegration(provider: string): Promise<void> {
  const response = await deleteRequest(`/integrations/${provider}`)
  if (response.data?.success === false) {
    throw new Error(response.data?.error || "Failed to disconnect integration")
  }
}

export async function syncIntegration(
  provider: string,
  mode: "full" | "incremental" = "incremental"
): Promise<void> {
  const response = await postRequest(`/integrations/${provider}/sync`, {
    mode,
  })
  if (response.data?.success === false) {
    throw new Error(response.data?.error || "Failed to trigger sync")
  }
}

export async function updateIntegrationSettings(
  provider: string,
  settings: {
    syncFrequency?: string
    storageStrategy?: string
    config?: Record<string, unknown>
  }
): Promise<ConnectedIntegration> {
  const response = await putRequest(
    `/integrations/${provider}/config`,
    settings
  )
  if (response.data?.success === false) {
    throw new Error(response.data?.error || "Failed to update settings")
  }
  return response.data?.data
}
