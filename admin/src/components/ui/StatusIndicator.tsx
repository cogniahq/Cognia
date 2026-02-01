interface StatusIndicatorProps {
  status: boolean | 'healthy' | 'degraded' | 'down'
  label: string
  detail?: string
}

export function StatusIndicator({ status, label, detail }: StatusIndicatorProps) {
  const isHealthy = status === true || status === 'healthy'
  const isDegraded = status === 'degraded'

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200">
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 ${
            isHealthy
              ? 'bg-green-500'
              : isDegraded
              ? 'bg-yellow-500'
              : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-gray-900">{label}</span>
      </div>
      {detail && (
        <span className="text-xs font-mono text-gray-500">{detail}</span>
      )}
    </div>
  )
}
