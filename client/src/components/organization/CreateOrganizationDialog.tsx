import { useState } from "react"
import { useOrganization } from "@/contexts/organization.context"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  { value: "1-10", label: "1-10" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "200+", label: "200+" },
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
      <DialogContent className="sm:max-w-md rounded-none">
        <DialogHeader>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
            [NEW WORKSPACE]
          </div>
          <DialogTitle className="text-lg font-bold">
            Create Team Workspace
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            Set up your organization to start collaborating
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Workspace Name */}
            <div>
              <label className="block text-xs font-mono text-gray-600 uppercase tracking-wide mb-2">
                Workspace Name *
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
                className="w-full px-3 py-2 border border-gray-300 text-sm font-mono focus:outline-none focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                autoFocus
              />
            </div>

            {/* Industry */}
            <div>
              <label className="block text-xs font-mono text-gray-600 uppercase tracking-wide mb-2">
                Industry *
              </label>
              <select
                value={industry}
                onChange={(e) => {
                  setIndustry(e.target.value)
                  setError("")
                }}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-500 bg-white"
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Team Size */}
            <div>
              <label className="block text-xs font-mono text-gray-600 uppercase tracking-wide mb-2">
                Team Size *
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
                      px-3 py-2 border text-xs font-mono text-center transition-colors
                      ${
                        teamSize === size.value
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-300 hover:border-gray-400"
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 text-xs font-mono text-red-600">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !industry || !teamSize}
              className="px-4 py-2 text-xs font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Workspace"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
