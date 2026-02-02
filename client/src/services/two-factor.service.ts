import { axiosInstance } from "@/utils/http"

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

export class TwoFactorService {
  /**
   * Get 2FA status for the current user
   */
  static async getStatus(): Promise<TwoFactorStatus> {
    const response = await axiosInstance.get("/auth/2fa/status")
    const data = response.data?.data || response.data
    return data
  }

  /**
   * Begin 2FA setup - generates secret and QR code
   */
  static async setup(): Promise<TwoFactorSetupResponse> {
    const response = await axiosInstance.post("/auth/2fa/setup")
    const data = response.data?.data || response.data
    return data
  }

  /**
   * Verify and enable 2FA with a TOTP code
   */
  static async verify(code: string): Promise<TwoFactorVerifyResponse> {
    const response = await axiosInstance.post("/auth/2fa/verify", { code })
    const data = response.data?.data || response.data
    return data
  }

  /**
   * Disable 2FA for the current user
   */
  static async disable(code: string): Promise<TwoFactorVerifyResponse> {
    const response = await axiosInstance.post("/auth/2fa/disable", { code })
    const data = response.data?.data || response.data
    return data
  }

  /**
   * Regenerate backup codes
   */
  static async regenerateBackupCodes(code: string): Promise<BackupCodesResponse> {
    const response = await axiosInstance.post("/auth/2fa/backup-codes", { code })
    const data = response.data?.data || response.data
    return data
  }
}
