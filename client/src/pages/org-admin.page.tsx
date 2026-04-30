import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import { useOrganization } from "@/contexts/organization.context"
import { requireAuthToken } from "@/utils/auth"
import { LayoutGroup, motion } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"

import ActivityTab from "@/components/org-admin/ActivityTab"
import IntegrationsHealthTab from "@/components/org-admin/IntegrationsHealthTab"
import MembersTab from "@/components/org-admin/MembersTab"
import SecurityTab from "@/components/org-admin/SecurityTab"
import SsoSetupTab from "@/components/org-admin/SsoSetupTab"
import { PageHeader } from "@/components/shared/PageHeader"
import {
  fadeUpVariants,
  staggerContainerVariants,
} from "@/components/shared/site-motion-variants"

type AdminTab = "activity" | "members" | "security" | "integrations" | "sso"

const TABS: ReadonlyArray<{ id: AdminTab; label: string }> = [
  { id: "activity", label: "Activity" },
  { id: "members", label: "Members" },
  { id: "security", label: "Security" },
  { id: "integrations", label: "Integrations" },
  { id: "sso", label: "SSO" },
]

export function OrgAdmin() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { isLoading: authLoading } = useAuth()
  const { currentOrganization, organizations, loadOrganizations } =
    useOrganization()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState<AdminTab>("activity")

  useEffect(() => {
    try {
      requireAuthToken()
      setIsAuthenticated(true)
    } catch {
      navigate("/login")
    }
  }, [navigate])

  useEffect(() => {
    if (isAuthenticated && organizations.length === 0) {
      loadOrganizations()
    }
  }, [isAuthenticated, organizations.length, loadOrganizations])

  if (!isAuthenticated || authLoading) return null

  if (!slug) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader pageName="Admin" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-light font-editorial text-gray-900">
            No workspace selected
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Open an organization first, then return to the admin console.
          </p>
        </div>
      </div>
    )
  }

  const matchedOrg =
    currentOrganization?.slug === slug
      ? currentOrganization
      : organizations.find((o) => o.slug === slug)

  return (
    <div className="min-h-screen bg-white">
      <PageHeader pageName="Admin" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <motion.div
          className="space-y-8"
          initial="initial"
          animate="animate"
          variants={staggerContainerVariants}
        >
          {/* Header */}
          <motion.div variants={fadeUpVariants}>
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3">
              Workspace
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              Admin Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-light font-editorial text-black">
              {matchedOrg?.name || slug}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 font-mono">
              {slug}
            </p>
          </motion.div>

          {/* Tabs */}
          <LayoutGroup id="org-admin-tabs">
            <motion.div
              className="flex gap-1 border-b border-gray-200"
              variants={fadeUpVariants}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative overflow-hidden px-4 py-2.5 text-xs font-mono uppercase tracking-wide transition-colors ${
                      isActive
                        ? "text-white"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="org-admin-active-tab"
                        className="absolute inset-0 bg-gray-900"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </motion.button>
                )
              })}
            </motion.div>
          </LayoutGroup>

          {/* Tab content */}
          <motion.div
            key={activeTab}
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6 min-h-[500px]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === "activity" && <ActivityTab slug={slug} />}
            {activeTab === "members" && <MembersTab slug={slug} />}
            {activeTab === "security" && <SecurityTab slug={slug} />}
            {activeTab === "integrations" && (
              <IntegrationsHealthTab slug={slug} />
            )}
            {activeTab === "sso" && <SsoSetupTab slug={slug} />}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

export default OrgAdmin
