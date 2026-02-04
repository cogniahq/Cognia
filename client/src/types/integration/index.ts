export interface IntegrationInfo {
  id: string
  name: string
  description: string
  icon: string
  category:
    | "storage"
    | "productivity"
    | "communication"
    | "development"
    | "crm"
    | "other"
  authType: "oauth2" | "api_key" | "basic"
  capabilities: {
    pullContent: boolean
    webhooks: boolean
    bidirectional: boolean
  }
}

export interface ConnectedIntegration {
  id: string
  provider: string
  status:
    | "ACTIVE"
    | "PAUSED"
    | "ERROR"
    | "RATE_LIMITED"
    | "TOKEN_EXPIRED"
    | "DISCONNECTED"
  storage_strategy: "METADATA_ONLY" | "FULL_CONTENT"
  sync_frequency: "REALTIME" | "FIFTEEN_MIN" | "HOURLY" | "DAILY" | "MANUAL"
  last_sync_at: string | null
  last_error: string | null
  connected_at: string
  config: Record<string, unknown>
}

export interface ConnectResponse {
  authUrl: string
  state: string
}
