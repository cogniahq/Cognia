import React, { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import { useNavigate, useSearchParams } from "react-router-dom"

import { cn } from "@/lib/utils.lib"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ConsoleButton } from "@/components/landing/ConsoleButton"

type AccountType = "PERSONAL" | "ORGANIZATION"

const getDashboardPath = (type: AccountType | null | undefined): string => {
  return type === "ORGANIZATION" ? "/organization" : "/memories"
}

// Password requirement indicator
const PasswordRequirement: React.FC<{
  met: boolean
  label: string
  optional?: boolean
}> = ({ met, label, optional }) => (
  <div className="flex items-center gap-2 text-xs">
    {met ? (
      <svg
        className="w-3.5 h-3.5 text-green-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    ) : (
      <div
        className={cn(
          "w-3.5 h-3.5 rounded-full border",
          optional ? "border-gray-300" : "border-gray-400"
        )}
      />
    )}
    <span
      className={cn(
        met ? "text-green-700" : "text-gray-500",
        optional && !met && "text-gray-400"
      )}
    >
      {label}
      {optional && !met && " (optional)"}
    </span>
  </div>
)

// Password strength calculator
const getPasswordStrength = (
  password: string
): { percent: number; label: string; color: string; textColor: string } => {
  let score = 0

  if (password.length >= 8) score += 20
  if (password.length >= 12) score += 20
  if (/[A-Z]/.test(password)) score += 15
  if (/[a-z]/.test(password)) score += 15
  if (/[0-9]/.test(password)) score += 15
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 15

  if (score < 35)
    return {
      percent: score,
      label: "Weak",
      color: "bg-red-500",
      textColor: "text-red-600",
    }
  if (score < 55)
    return {
      percent: score,
      label: "Fair",
      color: "bg-orange-500",
      textColor: "text-orange-600",
    }
  if (score < 80)
    return {
      percent: score,
      label: "Good",
      color: "bg-yellow-500",
      textColor: "text-yellow-600",
    }
  return {
    percent: score,
    label: "Strong",
    color: "bg-green-500",
    textColor: "text-green-600",
  }
}

