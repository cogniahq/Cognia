import React from "react"
import { PLAN_TIERS, type PlanId } from "@/data/plans"

interface PlanComparisonTableProps {
  currentPlanId?: PlanId | string | null
  onUpgrade?: (planId: PlanId) => void
  pendingPlanId?: PlanId | null
}

export const PlanComparisonTable: React.FC<PlanComparisonTableProps> = ({
  currentPlanId,
  onUpgrade,
  pendingPlanId,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
      {PLAN_TIERS.map((tier) => {
        const isCurrent = currentPlanId === tier.id
        const isPending = pendingPlanId === tier.id
        return (
          <div
            key={tier.id}
            className={`flex flex-col border bg-white p-6 sm:p-8 rounded-xl shadow-sm transition-all duration-300 ${
              isCurrent
                ? "border-emerald-500 ring-1 ring-emerald-500/20"
                : tier.highlighted
                  ? "border-gray-900 ring-1 ring-gray-900/10 hover:shadow-md"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-md"
            }`}
            data-testid={`plan-card-${tier.id}`}
          >
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-medium text-gray-900">
                  {tier.displayName}
                </h2>
                {isCurrent ? (
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-700 border border-emerald-500 px-2 py-0.5">
                    Current plan
                  </span>
                ) : tier.highlighted ? (
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-900 border border-gray-900 px-2 py-0.5">
                    Most popular
                  </span>
                ) : null}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-light font-editorial text-gray-900">
                  {tier.priceMonthlyDisplay}
                </span>
              </div>
            </div>

            <ul className="space-y-2.5 mb-8 flex-1">
              {tier.features.map((feat) => (
                <li
                  key={feat}
                  className="flex items-start gap-2.5 text-sm text-gray-700"
                >
                  <svg
                    className="w-4 h-4 text-gray-900 mt-0.5 flex-shrink-0"
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
                  {feat}
                </li>
              ))}
            </ul>

            {isCurrent ? (
              <button
                disabled
                className="w-full px-4 py-2.5 text-sm font-medium border border-emerald-300 bg-emerald-50 text-emerald-800 cursor-default"
              >
                Current plan
              </button>
            ) : (
              <button
                onClick={() => onUpgrade?.(tier.id)}
                disabled={isPending}
                className={`w-full px-4 py-2.5 text-sm font-medium transition-colors ${
                  tier.highlighted
                    ? "bg-gray-900 text-white hover:bg-black disabled:opacity-50"
                    : "border border-gray-300 text-gray-900 hover:border-black hover:bg-gray-50 disabled:opacity-50"
                }`}
                data-testid={`plan-cta-${tier.id}`}
              >
                {isPending ? "Loading..." : tier.cta}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default PlanComparisonTable
