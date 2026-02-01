import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useOrganization } from "@/contexts/organization.context"
import { Building2, Users, ChevronDown } from "lucide-react"

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const INDUSTRIES = [
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare & Life Sciences" },
  { value: "finance", label: "Financial Services" },
  { value: "legal", label: "Legal" },
  { value: "education", label: "Education" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "retail", label: "Retail & E-commerce" },
  { value: "consulting", label: "Consulting & Professional Services" },
  { value: "government", label: "Government & Public Sector" },
  { value: "nonprofit", label: "Non-profit" },
  { value: "media", label: "Media & Entertainment" },
  { value: "realestate", label: "Real Estate" },
  { value: "other", label: "Other" },
]

const TEAM_SIZES = [
  { value: "1-10", label: "1-10", description: "Small team" },
  { value: "11-50", label: "11-50", description: "Growing team" },
  { value: "51-200", label: "51-200", description: "Mid-size" },
  { value: "200+", label: "200+", description: "Enterprise" },
]

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState("")
  const [industry, setIndustry] = useState("")
  const [teamSize, setTeamSize] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const { createOrganization } = useOrganization()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Workspace name is required")
      return
    }
    if (!industry) {
      setError("Please select an industry")
      return
    }
    if (!teamSize) {
      setError("Please select your team size")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      await createOrganization(name.trim(), undefined, industry, teamSize)
      setName("")
      setIndustry("")
      setTeamSize("")
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create workspace"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setName("")
      setIndustry("")
      setTeamSize("")
      setError("")
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-none">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
            <Building2 className="h-3.5 w-3.5" />
            [NEW WORKSPACE]
          </div>
          <DialogTitle className="text-xl font-bold">
            Create Your Team Workspace
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Set up your organization to start collaborating with your team.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 py-4">
            {/* Workspace Name */}
            <div>
              <label className="block text-xs font-mono text-gray-600 uppercase tracking-wide mb-2">
                Workspace Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Acme Corporation"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError("")
                }}
                disabled={isSubmitting}
                className="w-full px-3 py-2.5 border border-gray-300 text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
                autoFocus
              />
            </div>

            {/* Industry */}
            <div>
              <label className="block text-xs font-mono text-gray-600 uppercase tracking-wide mb-2">
                Industry <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={industry}
                  onChange={(e) => {
                    setIndustry(e.target.value)
                    setError("")
                  }}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2.5 border border-gray-300 text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500 appearance-none bg-white transition-colors"
                >
                  <option value="">Select your industry...</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind.value} value={ind.value}>
                      {ind.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Team Size */}
            <div>
              <label className="flex items-center gap-2 text-xs font-mono text-gray-600 uppercase tracking-wide mb-3">
                <Users className="h-3.5 w-3.5" />
                Team Size <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TEAM_SIZES.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => {
                      setTeamSize(size.value)
                      setError("")
                    }}
                    disabled={isSubmitting}
                    className={`
                      px-3 py-3 border text-center transition-all
                      ${
                        teamSize === size.value
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-300 hover:border-gray-400 bg-white"
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <div className="text-sm font-semibold">{size.label}</div>
                    <div className={`text-xs mt-0.5 ${teamSize === size.value ? "text-gray-300" : "text-gray-500"}`}>
                      {size.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="px-3 py-2.5 bg-red-50 border border-red-200 text-xs font-mono text-red-600">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !industry || !teamSize}
              className="px-6 py-2.5 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </span>
                  Creating...
                </>
              ) : (
                "Create Workspace"
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
