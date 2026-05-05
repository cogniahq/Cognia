"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { useSession } from "@/lib/auth/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface OrgSwitcherProps {
  /** Override navigate behaviour (useful in tests). */
  onNavigate?: (path: string) => void
}

/**
 * Header org switcher. Lists the user's workspaces from the session;
 * picking one persists the slug to localStorage and navigates to the
 * org workspace. The previous Vite version owned the entire org context;
 * here the session is server-fetched and we only need a lightweight UI
 * to flip between orgs.
 */
export function OrgSwitcher({ onNavigate }: OrgSwitcherProps) {
  const session = useSession()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const go = (path: string) => {
    if (onNavigate) onNavigate(path)
    else router.push(path)
  }

  const orgs = session.organizations
  const current = session.primaryOrg

  const handleSelectOrg = (slug: string) => {
    setBusy(true)
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("currentOrgSlug", slug)
      }
    } catch {
      // storage may be unavailable; the server still resolves org context
    }
    go("/organization")
    setBusy(false)
  }

  const triggerLabel = current?.name ?? "Select workspace"
  const isAdmin = current?.role === "ADMIN"

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 h-8 text-xs font-mono text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50"
          disabled={busy}
          aria-label="Switch workspace"
        >
          <span className="max-w-[140px] truncate">{triggerLabel}</span>
          {isAdmin && (
            <span
              className="px-1.5 py-px text-[9px] font-mono uppercase tracking-wider text-gray-500 bg-gray-100 border border-gray-200"
              title="You are an admin of this workspace"
            >
              Admin
            </span>
          )}
          <span className="text-gray-400 text-[10px]">▾</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[240px] rounded-none border-gray-300"
      >
        {orgs.length > 0 ? (
          <>
            <div className="px-2 py-1.5 text-[10px] font-mono text-gray-500 uppercase tracking-wider">
              Workspaces
            </div>
            {orgs.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSelectOrg(org.slug)}
                className="cursor-pointer rounded-none text-xs font-mono"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="truncate">{org.name}</span>
                  {current?.id === org.id && (
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
          onClick={() => go("/onboarding/workspace")}
          className="cursor-pointer rounded-none text-xs font-mono"
        >
          + Create team workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default OrgSwitcher
