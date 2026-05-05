"use client"

/**
 * Per-workspace onboarding progress strip. Streamlined port of
 * client/src/components/organization/setup/SetupChecklist.tsx — the
 * original opens an in-page drawer with profile/billing/security/team/
 * integrations forms. The Phase 3.5 port shows the progress and routes
 * admins to /org-admin to actually finish the steps; the deep forms
 * (BillingPlanForm, IntegrationsGrid, etc.) stay un-ported until a
 * follow-up agent picks them up.
 */

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

import {
  getSetupProgress,
  type SetupProgress,
} from "@/services/organization.service"
import type { Organization } from "@/types/organization"

const SETUP_STEPS = [
  { id: "create", title: "Create workspace" },
  { id: "profile", title: "Organization Profile" },
  { id: "billing", title: "Billing & Plan" },
  { id: "security", title: "Security & Compliance" },
  { id: "team", title: "Invite Your Team" },
  { id: "integrations", title: "Connect Integrations" },
]

interface SetupChecklistProps {
  organization: Organization
}

export function SetupChecklist({ organization }: SetupChecklistProps) {
  const [progress, setProgress] = useState<SetupProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)

  const loadProgress = useCallback(async () => {
    try {
      const data = await getSetupProgress(organization.slug)
      setProgress(data)
      if (data.percentComplete >= 80) setIsMinimized(true)
      else if (data.startedAt) {
        const startDate = new Date(data.startedAt)
        const daysSinceStart =
          (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceStart > 14) setIsMinimized(true)
      }
    } catch (err) {
      console.error("Failed to load setup progress:", err)
    } finally {
      setIsLoading(false)
    }
  }, [organization.slug])

  useEffect(() => {
    loadProgress()
  }, [loadProgress])

  if (isLoading || !progress || progress.percentComplete >= 100) return null

  if (isMinimized) {
    return (
      <div className="border border-gray-200 rounded-xl bg-white px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-mono uppercase tracking-wide text-gray-500">
            Workspace setup
          </div>
          <div className="text-sm text-gray-700 mt-0.5">
            {progress.percentComplete}% complete ·{" "}
            {progress.completedSteps.length}/{progress.totalSteps} steps
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="text-xs font-mono text-gray-600 underline-offset-2 hover:underline"
        >
          Expand
        </button>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wide text-gray-500">
            Workspace setup
          </div>
          <h2 className="text-base font-medium text-gray-900 mt-1">
            {progress.percentComplete}% complete
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/org-admin"
            className="text-xs font-mono px-3 py-1.5 border border-gray-300 hover:border-gray-900 transition-colors"
          >
            Continue setup →
          </Link>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="text-xs font-mono text-gray-500 hover:text-gray-900"
          >
            Hide
          </button>
        </div>
      </div>

      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gray-900 transition-all duration-500"
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
        {SETUP_STEPS.map((step) => {
          const isComplete = progress.completedSteps.includes(step.id)
          return (
            <li
              key={step.id}
              className={`flex items-center gap-2 px-3 py-2 border ${
                isComplete
                  ? "border-gray-900 bg-gray-50 text-gray-900"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  isComplete ? "bg-gray-900" : "bg-gray-300"
                }`}
              />
              <span className="font-mono">{step.title}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
