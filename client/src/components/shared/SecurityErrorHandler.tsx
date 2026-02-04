import React, { useEffect, useState } from "react"
import {
  SECURITY_ERROR_EVENT,
  type SecurityErrorEvent,
  type SecurityErrorType,
} from "@/utils/http"
import { useNavigate } from "react-router-dom"

interface ErrorNotification {
  id: string
  type: SecurityErrorType
  message: string
}

export const SecurityErrorHandler: React.FC = () => {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    const handleSecurityError = (event: CustomEvent<SecurityErrorEvent>) => {
      const { type, message } = event.detail

      // Add notification
      const id = `${Date.now()}-${Math.random()}`
      setNotifications((prev) => [...prev, { id, type, message }])

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }, 10000)
    }

    window.addEventListener(
      SECURITY_ERROR_EVENT,
      handleSecurityError as EventListener
    )

    return () => {
      window.removeEventListener(
        SECURITY_ERROR_EVENT,
        handleSecurityError as EventListener
      )
    }
  }, [])

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const handleAction = (notification: ErrorNotification) => {
    if (notification.type === "2FA_REQUIRED") {
      navigate("/profile")
    }
    dismissNotification(notification.id)
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-4 border shadow-lg ${
            notification.type === "2FA_REQUIRED"
              ? "bg-yellow-50 border-yellow-200"
              : notification.type === "IP_NOT_ALLOWED"
                ? "bg-red-50 border-red-200"
                : "bg-orange-50 border-orange-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className={`flex-shrink-0 w-5 h-5 ${
                notification.type === "2FA_REQUIRED"
                  ? "text-yellow-600"
                  : notification.type === "IP_NOT_ALLOWED"
                    ? "text-red-600"
                    : "text-orange-600"
              }`}
            >
              {notification.type === "2FA_REQUIRED" ? (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              ) : notification.type === "IP_NOT_ALLOWED" ? (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              ) : (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm font-medium ${
                  notification.type === "2FA_REQUIRED"
                    ? "text-yellow-800"
                    : notification.type === "IP_NOT_ALLOWED"
                      ? "text-red-800"
                      : "text-orange-800"
                }`}
              >
                {notification.type === "2FA_REQUIRED"
                  ? "Two-Factor Authentication Required"
                  : notification.type === "IP_NOT_ALLOWED"
                    ? "Access Denied"
                    : "Session Expired"}
              </div>
              <div
                className={`text-sm mt-1 ${
                  notification.type === "2FA_REQUIRED"
                    ? "text-yellow-700"
                    : notification.type === "IP_NOT_ALLOWED"
                      ? "text-red-700"
                      : "text-orange-700"
                }`}
              >
                {notification.message}
              </div>

              {/* Action button for 2FA */}
              {notification.type === "2FA_REQUIRED" && (
                <button
                  onClick={() => handleAction(notification)}
                  className="mt-2 px-3 py-1 text-xs font-mono text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 border border-yellow-300 transition-colors"
                >
                  Go to Settings
                </button>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={() => dismissNotification(notification.id)}
              className={`flex-shrink-0 ${
                notification.type === "2FA_REQUIRED"
                  ? "text-yellow-500 hover:text-yellow-700"
                  : notification.type === "IP_NOT_ALLOWED"
                    ? "text-red-500 hover:text-red-700"
                    : "text-orange-500 hover:text-orange-700"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
