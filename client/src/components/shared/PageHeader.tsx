import { useAuth } from "@/contexts/auth.context"
import { useOrganization } from "@/contexts/organization.context"
import { Search } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { useHasPermission } from "@/hooks/use-permissions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
// import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner"
import { OrgSwitcher } from "@/components/shared/OrgSwitcher"

interface UserMenuProps {
  email?: string
}

function UserMenu({ email }: UserMenuProps) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate("/login")
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
          onClick={() => navigate("/profile")}
          className="cursor-pointer rounded-none text-xs font-mono"
        >
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate("/settings/api-keys")}
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
    window.dispatchEvent(new CustomEvent("cognia:open-command-menu"))
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

export const PageHeader = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { accountType, user } = useAuth()
  const { currentOrganization } = useOrganization()

  const canSeeAdminLink = useHasPermission("audit.read")
  const canSeeBillingLink = useHasPermission("billing.read")

  const showAdminNav =
    accountType === "ORGANIZATION" &&
    !!currentOrganization?.slug &&
    canSeeAdminLink
  const showBillingNav =
    accountType === "ORGANIZATION" &&
    !!currentOrganization?.slug &&
    canSeeBillingLink

  const navItems: NavItem[] =
    accountType === "ORGANIZATION"
      ? [
          {
            label: "Workspace",
            path: "/organization",
            matchPrefixes: ["/organization", "/memories"],
          },
          { label: "Integrations", path: "/integrations" },
          ...(showAdminNav
            ? [
                {
                  label: "Admin",
                  path: `/org-admin/${currentOrganization!.slug}`,
                  matchPrefixes: ["/org-admin"],
                },
              ]
            : []),
          ...(showBillingNav ? [{ label: "Billing", path: "/billing" }] : []),
        ]
      : [
          {
            label: "Memories",
            path: "/memories",
            matchPrefixes: ["/memories"],
          },
          { label: "Analytics", path: "/analytics" },
          { label: "Integrations", path: "/integrations" },
        ]

  const isActive = (item: NavItem) => {
    const prefixes = item.matchPrefixes ?? [item.path]
    return prefixes.some(
      (prefix) =>
        location.pathname === prefix ||
        location.pathname.startsWith(prefix + "/")
    )
  }

  const dashboardPath =
    accountType === "ORGANIZATION" ? "/organization" : "/memories"

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-white/85 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Brand + primary nav */}
            <div className="flex items-center gap-8">
              <button
                onClick={() => navigate(dashboardPath)}
                className="flex items-center gap-2 -ml-1 px-1 py-1 hover:opacity-80 transition-opacity"
                aria-label="Go to dashboard"
              >
                <img
                  src="/black-transparent.png"
                  alt=""
                  aria-hidden="true"
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
                      onClick={() => navigate(item.path)}
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

            {/* Utilities */}
            <div className="flex items-center gap-1">
              <CommandMenuTrigger />
              <OrgSwitcher />
              <div className="w-px h-5 bg-gray-200 mx-1" aria-hidden="true" />
              <UserMenu email={user?.email} />
            </div>
          </div>
        </div>
      </header>
      <div className="h-14" aria-hidden="true" />
      {/* Email verification banner — disabled until the email provider is
          wired up. The sender is currently a stub (api/src/services/auth/
          email-verification.service.ts) so the banner only nags users with
          no way to actually verify. Re-enable when Resend/Postmark is live. */}
      {/* <EmailVerificationBanner /> */}
    </>
  )
}
