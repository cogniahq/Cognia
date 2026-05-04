"use client"

import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Search } from "lucide-react"

import { logoutAction } from "@/lib/auth/actions"
import { useSession } from "@/lib/auth/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { OrgSwitcher } from "@/components/shared/OrgSwitcher"

interface UserMenuProps {
  email?: string
}

function UserMenu({ email }: UserMenuProps) {
  const router = useRouter()
  const handleLogout = async () => {
    // logoutAction throws NEXT_REDIRECT after clearing the cookie, but it's
    // a Server Action so we just await it and let it redirect.
    await logoutAction()
  }
  const initial = email?.trim().charAt(0).toUpperCase() || "U"
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-mono hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 transition-opacity"
          aria-label="Open user menu"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[220px] rounded-none border-gray-300"
      >
        {email && (
          <>
            <DropdownMenuLabel className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
              Signed in as
            </DropdownMenuLabel>
            <div className="px-2 pb-1.5 text-xs font-mono text-gray-700 truncate">
              {email}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={() => router.push("/profile")}
          className="cursor-pointer rounded-none text-xs font-mono"
        >
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/settings/api-keys")}
          className="cursor-pointer rounded-none text-xs font-mono"
        >
          API keys
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer rounded-none text-xs font-mono text-gray-700"
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface NavItem {
  label: string
  path: string
  /** Path prefixes that should mark this nav item as active. */
  matchPrefixes?: string[]
}

function CommandMenuTrigger() {
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().includes("MAC")

  const handleClick = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cognia:open-command-menu"))
    }
  }

  return (
    <button
      onClick={handleClick}
      className="hidden md:inline-flex items-center gap-2 px-3 h-8 text-xs font-mono text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      aria-label="Open command menu"
    >
      <Search className="w-3.5 h-3.5" />
      <span>Search</span>
      <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-gray-400">
        <kbd className="font-mono">{isMac ? "⌘" : "Ctrl"}</kbd>
        <kbd className="font-mono">K</kbd>
      </span>
    </button>
  )
}

/**
 * Persistent app chrome rendered above every (app)/ page. Uses session
 * data hydrated from the server layout, so no client-side fetch loop is
 * needed. Permissions are derived from the user's role on the active org
 * (Admin sees Admin + Billing nav slots; everyone else does not).
 */
export function PageHeader() {
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const session = useSession()

  const currentOrg = session.primaryOrg
  const inOrgContext = !!currentOrg

  // RBAC: the upstream API exposes per-org permissions, but for nav-gating
  // we only need the role (Admin vs Editor/Viewer). The "audit.read" and
  // "billing.read" permissions are admin-only on the server, so this
  // mirrors that without a separate permissions hydrate.
  const isAdmin = currentOrg?.role === "ADMIN"
  const showAdminNav = inOrgContext && !!currentOrg?.slug && isAdmin
  const showBillingNav = inOrgContext && !!currentOrg?.slug && isAdmin

  const navItems: NavItem[] = [
    ...(inOrgContext
      ? [
          {
            label: "Workspace",
            path: "/organization",
            matchPrefixes: ["/organization"],
          },
          { label: "Upcoming", path: "/upcoming" },
        ]
      : []),
    { label: "Analytics", path: "/analytics" },
    { label: "Integrations", path: "/integrations" },
    ...(showAdminNav
      ? [
          {
            label: "Admin",
            path: `/org-admin/${currentOrg!.slug}`,
            matchPrefixes: ["/org-admin"],
          },
        ]
      : []),
    ...(showBillingNav ? [{ label: "Billing", path: "/billing" }] : []),
  ]

  const isActive = (item: NavItem) => {
    const prefixes = item.matchPrefixes ?? [item.path]
    return prefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    )
  }

  // Brand button always lands on /organization — Cognia is org-only and the
  // (app)/layout guarantees the user has at least one membership.
  const dashboardPath = "/organization"

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-white/85 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <button
                onClick={() => router.push(dashboardPath)}
                className="flex items-center gap-2 -ml-1 px-1 py-1 hover:opacity-80 transition-opacity"
                aria-label="Go to dashboard"
              >
                <Image
                  src="/black-transparent.png"
                  alt=""
                  aria-hidden="true"
                  width={28}
                  height={28}
                  className="w-7 h-7"
                />
                <span className="text-sm font-semibold text-gray-900 tracking-tight">
                  Cognia
                </span>
              </button>

              <nav
                className="hidden md:flex items-center gap-1"
                aria-label="Primary"
              >
                {navItems.map((item) => {
                  const active = isActive(item)
                  return (
                    <button
                      key={item.path}
                      onClick={() => router.push(item.path)}
                      aria-current={active ? "page" : undefined}
                      className={`relative px-3 h-8 inline-flex items-center text-xs font-mono transition-colors ${
                        active
                          ? "text-gray-900"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      {item.label}
                      {active && (
                        <span
                          className="absolute left-3 right-3 -bottom-px h-px bg-gray-900"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>

            <div className="flex items-center gap-1">
              <CommandMenuTrigger />
              <OrgSwitcher />
              <div className="w-px h-5 bg-gray-200 mx-1" aria-hidden="true" />
              <UserMenu email={session.user.email} />
            </div>
          </div>
        </div>
      </header>
      <div className="h-14" aria-hidden="true" />
    </>
  )
}
