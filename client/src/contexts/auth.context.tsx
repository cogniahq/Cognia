import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { axiosInstance } from "@/utils/http"

type AccountType = "PERSONAL" | "ORGANIZATION"

interface User {
  id: string
  email?: string
  account_type?: AccountType
}

interface LoginResult {
  user?: User
  requires2FA?: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  accountType: AccountType | null
  login: (
    email: string,
    password: string,
    totpCode?: string,
    backupCode?: string
  ) => Promise<LoginResult>
  register: (
    email: string,
    password: string,
    accountType: AccountType
  ) => Promise<User>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Storage abstraction with fallback for private browsing
const storage = {
  memoryFallback: new Map<string, string>(),

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return this.memoryFallback.get(key) ?? null
    }
  },

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      this.memoryFallback.set(key, value)
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      this.memoryFallback.delete(key)
    }
  },
}

// Sync token to Chrome extension if available
function syncTokenToExtension(token: string | null): void {
  try {
    const chromeApi =
      typeof window !== "undefined"
        ? (
            window as typeof window & {
              chrome?: {
                runtime?: {
                  id?: string
                  sendMessage?: (
                    extensionId: string,
                    message: { type: string; token?: string | null }
                  ) => Promise<void>
                }
              }
            }
          ).chrome
        : undefined

    if (chromeApi?.runtime?.id && chromeApi.runtime.sendMessage) {
      chromeApi.runtime
        .sendMessage(chromeApi.runtime.id, {
          type: token ? "SYNC_AUTH_TOKEN" : "CLEAR_AUTH_TOKEN",
          token,
        })
        .catch(() => {
          // Extension might not be installed or not ready
        })
    }
  } catch {
    // Not in extension context
  }
}

// Parse JWT to extract expiration
function parseJwt(token: string): { exp?: number; userId?: string } | null {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    return JSON.parse(window.atob(base64))
  } catch {
    return null
  }
}

// Check if token is expired
function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token)
  if (!payload?.exp) return true
  return payload.exp * 1000 <= Date.now()
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setAuthState = useCallback(
    (newToken: string | null, newUser: User | null) => {
      setToken(newToken)
      setUser(newUser)

      if (newToken) {
        storage.setItem("auth_token", newToken)
        syncTokenToExtension(newToken)
      } else {
        storage.removeItem("auth_token")
        syncTokenToExtension(null)
      }
    },
    []
  )

  const clearAuthState = useCallback(() => {
    setToken(null)
    setUser(null)
    storage.removeItem("auth_token")
    syncTokenToExtension(null)
  }, [])

  const checkAuth = useCallback(async () => {
    const storedToken = storage.getItem("auth_token")

    if (!storedToken) {
      setIsLoading(false)
      return
    }

    // Check if token is expired locally first
    if (isTokenExpired(storedToken)) {
      clearAuthState()
      setIsLoading(false)
      return
    }

    try {
      const response = await axiosInstance.get("/auth/me")
      // Handle nested response: { success, data: { id, email, ... } }
      const userData = response.data?.data || response.data
      if (userData?.id) {
        setToken(storedToken)
        setUser(userData)
      } else {
        clearAuthState()
      }
    } catch {
      clearAuthState()
    } finally {
      setIsLoading(false)
    }
  }, [clearAuthState])

  const login = useCallback(
    async (
      email: string,
      password: string,
      totpCode?: string,
      backupCode?: string
    ): Promise<LoginResult> => {
      const response = await axiosInstance.post("/auth/login", {
        email: email.trim(),
        password: password.trim(),
        ...(totpCode && { totpCode }),
        ...(backupCode && { backupCode }),
      })

      // Handle nested response: { success, data: { token, user } } or { success, data: { requires2FA } }
      const responseData = response.data?.data || response.data

      // Check if 2FA is required
      if (responseData?.requires2FA) {
        return { requires2FA: true }
      }

      const token = responseData?.token
      const user = responseData?.user

      if (token && user) {
        setAuthState(token, user)
        return { user }
      } else {
        throw new Error("Invalid response from server")
      }
    },
    [setAuthState]
  )

  const register = useCallback(
    async (
      email: string,
      password: string,
      accountType: AccountType
    ): Promise<User> => {
      const response = await axiosInstance.post("/auth/register", {
        email: email.trim(),
        password: password.trim(),
        account_type: accountType,
      })

      // Handle both direct and nested response structures
      const responseData = response.data?.data || response.data
      const token = responseData?.token
      const user = responseData?.user

      if (token && user) {
        setAuthState(token, user)
        return user
      } else {
        throw new Error("Invalid response from server")
      }
    },
    [setAuthState]
  )

  const logout = useCallback(async () => {
    try {
      await axiosInstance.post("/auth/logout")
    } catch {
      // Ignore logout errors, still clear local state
    } finally {
      clearAuthState()
    }
  }, [clearAuthState])

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Set up token expiration check
  useEffect(() => {
    if (!token) return

    const payload = parseJwt(token)
    if (!payload?.exp) return

    const expiresIn = payload.exp * 1000 - Date.now()
    if (expiresIn <= 0) {
      clearAuthState()
      return
    }

    // Set timeout to clear auth when token expires
    const timeoutId = setTimeout(() => {
      clearAuthState()
    }, expiresIn)

    return () => clearTimeout(timeoutId)
  }, [token, clearAuthState])

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!user && !!token,
      isLoading,
      accountType: user?.account_type || null,
      login,
      register,
      logout,
      checkAuth,
    }),
    [user, token, isLoading, login, register, logout, checkAuth]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Higher-order component for protecting routes
// eslint-disable-next-line react-refresh/only-export-components
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function WithAuthWrapper(props: P) {
    const { isAuthenticated, isLoading } = useAuth()

    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
        </div>
      )
    }

    if (!isAuthenticated) {
      // Redirect handled by axios interceptor
      return null
    }

    return <WrappedComponent {...props} />
  }
}
