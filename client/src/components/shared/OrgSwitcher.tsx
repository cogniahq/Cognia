import { useState } from "react"
import { useOrganization } from "@/contexts/organization.context"
import { useNavigate } from "react-router-dom"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateOrganizationDialog } from "@/components/organization/CreateOrganizationDialog"

interface OrgSwitcherProps {
  /** When true, includes the Personal pseudo-workspace at the top of the list. */
  includePersonal?: boolean
  /** Override navigate behaviour (useful in tests). */
  onNavigate?: (path: string) => void
}

const PERSONAL_LABEL = "Personal"

/**
 * Global org switcher rendered in the page header. Lists the user's team
 * workspaces plus a "Personal" pseudo-entry; the current selection is mirrored
 * in the OrganizationContext + localStorage (see organization.context.tsx).
 */
export function OrgSwitcher({
  includePersonal = true,
  onNavigate,
}: OrgSwitcherProps) {
  const navigate = useNavigate()
  const { organizations, currentOrganization, selectOrganization, isLoading } =
    useOrganization()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const go = (path: string) => {
    if (onNavigate) onNavigate(path)
    else navigate(path)
  }

  const handleSelectOrg = async (slug: string) => {
    try {
      await selectOrganization(slug)
      go("/organization")
    } catch {
      // surface via context error state; nothing actionable here
    }
  }

  const handleSelectPersonal = () => {
    try {
      localStorage.removeItem("currentOrgSlug")
    } catch {
      // ignore
    }
    go("/memories")
  }

  const triggerLabel = currentOrganization?.name ?? PERSONAL_LABEL

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50"
            disabled={isLoading}
            aria-label="Switch workspace"
          >
            <span className="max-w-[140px] truncate">
              {isLoading ? "Loading..." : triggerLabel}
            </span>
            <span className="text-gray-400">▼</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[240px] rounded-none border-gray-300"
        >
          {includePersonal && (
            <>
              <div className="px-2 py-1.5 text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                Account
              </div>
              <DropdownMenuItem
                onClick={handleSelectPersonal}
                className="cursor-pointer rounded-none text-xs font-mono"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="truncate">{PERSONAL_LABEL}</span>
                  {!currentOrganization && (
                    <span className="text-gray-400">✓</span>
                  )}
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {organizations.length > 0 ? (
            <>
              <div className="px-2 py-1.5 text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                Workspaces
              </div>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSelectOrg(org.slug)}
                  className="cursor-pointer rounded-none text-xs font-mono"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate">{org.name}</span>
                    {currentOrganization?.id === org.id && (
                      <span className="text-gray-400">✓</span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : (
            <div className="px-3 py-3 text-center">
              <p className="text-xs font-mono text-gray-500">
                No team workspaces
              </p>
            </div>
          )}

          <DropdownMenuItem
            onClick={() => setShowCreateDialog(true)}
            className="cursor-pointer rounded-none text-xs font-mono"
          >
            + Create team workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  )
}

export default OrgSwitcher
