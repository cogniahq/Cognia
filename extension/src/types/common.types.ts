export type MessageResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export type ExtensionSettings = {
  extensionEnabled: boolean
  memoryInjectionEnabled: boolean
  blockedWebsites: string[]
}
