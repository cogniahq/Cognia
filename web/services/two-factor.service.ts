"use client"

/**
 * TOTP enrollment + management. Mirrors client/src/services/two-factor.service.ts.
 * The setup flow returns a secret + QR-code URI — enrolment is finalised
 * only after the user verifies a 6-digit code from their authenticator
 * app, at which point the server flips the user's two_factor_enabled flag.
 */

import { apiClient } from "@/lib/api/client"

export interface TwoFactorStatus {
  enabled: boolean
  hasBackupCodes: boolean
}

export interface TwoFactorSetupResponse {
  secret: string
  qrCodeUri: string
  backupCodes: string[]
}

export interface TwoFactorVerifyResponse {
  success: boolean
  message: string
}

export interface BackupCodesResponse {
  backupCodes: string[]
}

export const TwoFactorService = {
  async getStatus(): Promise<TwoFactorStatus> {
    const response = await apiClient.get("/auth/2fa/status")
    return response.data?.data || response.data
  },

  async setup(): Promise<TwoFactorSetupResponse> {
    const response = await apiClient.post("/auth/2fa/setup")
    return response.data?.data || response.data
  },

  async verify(code: string): Promise<TwoFactorVerifyResponse> {
    const response = await apiClient.post("/auth/2fa/verify", { code })
    return response.data?.data || response.data
  },

  async disable(code: string): Promise<TwoFactorVerifyResponse> {
    const response = await apiClient.post("/auth/2fa/disable", { code })
    return response.data?.data || response.data
  },

  async regenerateBackupCodes(code: string): Promise<BackupCodesResponse> {
    const response = await apiClient.post("/auth/2fa/backup-codes", { code })
    return response.data?.data || response.data
  },
}
