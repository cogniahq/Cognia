import React, { useEffect, useState } from "react"
import {
  TwoFactorService,
  type TwoFactorSetupResponse,
  type TwoFactorStatus,
} from "@/services/two-factor.service"

type SetupStep = "idle" | "setup" | "verify" | "complete" | "disable"

export const TwoFactorSettings: React.FC = () => {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupStep, setSetupStep] = useState<SetupStep>("idle")
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(
    null
  )
  const [verificationCode, setVerificationCode] = useState("")
  const [disableCode, setDisableCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await TwoFactorService.getStatus()
      setStatus(data)
    } catch (err) {
      const error = err as {
        response?: { data?: { message?: string } }
        message?: string
      }
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to load 2FA status"
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartSetup = async () => {
    try {
      setIsProcessing(true)
      setError(null)
      const data = await TwoFactorService.setup()
      setSetupData(data)
      setBackupCodes(data.backupCodes)
      setSetupStep("setup")
    } catch (err) {
      const error = err as {
        response?: { data?: { message?: string } }
        message?: string
      }
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to start 2FA setup"
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError("Please enter a 6-digit code")
      return
    }

    try {
      setIsProcessing(true)
      setError(null)
      await TwoFactorService.verify(verificationCode)
      setSetupStep("complete")
      await fetchStatus()
    } catch (err) {
      const error = err as {
        response?: { data?: { message?: string } }
        message?: string
      }
      setError(
        error.response?.data?.message ||
          error.message ||
          "Invalid verification code"
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDisable = async () => {
    if (disableCode.length !== 6) {
      setError("Please enter a 6-digit code")
      return
    }

    try {
      setIsProcessing(true)
      setError(null)
      await TwoFactorService.disable(disableCode)
      setSetupStep("idle")
      setDisableCode("")
      await fetchStatus()
    } catch (err) {
      const error = err as {
        response?: { data?: { message?: string } }
        message?: string
      }
      setError(error.response?.data?.message || error.message || "Invalid code")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRegenerateBackupCodes = async () => {
    const code = prompt(
      "Enter your current 2FA code to regenerate backup codes:"
    )
    if (!code) return

    try {
      setIsProcessing(true)
      setError(null)
      const data = await TwoFactorService.regenerateBackupCodes(code)
      setBackupCodes(data.backupCodes)
      setShowBackupCodes(true)
    } catch (err) {
      const error = err as {
        response?: { data?: { message?: string } }
        message?: string
      }
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to regenerate backup codes"
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"))
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 p-4">
        <div className="text-sm font-mono text-gray-600 mb-3 uppercase tracking-wide">
          [SECURITY - TWO-FACTOR AUTHENTICATION]
        </div>
        <div className="text-sm text-gray-500">Loading 2FA status...</div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 p-4">
      <div className="text-sm font-mono text-gray-600 mb-3 uppercase tracking-wide">
        [SECURITY - TWO-FACTOR AUTHENTICATION]
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Current Status */}
      {setupStep === "idle" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  status?.enabled ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Two-Factor Authentication
                </div>
                <div className="text-xs text-gray-500">
                  {status?.enabled
                    ? "Enabled - Your account is protected with 2FA"
                    : "Disabled - Add an extra layer of security"}
                </div>
              </div>
            </div>
            {status?.enabled ? (
              <button
                onClick={() => setSetupStep("disable")}
                className="px-3 py-1.5 text-xs font-mono text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 transition-colors"
              >
                Disable
              </button>
            ) : (
              <button
                onClick={handleStartSetup}
                disabled={isProcessing}
                className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50"
              >
                {isProcessing ? "Setting up..." : "Enable 2FA"}
              </button>
            )}
          </div>

          {status?.enabled && (
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Backup Codes
                </div>
                <div className="text-xs text-gray-500">
                  Use these codes if you lose access to your authenticator app
                </div>
              </div>
              <button
                onClick={handleRegenerateBackupCodes}
                disabled={isProcessing}
                className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50"
              >
                {isProcessing ? "Generating..." : "Regenerate"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Setup Step - Show QR Code */}
      {setupStep === "setup" && setupData && (
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            Scan this QR code with your authenticator app (Google Authenticator,
            Authy, etc.)
          </div>

          <div className="flex justify-center p-4 bg-white border border-gray-200">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                setupData.qrCodeUri
              )}`}
              alt="2FA QR Code"
              className="w-48 h-48"
            />
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200">
            <div className="text-xs font-mono text-gray-500 mb-1">
              Manual entry code:
            </div>
            <div className="text-sm font-mono text-gray-900 break-all select-all">
              {setupData.secret}
            </div>
          </div>

          <div className="p-3 bg-yellow-50 border border-yellow-200">
            <div className="text-xs font-mono text-yellow-800 mb-2 uppercase tracking-wide">
              [SAVE YOUR BACKUP CODES]
            </div>
            <div className="text-xs text-yellow-700 mb-2">
              Store these codes in a safe place. You can use them to access your
              account if you lose your authenticator device.
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {backupCodes.map((code, idx) => (
                <div
                  key={idx}
                  className="px-2 py-1 text-xs font-mono bg-white border border-yellow-200 text-center"
                >
                  {code}
                </div>
              ))}
            </div>
            <button
              onClick={copyBackupCodes}
              className="w-full px-3 py-1.5 text-xs font-mono text-yellow-700 hover:bg-yellow-100 border border-yellow-300 transition-colors"
            >
              Copy All Codes
            </button>
          </div>

          <button
            onClick={() => setSetupStep("verify")}
            className="w-full px-3 py-2 text-sm font-mono text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors"
          >
            Continue to Verification
          </button>
        </div>
      )}

      {/* Verify Step */}
      {setupStep === "verify" && (
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            Enter the 6-digit code from your authenticator app to complete
            setup.
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                setVerificationCode(value)
              }}
              placeholder="000000"
              className="flex-1 px-3 py-2 text-center text-lg font-mono tracking-widest border border-gray-300 focus:border-gray-900 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setSetupStep("setup")
                setVerificationCode("")
                setError(null)
              }}
              className="flex-1 px-3 py-2 text-sm font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleVerify}
              disabled={isProcessing || verificationCode.length !== 6}
              className="flex-1 px-3 py-2 text-sm font-mono text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? "Verifying..." : "Verify & Enable"}
            </button>
          </div>
        </div>
      )}

      {/* Complete Step */}
      {setupStep === "complete" && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 text-center">
            <div className="text-lg text-green-700 mb-1">
              2FA Enabled Successfully!
            </div>
            <div className="text-sm text-green-600">
              Your account is now protected with two-factor authentication.
            </div>
          </div>

          <button
            onClick={() => {
              setSetupStep("idle")
              setSetupData(null)
              setVerificationCode("")
              setBackupCodes([])
            }}
            className="w-full px-3 py-2 text-sm font-mono text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* Disable Step */}
      {setupStep === "disable" && (
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200">
            <div className="text-sm font-medium text-red-800 mb-1">
              Disable Two-Factor Authentication
            </div>
            <div className="text-xs text-red-700">
              This will remove the extra security layer from your account. Enter
              your current 2FA code to confirm.
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={disableCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                setDisableCode(value)
              }}
              placeholder="000000"
              className="flex-1 px-3 py-2 text-center text-lg font-mono tracking-widest border border-gray-300 focus:border-gray-900 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setSetupStep("idle")
                setDisableCode("")
                setError(null)
              }}
              className="flex-1 px-3 py-2 text-sm font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDisable}
              disabled={isProcessing || disableCode.length !== 6}
              className="flex-1 px-3 py-2 text-sm font-mono text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? "Disabling..." : "Disable 2FA"}
            </button>
          </div>
        </div>
      )}

      {/* Show Backup Codes Modal */}
      {showBackupCodes && backupCodes.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 p-6 max-w-md w-full">
            <div className="text-sm font-mono text-gray-600 mb-3 uppercase tracking-wide">
              [NEW BACKUP CODES]
            </div>
            <div className="text-sm text-gray-700 mb-4">
              Your previous backup codes have been invalidated. Save these new
              codes in a safe place.
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {backupCodes.map((code, idx) => (
                <div
                  key={idx}
                  className="px-2 py-1 text-xs font-mono bg-gray-50 border border-gray-200 text-center"
                >
                  {code}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyBackupCodes}
                className="flex-1 px-3 py-2 text-sm font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors"
              >
                Copy All
              </button>
              <button
                onClick={() => {
                  setShowBackupCodes(false)
                  setBackupCodes([])
                }}
                className="flex-1 px-3 py-2 text-sm font-mono text-white bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
