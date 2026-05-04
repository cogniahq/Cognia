"use client";

import { useState } from "react";
import { LayoutGroup, motion } from "framer-motion";

import {
  fadeUpVariants,
  staggerContainerVariants,
} from "@/components/shared/site-motion-variants";

import ActivityTab from "./ActivityTab";
import ApiKeysTab from "./ApiKeysTab";
import IntegrationsHealthTab from "./IntegrationsHealthTab";
import MembersTab from "./MembersTab";
import SecurityTab from "./SecurityTab";
import SsoSetupTab from "./SsoSetupTab";
import UpcomingTab from "./UpcomingTab";

type AdminTab =
  | "activity"
  | "members"
  | "security"
  | "integrations"
  | "sso"
  | "api-keys"
  | "upcoming";

const BASE_TABS: ReadonlyArray<{ id: AdminTab; label: string }> = [
  { id: "activity", label: "Activity" },
  { id: "members", label: "Members" },
  { id: "security", label: "Security" },
  { id: "integrations", label: "Integrations" },
  { id: "sso", label: "SSO" },
];

interface OrgAdminClientProps {
  slug: string;
  orgName: string;
  /** Org id (UUID) — required for the API Keys + Upcoming tabs which scope by id rather than slug. */
  orgId: string;
  /** Whether the calling user can manage members (offboard / hard-delete). Maps to the ADMIN role. */
  canManageMembers: boolean;
  /** Whether to show the API Keys tab. ADMIN-only (api_key.create / api_key.revoke). */
  canSeeApiKeys: boolean;
  /** Whether to show the Upcoming tab. Anyone with audit.read; granted to ADMIN/EDITOR/VIEWER. */
  canSeeUpcomingTab: boolean;
}

/**
 * Client island that owns the active-tab state for /org-admin/[slug] and
 * renders the per-tab body. The page-level Server Component does the
 * permission checks and hands down the booleans rather than re-fetching
 * /me on the client.
 */
export function OrgAdminClient({
  slug,
  orgName,
  orgId,
  canManageMembers,
  canSeeApiKeys,
  canSeeUpcomingTab,
}: OrgAdminClientProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("activity");

  const TABS: ReadonlyArray<{ id: AdminTab; label: string }> = [
    ...BASE_TABS,
    ...(canSeeApiKeys ? [{ id: "api-keys" as const, label: "API Keys" }] : []),
    ...(canSeeUpcomingTab
      ? [{ id: "upcoming" as const, label: "Upcoming" }]
      : []),
  ];

  return (
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
            {orgName}
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
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
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
              );
            })}
          </motion.div>
        </LayoutGroup>

        {/* Tab content - opacity-only fade to avoid layout jump */}
        <motion.div
          key={activeTab}
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6 min-h-[500px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === "activity" && <ActivityTab slug={slug} />}
          {activeTab === "members" && (
            <MembersTab slug={slug} canManageMembers={canManageMembers} />
          )}
          {activeTab === "security" && <SecurityTab slug={slug} />}
          {activeTab === "integrations" && (
            <IntegrationsHealthTab slug={slug} />
          )}
          {activeTab === "sso" && <SsoSetupTab slug={slug} />}
          {activeTab === "api-keys" && canSeeApiKeys && (
            <ApiKeysTab orgId={orgId} slug={slug} />
          )}
          {activeTab === "upcoming" && canSeeUpcomingTab && (
            <UpcomingTab orgId={orgId} />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default OrgAdminClient;