export const Login = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    login,
    register,
    logout,
    accountType,
  } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isRegister, setIsRegister] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedAccountType, setSelectedAccountType] =
    useState<AccountType>("PERSONAL")
  const [showAccountTypeSelection, setShowAccountTypeSelection] =
    useState(false)
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState("")

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false)
  const [totpCode, setTotpCode] = useState("")
  const [useBackupCode, setUseBackupCode] = useState(false)

  // Check for session expired parameter
  useEffect(() => {
    if (searchParams.get("expired") === "true") {
      setSessionExpiredMessage(
        "Your session has expired. Please sign in again."
      )
      // Clean up the URL
      const newUrl = window.location.pathname
      window.history.replaceState({}, "", newUrl)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password")
      return
    }

    if (isRegister && password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    // If 2FA is required, validate the code
    if (requires2FA && !totpCode.trim()) {
      setError("Please enter your authentication code")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      let resultUser
      if (isRegister) {
        resultUser = await register(
          email.trim(),
          password.trim(),
          selectedAccountType
        )
        const dashboardPath = getDashboardPath(resultUser.account_type)
        setTimeout(() => navigate(dashboardPath), 500)
      } else {
        // Handle login with optional 2FA
        const result = await login(
          email.trim(),
          password.trim(),
          !useBackupCode ? totpCode.trim() || undefined : undefined,
          useBackupCode ? totpCode.trim() || undefined : undefined
        )

        if (result.requires2FA) {
          // Show 2FA input
          setRequires2FA(true)
          setIsLoading(false)
          return
        }

        if (result.user) {
          const dashboardPath = getDashboardPath(result.user.account_type)
          setTimeout(() => navigate(dashboardPath), 500)
        }
      }
    } catch (err) {
      const error = err as {
        response?: { data?: { message?: string } }
        message?: string
      }
      console.error("Auth error:", err)
      setError(
        error.response?.data?.message ||
          error.message ||
          `Failed to ${isRegister ? "register" : "login"}. Please try again.`
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      setEmail("")
      setPassword("")
      setError("")
    } catch (err) {
      console.error("Logout error:", err)
    }
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // If user is already logged in
  if (isAuthenticated && user) {
    return (
      <div
        className="min-h-screen text-black relative font-primary"
        style={{
          backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
          color: "#000000",
        }}
      >
        <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full">
            <div className="bg-white/80 backdrop-blur border border-gray-200 p-8 shadow-sm">
              <div className="text-center space-y-6">
                <div className="mx-auto w-14 h-14 flex items-center justify-center">
                  <img
                    src="/black-transparent.png"
                    alt="Cognia"
                    className="w-14 h-14"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                    Welcome back!
                  </h1>
                  <p className="text-sm text-gray-600">
                    You're signed in as{" "}
                    <span className="font-medium text-gray-900">
                      {user.email}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {accountType === "ORGANIZATION"
                      ? "Team Workspace"
                      : "Personal Account"}
                  </p>
                </div>
                <div className="space-y-3 pt-4">
                  <ConsoleButton
                    variant="console_key"
                    className="w-full group relative overflow-hidden rounded-none px-4 py-2 transition-all duration-200 hover:shadow-md"
                    onClick={() => navigate(getDashboardPath(accountType))}
                  >
                    <span className="relative z-10 text-sm font-medium">
                      Continue to Dashboard
                    </span>
                    <div className="absolute inset-0 bg-black transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                  </ConsoleButton>
                  <button
                    onClick={handleLogout}
                    className="w-full border border-gray-200 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors rounded-none"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen text-black relative font-primary overflow-hidden"
      style={{
        backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
        color: "#000000",
      }}
    >
      {/* Animated background grid */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
            linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Gradient blur overlays */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {[
          {
            className: "absolute -top-28 -left-24 w-[28rem] h-[28rem]",
            from: "#a5b4fc",
            via: "#fbcfe8",
            to: "#fde68a",
            opacity: 0.35,
          },
          {
            className: "absolute -bottom-28 right-0 w-[28rem] h-[28rem]",
            from: "#99f6e4",
            via: "#6ee7b7",
            to: "#a7f3d0",
            opacity: 0.3,
          },
        ].map((b, i) => (
          <div
            key={i}
            className={`${b.className} rounded-full blur-3xl`}
            style={{
              backgroundImage: `linear-gradient(135deg, ${b.from}, ${b.via}, ${b.to})`,
              opacity: b.opacity as number,
              filter: "blur(64px)",
            }}
          />
        ))}
      </div>

      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-md w-full">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img
                src="/black-transparent.png"
                alt="Cognia"
                className="w-10 h-10"
              />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-italics font-editorial text-black">
                  Cognia
                </span>
                <span className="text-xs text-gray-600 font-mono -mt-1">
                  Remember what the web showed you
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur border border-gray-200 p-8 shadow-sm">
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-light font-editorial text-gray-900 mb-2">
                  {isRegister && showAccountTypeSelection
                    ? "Choose your account type"
                    : isRegister
                      ? "Create your account"
                      : "Sign in to your account"}
                </h2>
                <p className="text-sm text-gray-600">
                  {isRegister && showAccountTypeSelection
                    ? "This cannot be changed later"
                    : isRegister
                      ? "Get started with Cognia today"
                      : "Enter your credentials to continue"}
                </p>
              </div>

              {/* Account Type Selection (Registration Step 1) */}
              {isRegister && showAccountTypeSelection ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountType("PERSONAL")
                      setShowAccountTypeSelection(false)
                    }}
                    className={cn(
                      "w-full p-4 border text-left transition-all duration-200",
                      "border-gray-200 hover:border-gray-900 hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 flex items-center justify-center bg-gray-100 border border-gray-200">
                        <svg
                          className="w-5 h-5 text-gray-700"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900 mb-1">
                          Personal Account
                        </div>
                        <div className="text-xs text-gray-600">
                          Save and search your browsing history with the browser
                          extension. Your personal knowledge base.
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountType("ORGANIZATION")
                      setShowAccountTypeSelection(false)
                    }}
                    className={cn(
                      "w-full p-4 border text-left transition-all duration-200",
                      "border-gray-200 hover:border-gray-900 hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 flex items-center justify-center bg-gray-100 border border-gray-200">
                        <svg
                          className="w-5 h-5 text-gray-700"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900 mb-1">
                          Team Workspace
                        </div>
                        <div className="text-xs text-gray-600">
                          Upload documents and search them with AI. Collaborate
                          with your team.
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleSubmit}>
                  {/* Account type indicator for registration */}
                  {isRegister && (
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-2">
                        {selectedAccountType === "PERSONAL" ? (
                          <svg
                            className="w-4 h-4 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                        )}
                        <span className="text-xs font-mono text-gray-600">
                          {selectedAccountType === "PERSONAL"
                            ? "Personal Account"
                            : "Team Workspace"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAccountTypeSelection(true)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className={cn(
                        "block w-full px-4 py-3 border rounded-none transition-all duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent",
                        "placeholder:text-gray-400 text-gray-900 text-sm",
                        error
                          ? "border-red-300 focus:ring-red-500"
                          : "border-gray-300"
                      )}
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setError("")
                      }}
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          isRegister ? "new-password" : "current-password"
                        }
                        required
                        className={cn(
                          "block w-full px-4 py-3 pr-11 border rounded-none transition-all duration-200",
                          "focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent",
                          "placeholder:text-gray-400 text-gray-900 text-sm",
                          error
                            ? "border-red-300 focus:ring-red-500"
                            : "border-gray-300"
                        )}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          setError("")
                        }}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.97 9.97 0 015.12 5.12m3.29 3.29L12 12m-3.59-3.59L3 3m9.59 9.59L21 21"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                    {isRegister && password.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="text-xs font-mono text-gray-500 uppercase tracking-wide">
                          Password Requirements
                        </div>
                        <div className="space-y-1">
                          <PasswordRequirement
                            met={password.length >= 8}
                            label="At least 8 characters"
                          />
                          <PasswordRequirement
                            met={/[A-Z]/.test(password)}
                            label="One uppercase letter"
                            optional
                          />
                          <PasswordRequirement
                            met={/[a-z]/.test(password)}
                            label="One lowercase letter"
                            optional
                          />
                          <PasswordRequirement
                            met={/[0-9]/.test(password)}
                            label="One number"
                            optional
                          />
                          <PasswordRequirement
                            met={/[!@#$%^&*(),.?":{}|<>]/.test(password)}
                            label="One special character"
                            optional
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <div className="text-xs text-gray-500">Strength:</div>
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all duration-300",
                                getPasswordStrength(password).color
                              )}
                              style={{
                                width: `${getPasswordStrength(password).percent}%`,
                              }}
                            />
                          </div>
                          <div
                            className={cn(
                              "text-xs font-medium",
                              getPasswordStrength(password).textColor
                            )}
                          >
                            {getPasswordStrength(password).label}
                          </div>
                        </div>
                      </div>
                    )}
                    {isRegister && password.length === 0 && (
                      <p className="mt-2 text-xs text-gray-500">
                        Must be at least 8 characters
                      </p>
                    )}
                  </div>

                  {/* 2FA Code Input */}
                  {requires2FA && !isRegister && (
                    <div className="space-y-3">
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-none">
                        <div className="flex">
                          <svg
                            className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-800">
                              Two-factor authentication required
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                              Enter the code from your authenticator app
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="totpCode"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          {useBackupCode
                            ? "Backup code"
                            : "Authentication code"}
                        </label>
                        <input
                          id="totpCode"
                          name="totpCode"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          required
                          className={cn(
                            "block w-full px-4 py-3 border rounded-none transition-all duration-200",
                            "focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent",
                            "placeholder:text-gray-400 text-gray-900 text-sm font-mono tracking-widest text-center",
                            error
                              ? "border-red-300 focus:ring-red-500"
                              : "border-gray-300"
                          )}
                          placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
                          value={totpCode}
                          onChange={(e) => {
                            setTotpCode(e.target.value)
                            setError("")
                          }}
                          disabled={isLoading}
                          maxLength={useBackupCode ? 9 : 6}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setUseBackupCode(!useBackupCode)
                            setTotpCode("")
                            setError("")
                          }}
                          className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                        >
                          {useBackupCode
                            ? "Use authenticator app"
                            : "Use backup code instead"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRequires2FA(false)
                            setTotpCode("")
                            setUseBackupCode(false)
                            setError("")
                          }}
                          className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                        >
                          ← Back to login
                        </button>
                      </div>
                    </div>
                  )}

                  {sessionExpiredMessage && !error && (
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-none">
                      <div className="flex">
                        <svg
                          className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-800">
                            {sessionExpiredMessage}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-none">
                      <div className="flex">
                        <svg
                          className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800">
                            {error}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full group relative overflow-hidden rounded-none px-4 py-2 transition-all duration-200 hover:shadow-md bg-gray-100 border border-gray-300 text-black hover:bg-black hover:text-white hover:border-black disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <LoadingSpinner size="sm" className="mr-2" />
                          {isRegister ? "Creating account..." : "Signing in..."}
                        </span>
                      ) : (
                        <span className="relative z-10 text-sm font-medium">
                          {isRegister ? "Create account" : "Sign in"}
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                    </button>
                  </div>
                </form>
              )}

              <div className="relative pt-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/80 text-gray-500">
                    {isRegister
                      ? "Already have an account?"
                      : "Don't have an account?"}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    const newIsRegister = !isRegister
                    setIsRegister(newIsRegister)
                    setError("")
                    setEmail("")
                    setPassword("")
                    // Show account type selection when switching to register
                    setShowAccountTypeSelection(newIsRegister)
                  }}
                  disabled={isLoading}
                  className="text-sm font-medium text-black hover:text-gray-700 transition-colors duration-200"
                >
                  {isRegister ? "Sign in instead" : "Create an account"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors duration-200 inline-flex items-center"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
