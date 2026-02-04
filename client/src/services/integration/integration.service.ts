import type {
  ConnectedIntegration,
  ConnectResponse,
  IntegrationInfo,
} from "../../types/integration"
import { requireAuthToken } from "../../utils/auth"
import {
  deleteRequest,
  getRequest,
  postRequest,
  putRequest,
} from "../../utils/http/general-services.util"

/**
 * Get list of available integrations
 */
export async function getAvailableIntegrations(): Promise<IntegrationInfo[]> {
  requireAuthToken()
  try {
    const response = await getRequest("/integrations")
    if (response.data?.success === false) {
      throw new Error(response.data?.error || "Failed to fetch integrations")
    }
    return response.data?.data || []
  } catch (error) {
    console.error("Error fetching available integrations:", error)
    throw error
  }
}

/**
 * Get list of user's connected integrations
 */
export async function getConnectedIntegrations(): Promise<
  ConnectedIntegration[]
> {
  requireAuthToken()
  try {
    const response = await getRequest("/integrations/connected")
    if (response.data?.success === false) {
      throw new Error(
        response.data?.error || "Failed to fetch connected integrations"
      )
    }
    return response.data?.data || []
  } catch (error) {
    console.error("Error fetching connected integrations:", error)
    throw error
  }
}

/**
 * Start OAuth connection flow for an integration
 */
export async function connectIntegration(
  provider: string
): Promise<ConnectResponse> {
  requireAuthToken()
  try {
    // Use API base URL for OAuth callback - Google redirects to API, which then redirects to frontend
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
    const redirectUri = `${apiBaseUrl}/api/integrations/${provider}/callback`
    const response = await postRequest(`/integrations/${provider}/connect`, {
      redirectUri,
    })
    if (response.data?.success === false) {
      throw new Error(response.data?.error || "Failed to initiate connection")
    }
    return response.data?.data
  } catch (error) {
    console.error("Error connecting integration:", error)
    throw error
  }
}

/**
 * Disconnect an integration
 */
export async function disconnectIntegration(provider: string): Promise<void> {
  requireAuthToken()
  try {
    const response = await deleteRequest(`/integrations/${provider}`)
    if (response.data?.success === false) {
      throw new Error(
        response.data?.error || "Failed to disconnect integration"
      )
    }
  } catch (error) {
    console.error("Error disconnecting integration:", error)
    throw error
  }
}

/**
 * Trigger manual sync for an integration
 */
export async function syncIntegration(
  provider: string,
  mode: "full" | "incremental" = "incremental"
): Promise<void> {
  requireAuthToken()
  try {
    const response = await postRequest(`/integrations/${provider}/sync`, {
      mode,
    })
    if (response.data?.success === false) {
      throw new Error(response.data?.error || "Failed to trigger sync")
    }
  } catch (error) {
    console.error("Error syncing integration:", error)
    throw error
  }
}

/**
 * Update integration settings
 */
export async function updateIntegrationSettings(
  provider: string,
  settings: {
    syncFrequency?: string
    storageStrategy?: string
    config?: Record<string, unknown>
  }
): Promise<ConnectedIntegration> {
  requireAuthToken()
  try {
    const response = await putRequest(
      `/integrations/${provider}/config`,
      settings
    )
    if (response.data?.success === false) {
      throw new Error(response.data?.error || "Failed to update settings")
    }
    return response.data?.data
  } catch (error) {
    console.error("Error updating integration settings:", error)
    throw error
  }
}

// ============ Organization Integration Settings ============

export interface OrgSyncSettings {
  defaultSyncFrequency: string
  customSyncIntervalMin: number | null
  effectiveIntervalMin: number
}

/**
 * Get organization integration sync settings
 */
export async function getOrgIntegrationSettings(
  orgSlug: string
): Promise<OrgSyncSettings> {
  requireAuthToken()
  try {
    const response = await getRequest(
      `/organizations/${orgSlug}/integrations/settings`
    )
    if (response.data?.success === false) {
      throw new Error(response.data?.error || "Failed to fetch settings")
    }
    return response.data?.data
  } catch (error) {
    console.error("Error fetching org integration settings:", error)
    throw error
  }
}

/**
 * Update organization integration sync settings
 */
export async function updateOrgIntegrationSettings(
  orgSlug: string,
  settings: {
    defaultSyncFrequency?: string
    customSyncIntervalMin?: number | null
  }
): Promise<OrgSyncSettings> {
  requireAuthToken()
  try {
    const response = await putRequest(
      `/organizations/${orgSlug}/integrations/settings`,
      settings
    )
    if (response.data?.success === false) {
      throw new Error(response.data?.error || "Failed to update settings")
    }
    return response.data?.data
  } catch (error) {
    console.error("Error updating org integration settings:", error)
    throw error
  }
}

/**
 * Get organization's connected integrations
 */
export async function getOrgConnectedIntegrations(
  orgSlug: string
): Promise<ConnectedIntegration[]> {
  requireAuthToken()
  try {
    const response = await getRequest(
      `/organizations/${orgSlug}/integrations/connected`
    )
    if (response.data?.success === false) {
      throw new Error(response.data?.error || "Failed to fetch integrations")
    }
    return response.data?.data || []
  } catch (error) {
    console.error("Error fetching org integrations:", error)
    throw error
  }
}

/**
 * Update a specific organization integration's settings
 */
export async function updateOrgIntegration(
  orgSlug: string,
  provider: string,
  settings: {
    syncFrequency?: string
    storageStrategy?: string
    config?: Record<string, unknown>
  }
): Promise<ConnectedIntegration> {
  requireAuthToken()
  try {
    const response = await putRequest(
      `/organizations/${orgSlug}/integrations/${provider}/config`,
      settings
    )
    if (response.data?.success === false) {
      throw new Error(response.data?.error || "Failed to update settings")
    }
    return response.data?.data
  } catch (error) {
    console.error("Error updating org integration:", error)
    throw error
  }
}

/**
 * Trigger manual sync for organization integration
 */
export async function syncOrgIntegration(
  orgSlug: string,
  provider: string,
  mode: "full" | "incremental" = "incremental"
): Promise<void> {
  requireAuthToken()
  try {
    const response = await postRequest(
      `/organizations/${orgSlug}/integrations/${provider}/sync`,
      { mode }
    )
    if (response.data?.success === false) {
      throw new Error(response.data?.error || "Failed to trigger sync")
    }
  } catch (error) {
    console.error("Error syncing org integration:", error)
    throw error
  }
}
