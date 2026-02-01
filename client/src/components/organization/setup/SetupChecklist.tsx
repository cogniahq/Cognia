import { useState, useEffect, useCallback } from "react"
import {
  Building2,
  CreditCard,
  Shield,
  Users,
  Puzzle,
  Check,
  ChevronRight,
  Minus,
  ChevronDown,
  Sparkles,
} from "lucide-react"
import type { Organization } from "@/types/organization"
import { getSetupProgress, type SetupProgress } from "@/services/organization/organization.service"
import { SetupProgress as SetupProgressBar } from "./SetupProgress"
import { SetupDrawer } from "./SetupDrawer"
import { OrganizationProfileForm } from "./OrganizationProfileForm"
import { BillingPlanForm } from "./BillingPlanForm"
import { SecurityComplianceForm } from "./SecurityComplianceForm"
import { TeamInviteForm } from "./TeamInviteForm"
import { IntegrationsGrid } from "./IntegrationsGrid"

interface SetupChecklistProps {
  organization: Organization
  onRefresh: () => void
}

interface SetupStep {
  id: string
  title: string
  description: string
  icon: typeof Building2
  estimatedMinutes: number
}

const SETUP_STEPS: SetupStep[] = [
  {
    id: "create",
    title: "Create workspace",
    description: "Workspace created successfully",
    icon: Sparkles,
    estimatedMinutes: 0,
  },
  {
    id: "profile",
    title: "Organization Profile",
    description: "Add logo, description, and company details",
    icon: Building2,
    estimatedMinutes: 5,
  },
  {
    id: "billing",
    title: "Billing & Plan",
    description: "Set up billing to unlock premium features",
    icon: CreditCard,
    estimatedMinutes: 3,
  },
  {
    id: "security",
    title: "Security & Compliance",
    description: "Configure data policies and access controls",
    icon: Shield,
    estimatedMinutes: 4,
  },
  {
    id: "team",
    title: "Invite Your Team",
    description: "Add members and assign roles",
    icon: Users,
    estimatedMinutes: 2,
  },
  {
    id: "integrations",
    title: "Connect Integrations",
    description: "Link external tools and services",
    icon: Puzzle,
    estimatedMinutes: 3,
  },
]

export function SetupChecklist({ organization, onRefresh }: SetupChecklistProps) {
  const [progress, setProgress] = useState<SetupProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null)

  const loadProgress = useCallback(async () => {
    try {
      const data = await getSetupProgress(organization.slug)
      setProgress(data)

      // Auto-minimize if mostly complete or started more than 14 days ago
      if (data.percentComplete >= 80) {
        setIsMinimized(true)
      } else if (data.startedAt) {
        const startDate = new Date(data.startedAt)
        const daysSinceStart = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)
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
      <div className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-2 bg-gray-200 rounded w-full mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!progress) return null

  // Don't show if fully complete
  if (progress.percentComplete === 100) return null

  // Minimized view
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="w-full bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:border-gray-300 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {progress.percentComplete}%
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700">
            Setup {progress.percentComplete}% complete
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          Continue
          <ChevronRight className="h-4 w-4" />
        </div>
      </button>
    )
  }

  // Full view
  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            Complete Your Workspace Setup
          </h2>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 border-b border-gray-100">
          <SetupProgressBar
            completedSteps={progress.completedSteps.length}
            totalSteps={progress.totalSteps}
            percentComplete={progress.percentComplete}
          />
        </div>

        {/* Steps */}
        <div className="divide-y divide-gray-100">
          {SETUP_STEPS.map((step) => {
            const isComplete = isStepComplete(step.id)
            const Icon = step.icon
            const isClickable = step.id !== "create"

            return (
              <button
                key={step.id}
                onClick={() => isClickable && setActiveDrawer(step.id)}
                disabled={!isClickable}
                className={`
                  w-full px-6 py-4 flex items-center gap-4 text-left transition-colors
                  ${isClickable ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"}
                  ${isComplete ? "opacity-60" : ""}
                `}
              >
                {/* Icon */}
                <div
                  className={`
                    w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                    ${isComplete ? "bg-green-100" : "bg-gray-100"}
                  `}
                >
                  {isComplete ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <Icon className="h-5 w-5 text-gray-600" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`
                        font-medium
                        ${isComplete ? "text-gray-500 line-through" : "text-gray-900"}
                      `}
                    >
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {step.description}
                  </p>
                </div>

                {/* Action */}
                {isClickable && (
                  <div className="flex-shrink-0">
                    {isComplete ? (
                      <span className="text-sm text-green-600 font-medium">
                        Completed
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        {step.estimatedMinutes} min
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    )}
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
