import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useOrganization } from "@/contexts/organization.context"

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const { createOrganization } = useOrganization()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Workspace name is required")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      await createOrganization(name.trim(), description.trim() || undefined)
      setName("")
      setDescription("")
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
      setDescription("")
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
            Create Workspace
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-xs font-mono text-gray-600 uppercase tracking-wide mb-2">
                Workspace Name
              </label>
              <input
                type="text"
                placeholder="e.g., Engineering Team"
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

            <div>
              <label className="block text-xs font-mono text-gray-600 uppercase tracking-wide mb-2">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                placeholder="A brief description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 text-sm font-mono focus:outline-none focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
              />
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
              disabled={isSubmitting || !name.trim()}
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
