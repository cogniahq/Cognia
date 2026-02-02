import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  subValue?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: ReactNode
}

export function StatCard({
  label,
  value,
  subValue,
  trend,
  trendValue,
  icon,
}: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>

      <div className="text-2xl font-mono text-foreground mb-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      <div className="flex items-center justify-between">
        {subValue && (
          <div className="text-xs text-muted-foreground">{subValue}</div>
        )}
        {trend && trendValue && (
          <div
            className={`flex items-center gap-1 text-xs font-mono ${
              trend === 'up'
                ? 'text-chart-success'
                : trend === 'down'
                ? 'text-destructive'
                : 'text-muted-foreground'
            }`}
          >
            {trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend === 'neutral' && <Minus className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
    </div>
  )
}
