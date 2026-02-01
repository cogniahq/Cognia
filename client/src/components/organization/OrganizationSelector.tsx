import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useOrganization } from "@/contexts/organization.context"
import { CreateOrganizationDialog } from "./CreateOrganizationDialog"

export function OrganizationSelector() {
  const { organizations, currentOrganization, selectOrganization, isLoading } =
    useOrganization()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            <span className="max-w-[120px] truncate">
              {currentOrganization?.name || (isLoading ? "Loading..." : "Select")}
            </span>
            <span className="text-gray-400">▼</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px] rounded-none border-gray-300">
          {organizations.length > 0 ? (
            <>
              <div className="px-2 py-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider">
                Workspaces
              </div>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => selectOrganization(org.slug)}
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
            <div className="px-3 py-4 text-center">
              <p className="text-xs font-mono text-gray-500">No workspaces</p>
            </div>
          )}
          <DropdownMenuItem
            onClick={() => setShowCreateDialog(true)}
            className="cursor-pointer rounded-none text-xs font-mono"
          >
            + Create Workspace
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
