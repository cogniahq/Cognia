import React from "react"
import { formatLimit } from "@/data/plans"

interface UsageBurndownCardProps {
  label: string
  current: number
  limit: number
}

export const UsageBurndownCard: React.FC<UsageBurndownCardProps> = ({
  label,
  current,
  limit,
}) => {
  const isUnlimited = limit === -1
  const atLimit = !isUnlimited && current >= limit
  const percent = isUnlimited
    ? 0
    : limit <= 0
      ? 0
      : Math.min(100, Math.round((current / limit) * 100))

  return (
    <div
      className="border border-gray-200 rounded-lg bg-white p-4 sm:p-5"
      data-testid={`usage-card-${label.toLowerCase()}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-mono uppercase tracking-wide text-gray-500">
          {label}
        </div>
        {isUnlimited ? (
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-700 border border-emerald-500 px-2 py-0.5">
            Unlimited
          </span>
        ) : atLimit ? (
          <span
            className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-700 border border-red-500 bg-red-50 px-2 py-0.5"
            data-testid="at-limit-badge"
          >
            At limit
          </span>
        ) : null}
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-light font-editorial text-gray-900">
          {current.toLocaleString()}
        </span>
        <span className="text-sm text-gray-500">/ {formatLimit(limit)}</span>
      </div>

      {!isUnlimited && (
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all ${
              atLimit
                ? "bg-red-500"
                : percent >= 80
                  ? "bg-amber-500"
                  : "bg-gray-900"
            }`}
            style={{ width: `${percent}%` }}
            data-testid="usage-progress"
          />
        </div>
      )}
    </div>
  )
}

export default UsageBurndownCard
