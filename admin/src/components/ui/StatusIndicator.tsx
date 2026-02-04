interface StatusIndicatorProps {
  status: boolean | 'healthy' | 'degraded' | 'down'
  label: string
  detail?: string
}

export function StatusIndicator({
  status,
  label,
  detail,
}: StatusIndicatorProps) {
  const isHealthy = status === true || status === 'healthy'
  const isDegraded = status === 'degraded'

  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 border border-border rounded-lg">
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full ${
            isHealthy
              ? 'bg-chart-success'
              : isDegraded
                ? 'bg-chart-warning'
                : 'bg-destructive'
          }`}
        />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      {detail && (
        <span className="text-xs font-mono text-muted-foreground">
          {detail}
        </span>
      )}
    </div>
  )
}
