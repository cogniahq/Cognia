import React from 'react'

interface StatusSectionProps {
  isConnected: boolean
  isAuthenticated: boolean
  isCheckingHealth: boolean
  lastCaptureTime: number | null
}

export const StatusSection: React.FC<StatusSectionProps> = ({
  isConnected,
  isAuthenticated,
  isCheckingHealth,
  lastCaptureTime,
}) => {
  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="border border-gray-200 bg-white p-3 space-y-2">
      <div className="text-sm font-medium text-black mb-2">Status</div>

      <div className="flex items-center justify-between py-1">
        <span className="text-xs text-gray-700">API</span>
        <div className="flex items-center gap-2">
          {isCheckingHealth ? (
            <span className="text-xs text-gray-400">Checking...</span>
          ) : (
            <>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-black' : 'bg-gray-400'}`} />
              <span className="text-xs text-gray-600">
                {isConnected ? 'Connected' : 'Not connected'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between py-1">
        <span className="text-xs text-gray-700">Auth</span>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-black' : 'bg-gray-400'}`} />
          <span className="text-xs text-gray-600">
            {isAuthenticated ? 'Authenticated' : 'Not authenticated'}
          </span>
        </div>
      </div>

      {lastCaptureTime && (
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-gray-700">Last Capture</span>
          <span className="text-xs text-gray-600">{formatTimeAgo(lastCaptureTime)}</span>
        </div>
      )}
    </div>
  )
}
