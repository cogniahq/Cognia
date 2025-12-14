import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { cn } from "@/lib/utils.lib"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ConsoleButton } from "@/components/landing/ConsoleButton"

import { axiosInstance } from "../utils/http"

interface User {
  id: string
  email: string
  created_at: string
}

export const Login = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isRegister, setIsRegister] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

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

    setIsLoading(true)
    setError("")

    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login"
      const response = await axiosInstance.post(endpoint, {
        email: email.trim(),
        password: password.trim(),
      })

      setUser(response.data.user)
      if (response.data?.token) {
        try {
          localStorage.setItem("auth_token", response.data.token)
        } catch {
          // Ignore localStorage errors
        }
      }

      setTimeout(() => {
        navigate("/memories")
      }, 1000)
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
      await axiosInstance.post("/auth/logout")
      setUser(null)
      try {
        localStorage.removeItem("auth_token")
      } catch {
        // Ignore localStorage errors
      }
      setEmail("")
      setPassword("")
      setError("")
      navigate("/login")
    } catch (err) {
      console.error("Logout error:", err)
      setUser(null)
      try {
        localStorage.removeItem("auth_token")
      } catch {
        // Ignore localStorage errors
      }
      navigate("/login")
    }
  }

  const checkCurrentUser = async () => {
    try {
      const response = await axiosInstance.get("/auth/me")
      if (response.data?.user) {
        setUser(response.data.user)
      }
    } catch (err) {
      setUser(null)
      try {
        localStorage.removeItem("auth_token")
        localStorage.removeItem("user_id")
      } catch {
        // Ignore localStorage errors
      }
    }
  }

  useEffect(() => {
    checkCurrentUser()
  }, [])

  if (user) {
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
                </div>
                <div className="space-y-3 pt-4">
                  <ConsoleButton
                    variant="console_key"
                    className="w-full group relative overflow-hidden rounded-none px-4 py-2 transition-all duration-200 hover:shadow-md"
                    onClick={() => navigate("/memories")}
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

          <div className="bg-card/80 backdrop-blur border border-border p-8 shadow-sm">
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-light font-editorial text-foreground mb-2">
                  {isRegister
                    ? "Create your account"
                    : "Sign in to your account"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isRegister
                    ? "Get started with Cognia today"
                    : "Enter your credentials to continue"}
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-muted-foreground mb-2"
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
                      "block w-full px-4 py-3 border rounded-none transition-all duration-200 bg-background",
                      "focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent",
                      "placeholder:text-muted-foreground text-foreground text-sm",
                      error
                        ? "border-destructive focus:ring-destructive"
                        : "border-border"
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
                    className="block text-sm font-medium text-muted-foreground mb-2"
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
                        "block w-full px-4 py-3 pr-11 border rounded-none transition-all duration-200 bg-background",
                        "focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent",
                        "placeholder:text-muted-foreground text-foreground text-sm",
                        error
                          ? "border-destructive focus:ring-destructive"
                          : "border-border"
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
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
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
                  {isRegister && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Must be at least 8 characters
                    </p>
                  )}
                </div>

                {error && (
                  <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-none">
                    <div className="flex">
                      <svg
                        className="w-5 h-5 text-destructive mt-0.5 mr-3 flex-shrink-0"
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
                        <p className="text-sm font-medium text-destructive">
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
                    className="w-full group relative overflow-hidden rounded-none px-4 py-2 transition-all duration-200 hover:shadow-md bg-secondary border border-border text-foreground hover:bg-foreground hover:text-background hover:border-foreground disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="absolute inset-0 bg-foreground transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                  </button>
                </div>
              </form>

              <div className="relative pt-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-card text-muted-foreground">
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
                    setIsRegister(!isRegister)
                    setError("")
                    setEmail("")
                    setPassword("")
                  }}
                  disabled={isLoading}
                  className="text-sm font-medium text-foreground hover:text-muted-foreground transition-colors duration-200"
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
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 inline-flex items-center"
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
