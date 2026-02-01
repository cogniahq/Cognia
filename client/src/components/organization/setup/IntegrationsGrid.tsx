import { useState } from "react"
import type { Organization } from "@/types/organization"
import { skipSetupStep } from "@/services/organization/organization.service"

interface IntegrationsGridProps {
  organization: Organization
  onComplete: () => void
  onCancel: () => void
}

interface Integration {
  id: string
  name: string
  description: string
  category: "communication" | "storage" | "development"
  comingSoon?: boolean
}

const INTEGRATIONS: Integration[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Notifications in channels",
    category: "communication",
    comingSoon: true,
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Notifications and updates",
    category: "communication",
    comingSoon: true,
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Import documents",
    category: "storage",
    comingSoon: true,
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Import documents",
    category: "storage",
    comingSoon: true,
  },
  {
    id: "notion",
    name: "Notion",
    description: "Import pages",
    category: "development",
    comingSoon: true,
  },
  {
    id: "github",
    name: "GitHub",
    description: "Link repositories",
    category: "development",
    comingSoon: true,
  },
]

const CATEGORIES = [
  { id: "communication", label: "Communication" },
  { id: "storage", label: "Storage" },
  { id: "development", label: "Development" },
]

export function IntegrationsGrid({
  organization,
  onComplete,
  onCancel,
}: IntegrationsGridProps) {
  const [connectedIntegrations] = useState<string[]>([])

  const handleSkip = async () => {
    try {
      await skipSetupStep(organization.slug, "integrations")
      onComplete()
    } catch {
      onComplete()
    }
  }

  const handleContinue = async () => {
    try {
      await skipSetupStep(organization.slug, "integrations")
      onComplete()
    } catch {
      onComplete()
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-xs font-mono text-gray-500">
        Connect external tools to enhance your workspace
      </div>

      {/* Integrations by Category */}
      {CATEGORIES.map((category) => {
        const categoryIntegrations = INTEGRATIONS.filter(
          (i) => i.category === category.id
        )

        return (
          <div key={category.id}>
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
              [{category.label}]
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categoryIntegrations.map((integration) => {
                const isConnected = connectedIntegrations.includes(integration.id)

                return (
                  <div
                    key={integration.id}
                    className={`
                      p-3 border transition-colors
                      ${isConnected ? "border-gray-900 bg-gray-50" : "border-gray-200"}
                      ${integration.comingSoon ? "opacity-60" : ""}
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900">{integration.name}</span>
                          {integration.comingSoon && (
                            <span className="text-xs font-mono text-gray-400">Soon</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {integration.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2">
                      {isConnected ? (
                        <span className="text-xs font-mono text-gray-900">✓ Connected</span>
                      ) : (
                        <button
                          disabled={integration.comingSoon}
                          className="px-2 py-1 text-xs font-mono border border-gray-300 text-gray-500 disabled:cursor-not-allowed"
                        >
                          {integration.comingSoon ? "Coming Soon" : "Connect"}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Info Box */}
      <div className="px-3 py-2 bg-gray-50 border border-gray-200 text-xs text-gray-600">
        We're building integrations. Have a request? Let us know.
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={handleSkip}
          className="text-xs font-mono text-gray-400 hover:text-gray-600"
        >
          Skip for now
        </button>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            className="px-4 py-2 text-xs font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
