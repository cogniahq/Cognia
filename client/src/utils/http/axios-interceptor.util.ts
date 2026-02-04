import axios from "axios"

const baseURL = import.meta.env.DEV
  ? "/api"
  : `${import.meta.env.VITE_SERVER_URL || ""}/api`

const axiosInstance = axios.create({
  baseURL: baseURL,
  timeout: 30000, // Increased to 30 seconds for search requests
  withCredentials: true,
})

// Add auth token to requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Security error event for components to listen to
export type SecurityErrorType =
  | "SESSION_EXPIRED"
  | "IP_NOT_ALLOWED"
  | "2FA_REQUIRED"

export interface SecurityErrorEvent {
  type: SecurityErrorType
  message: string
}

// Custom event for security errors
export const SECURITY_ERROR_EVENT = "cognia:security-error"

function dispatchSecurityError(type: SecurityErrorType, message: string) {
  window.dispatchEvent(
    new CustomEvent<SecurityErrorEvent>(SECURITY_ERROR_EVENT, {
      detail: { type, message },
    })
  )
}

axiosInstance.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    const status = error.response?.status
    const errorCode = error.response?.data?.code
    const errorMessage = error.response?.data?.message || "An error occurred"

    // Handle 401 unauthorized - clear token and redirect to login
    if (status === 401) {
      try {
        localStorage.removeItem("auth_token")
        // Only redirect if we're not already on login page
        if (window.location.pathname !== "/login") {
          window.location.href = "/login"
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    // Handle session expired (419 or specific error code)
    if (status === 419 || errorCode === "SESSION_EXPIRED") {
      try {
        localStorage.removeItem("auth_token")
        dispatchSecurityError(
          "SESSION_EXPIRED",
          "Your session has expired. Please log in again."
        )
        if (window.location.pathname !== "/login") {
          window.location.href = "/login?expired=true"
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Handle IP not allowed
    if (errorCode === "IP_NOT_ALLOWED") {
      dispatchSecurityError(
        "IP_NOT_ALLOWED",
        errorMessage ||
          "Your IP address is not allowed to access this organization."
      )
    }

    // Handle 2FA required
    if (errorCode === "2FA_REQUIRED") {
      dispatchSecurityError(
        "2FA_REQUIRED",
        "This organization requires two-factor authentication. Please enable 2FA in your profile settings."
      )
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
