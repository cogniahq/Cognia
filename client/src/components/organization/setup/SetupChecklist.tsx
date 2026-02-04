import { useCallback, useEffect, useState } from "react"
import {
  getSetupProgress,
  type SetupProgress,
} from "@/services/organization/organization.service"

import type { Organization } from "@/types/organization"

import { BillingPlanForm } from "./BillingPlanForm"
import { IntegrationsGrid } from "./IntegrationsGrid"
import { OrganizationProfileForm } from "./OrganizationProfileForm"
import { SecurityComplianceForm } from "./SecurityComplianceForm"
import { SetupDrawer } from "./SetupDrawer"
import { SetupProgress as SetupProgressBar } from "./SetupProgress"
import { TeamInviteForm } from "./TeamInviteForm"

interface SetupChecklistProps {
  organization: Organization
  onRefresh: () => void
}

interface SetupStep {
  id: string
  title: string
  description: string
  estimatedMinutes: number
}

const SETUP_STEPS: SetupStep[] = [
  {
    id: "create",
    title: "Create workspace",
    description: "Workspace created successfully",
    estimatedMinutes: 0,
  },
  {
    id: "profile",
    title: "Organization Profile",
    description: "Logo, description, company details",
    estimatedMinutes: 5,
  },
  {
    id: "billing",
    title: "Billing & Plan",
    description: "Set up billing for premium features",
    estimatedMinutes: 3,
  },
  {
    id: "security",
    title: "Security & Compliance",
    description: "Data policies and access controls",
    estimatedMinutes: 4,
  },
  {
    id: "team",
    title: "Invite Your Team",
    description: "Add members and assign roles",
    estimatedMinutes: 2,
  },
  {
    id: "integrations",
    title: "Connect Integrations",
    description: "Link external tools",
    estimatedMinutes: 3,
  },
]

export function SetupChecklist({
  organization,
  onRefresh,
}: SetupChecklistProps) {
  const [progress, setProgress] = useState<SetupProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null)

  const loadProgress = useCallback(async () => {
    try {
      const data = await getSetupProgress(organization.slug)
      setProgress(data)

      if (data.percentComplete >= 80) {
        setIsMinimized(true)
      } else if (data.startedAt) {
        const startDate = new Date(data.startedAt)
        const daysSinceStart =
          (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceStart > 14) {
          setIsMinimized(true)
        }
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

  const handleStepComplete = () => {
    setActiveDrawer(null)
    loadProgress()
    onRefresh()
  }

  const isStepComplete = (stepId: string) => {
    return progress?.completedSteps.includes(stepId) ?? false
  }

  const getDrawerContent = () => {
    const commonProps = {
      organization,
      onComplete: handleStepComplete,
      onCancel: () => setActiveDrawer(null),
    }

    switch (activeDrawer) {
      case "profile":
        return <OrganizationProfileForm {...commonProps} />
      case "billing":
        return <BillingPlanForm {...commonProps} />
      case "security":
        return <SecurityComplianceForm {...commonProps} />
      case "team":
        return <TeamInviteForm {...commonProps} />
      case "integrations":
        return <IntegrationsGrid {...commonProps} />
      default:
        return null
    }
  }

  const getDrawerTitle = () => {
    const step = SETUP_STEPS.find((s) => s.id === activeDrawer)
    return step?.title || ""
  }

  if (isLoading) {
    return (
      <div className="border border-gray-200 p-6">
        <div className="h-4 bg-gray-100 w-1/3 mb-4" />
        <div className="h-1 bg-gray-100 w-full mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-50" />
          ))}
        </div>
      </div>
    )
  }

  if (!progress) return null
  if (progress.percentComplete === 100) return null

  // Minimized view
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="w-full border border-gray-200 p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            [SETUP]
          </div>
          <span className="text-sm text-gray-700">
            {progress.percentComplete}% complete
          </span>
        </div>
        <span className="text-xs font-mono text-gray-500">Continue →</span>
      </button>
    )
  }

  // Full view
  return (
    <>
      <div className="border border-gray-200">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            [COMPLETE YOUR WORKSPACE SETUP]
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-xs font-mono text-gray-400 hover:text-gray-600"
            title="Minimize"
          >
            −
          </button>
        </div>

        {/* Progress */}
        <div className="px-4 py-3 border-b border-gray-100">
          <SetupProgressBar
            completedSteps={progress.completedSteps.length}
            totalSteps={progress.totalSteps}
            percentComplete={progress.percentComplete}
          />
        </div>

        {/* Steps */}
        <div className="divide-y divide-gray-100">
          {SETUP_STEPS.map((step, index) => {
            const isComplete = isStepComplete(step.id)
            const isClickable = step.id !== "create"

            return (
              <button
                key={step.id}
                onClick={() => isClickable && setActiveDrawer(step.id)}
                disabled={!isClickable}
                className={`
                  w-full px-4 py-3 flex items-center gap-4 text-left transition-colors
                  ${isClickable ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"}
                `}
              >
                {/* Number/Check */}
                <div
                  className={`
                    w-6 h-6 flex items-center justify-center text-xs font-mono
                    ${isComplete ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}
                  `}
                >
                  {isComplete ? "✓" : String(index + 1).padStart(2, "0")}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div
                    className={`
                      text-sm
                      ${isComplete ? "text-gray-400 line-through" : "text-gray-900"}
                    `}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {step.description}
                  </div>
                </div>

                {/* Action */}
                {isClickable && (
                  <div className="text-xs font-mono text-gray-400">
                    {isComplete ? "Done" : `${step.estimatedMinutes}m →`}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Drawer */}
      <SetupDrawer
        open={!!activeDrawer}
        onClose={() => setActiveDrawer(null)}
        title={getDrawerTitle()}
      >
        {getDrawerContent()}
      </SetupDrawer>
    </>
  )
}
