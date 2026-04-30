import React from "react"
import { useAuth } from "@/contexts/auth.context"
import { useOrganization } from "@/contexts/organization.context"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"

import { useHasPermission } from "@/hooks/use-permissions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner"
import { OrgSwitcher } from "@/components/shared/OrgSwitcher"
import { fadeUpVariants } from "@/components/shared/site-motion-variants"

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
  const displayLabel = email ?? "Account"

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 px-2 py-1 text-xs font-mono text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors"
          aria-label="Open user menu"
        >
          <span className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-mono">
            {initial}
          </span>
          <span className="hidden sm:inline max-w-[140px] truncate">
            {displayLabel}
          </span>
          <span className="text-gray-400">▼</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[200px] rounded-none border-gray-300"
      >
        <DropdownMenuItem
          onClick={() => navigate("/profile")}
          className="cursor-pointer rounded-none text-xs font-mono"
        >
          Profile
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

interface PageHeaderProps {
  pageName: string
  rightActions?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  pageName,
  rightActions,
}) => {
  const navigate = useNavigate()
  const { accountType, user } = useAuth()
  const { currentOrganization } = useOrganization()

  // Determine the dashboard path based on account type
  const dashboardPath =
    accountType === "ORGANIZATION" ? "/organization" : "/memories"

  // Check if we're on the dashboard
  const currentPageLower = pageName.toLowerCase()
  const isDashboard =
    currentPageLower === "memories" || currentPageLower === "workspace"

  // Handle back navigation - go to dashboard instead of browser history
  // This avoids issues with OAuth redirects polluting browser history
  const handleBack = () => {
    navigate(dashboardPath)
  }

  const isOrgAdmin =
    accountType === "ORGANIZATION" &&
    currentOrganization?.userRole === "ADMIN" &&
    !!currentOrganization?.slug

  // Phase 7 RBAC: gate Admin / Billing nav by granular permissions.
  // We still scope to ORGANIZATION accounts, but the visibility itself is
  // driven by permissions hydrated from /api/auth/me.
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

  // Top-level nav items (no Profile/Logout — those live in the user menu)
  const allNavButtons =
    accountType === "ORGANIZATION"
      ? [
          { label: "Workspace", path: "/organization" },
          { label: "Integrations", path: "/integrations" },
          ...(showAdminNav
            ? [
                {
                  label: "Admin",
                  path: `/org-admin/${currentOrganization!.slug}`,
                },
              ]
            : []),
          ...(showBillingNav
            ? [
                {
                  label: "Billing",
                  path: "/billing",
                },
              ]
            : []),
        ]
      : [
          { label: "Memories", path: "/memories" },
          { label: "Analytics", path: "/analytics" },
          { label: "Integrations", path: "/integrations" },
        ]

  const navButtons = allNavButtons.filter(
    (btn) => !currentPageLower.includes(btn.label.toLowerCase())
  )

  return (
    <>
      <motion.header
        className="fixed top-0 inset-x-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200"
        initial="initial"
        animate="animate"
        variants={fadeUpVariants}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              {!isDashboard && (
                <>
                  <motion.button
                    onClick={handleBack}
                    className="text-sm font-medium text-gray-700 hover:text-black transition-colors relative group"
                    whileHover={{ x: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="relative z-10">← Back</span>
                    <div className="absolute inset-0 bg-gray-100 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left -z-10 rounded"></div>
                  </motion.button>
                  <div className="h-4 w-px bg-gray-300"></div>
                </>
              )}
              <div className="flex items-center gap-3">
                <img
                  src="/black-transparent.png"
                  alt="Cognia"
                  className="w-8 h-8"
                />
                <div className="text-sm font-medium text-gray-900">
                  {pageName}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {rightActions}
              <OrgSwitcher />
              {isOrgAdmin && (
                <span
                  className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-gray-500 border border-gray-300"
                  aria-label="Admin role"
                  title="You are an admin of this workspace"
                >
                  Admin
                </span>
              )}
              {navButtons.map((btn) => (
                <motion.button
                  key={btn.path}
                  onClick={() => (window.location.href = btn.path)}
                  className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors flex items-center gap-1.5"
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {btn.label}
                </motion.button>
              ))}
              <UserMenu email={user?.email} />
            </div>
          </div>
        </div>
      </motion.header>
      <div className="h-14" aria-hidden="true" />
      <EmailVerificationBanner />
    </>
  )
}
