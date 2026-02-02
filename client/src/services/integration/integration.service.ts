import { getRequest, postRequest, putRequest, deleteRequest } from "../../utils/http/general-services.util"
import { requireAuthToken } from "../../utils/auth"
import type { IntegrationInfo, ConnectedIntegration, ConnectResponse } from "../../types/integration"

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
export async function getConnectedIntegrations(): Promise<ConnectedIntegration[]> {
  requireAuthToken()
  try {
    const response = await getRequest("/integrations/connected")
    if (response.data?.success === false) {
      throw new Error(response.data?.error || "Failed to fetch connected integrations")
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
export async function connectIntegration(provider: string): Promise<ConnectResponse> {
  requireAuthToken()
  try {
    const redirectUri = `${window.location.origin}/integrations/callback/${provider}`
    const response = await postRequest(`/integrations/${provider}/connect`, { redirectUri })
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
      throw new Error(response.data?.error || "Failed to disconnect integration")
    }
  } catch (error) {
    console.error("Error disconnecting integration:", error)
    throw error
  }
}

/**
 * Trigger manual sync for an integration
 */
export async function syncIntegration(provider: string, mode: "full" | "incremental" = "incremental"): Promise<void> {
  requireAuthToken()
  try {
    const response = await postRequest(`/integrations/${provider}/sync`, { mode })
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
    const response = await putRequest(`/integrations/${provider}/config`, settings)
    if (response.data?.success === false) {
      throw new Error(response.data?.error || "Failed to update settings")
    }
    return response.data?.data
  } catch (error) {
    console.error("Error updating integration settings:", error)
    throw error
  }
}
