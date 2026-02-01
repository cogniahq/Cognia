import { useState } from "react"
import { Puzzle, ExternalLink, Check } from "lucide-react"
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
  icon: string
  category: "communication" | "storage" | "development"
  available: boolean
  comingSoon?: boolean
}

const INTEGRATIONS: Integration[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Get notifications in your channels",
    icon: "https://cdn.brandfolder.io/5H442O3W/at/pl546j-7le8zk-6gwiyo/Slack_Mark.svg",
    category: "communication",
    available: false,
    comingSoon: true,
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Notifications and updates",
    icon: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg",
    category: "communication",
    available: false,
    comingSoon: true,
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Import documents from Drive",
    icon: "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg",
    category: "storage",
    available: false,
    comingSoon: true,
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Import documents from Dropbox",
    icon: "https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg",
    category: "storage",
    available: false,
    comingSoon: true,
  },
  {
    id: "notion",
    name: "Notion",
    description: "Import pages from Notion",
    icon: "https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png",
    category: "development",
    available: false,
    comingSoon: true,
  },
  {
    id: "github",
    name: "GitHub",
    description: "Link repositories",
    icon: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
    category: "development",
    available: false,
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
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([])

  const handleConnect = (integrationId: string) => {
    // In a real implementation, this would open OAuth flow
    console.log("Connect integration:", integrationId)
    // For now, just mark as connected for demo
    setConnectedIntegrations((prev) => [...prev, integrationId])
  }

  const handleSkip = async () => {
    try {
      await skipSetupStep(organization.slug, "integrations")
      onComplete()
    } catch (err) {
      console.error("Failed to skip step:", err)
      onComplete() // Complete anyway
    }
  }

  const handleContinue = async () => {
    try {
      await skipSetupStep(organization.slug, "integrations")
      onComplete()
    } catch (err) {
      console.error("Failed to complete step:", err)
      onComplete()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-600 pb-4 border-b">
        <Puzzle className="h-4 w-4" />
        <span>Connect external tools to enhance your workspace</span>
      </div>

      {/* Integrations by Category */}
      {CATEGORIES.map((category) => {
        const categoryIntegrations = INTEGRATIONS.filter(
          (i) => i.category === category.id
        )

        return (
          <div key={category.id}>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {category.label}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {categoryIntegrations.map((integration) => {
                const isConnected = connectedIntegrations.includes(integration.id)

                return (
                  <div
                    key={integration.id}
                    className={`
                      p-4 border rounded-lg transition-all
                      ${
                        isConnected
                          ? "border-green-200 bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      }
                      ${!integration.available && "opacity-60"}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={integration.icon}
                        alt={integration.name}
                        className="w-10 h-10 rounded-lg object-contain"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${integration.name}&background=f3f4f6&color=6b7280`
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 truncate">
                            {integration.name}
                          </h4>
                          {integration.comingSoon && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              Soon
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {integration.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      {isConnected ? (
                        <div className="flex items-center gap-1.5 text-sm text-green-700">
                          <Check className="h-4 w-4" />
                          Connected
                        </div>
                      ) : integration.available ? (
                        <button
                          onClick={() => handleConnect(integration.id)}
                          className="w-full px-3 py-1.5 text-sm font-medium border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                        >
                          Connect
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full px-3 py-1.5 text-sm text-gray-400 border border-gray-200 rounded cursor-not-allowed"
                        >
                          Coming Soon
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
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          We're actively building integrations. Have a request?{" "}
          <button className="font-medium underline hover:no-underline">
            Let us know
          </button>
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <button
          onClick={handleSkip}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Skip for now
        </button>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            className="px-6 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 rounded transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
