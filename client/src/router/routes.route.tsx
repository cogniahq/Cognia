import { lazy, Suspense } from "react"
import { useAuth } from "@/contexts/auth.context"
import { AnimatePresence } from "framer-motion"
import { Navigate, Route, Routes, useLocation } from "react-router-dom"

import { AnimatedPage } from "@/components/shared/site-motion"

const Landing = lazy(() =>
  import("@/pages/landing.page").then((module) => ({ default: module.Landing }))
)
const Memories = lazy(() =>
  import("@/pages/memories.page").then((module) => ({
    default: module.Memories,
  }))
)
const MemoriesV2 = lazy(() =>
  import("@/pages/memories-v2.page").then((module) => ({
    default: module.MemoriesV2,
  }))
)
const MemoriesTrash = lazy(() =>
  import("@/components/memories/TrashView").then((module) => ({
    default: module.TrashView,
  }))
)
const Docs = lazy(() =>
  import("@/pages/docs.page").then((module) => ({ default: module.Docs }))
)
const Login = lazy(() =>
  import("@/pages/login.page").then((module) => ({ default: module.Login }))
)
const Analytics = lazy(() =>
  import("@/pages/analytics.page").then((module) => ({
    default: module.Analytics,
  }))
)
const Profile = lazy(() =>
  import("@/pages/profile.page").then((module) => ({ default: module.Profile }))
)
const Organization = lazy(() =>
  import("@/pages/organization.page").then((module) => ({
    default: module.Organization,
  }))
)
const Integrations = lazy(() =>
  import("@/pages/integrations.page").then((module) => ({
    default: module.Integrations,
  }))
)
const MeshShowcase = lazy(() =>
  import("@/pages/mesh-showcase.page").then((module) => ({
    default: module.MeshShowcase,
  }))
)
const OrgAdmin = lazy(() =>
  import("@/pages/org-admin.page").then((module) => ({
    default: module.OrgAdmin,
  }))
)
const VerifyEmail = lazy(() =>
  import("@/pages/verify-email.page").then((module) => ({
    default: module.VerifyEmail,
  }))
)
const AuthMagic = lazy(() =>
  import("@/pages/auth-magic.page").then((module) => ({
    default: module.AuthMagic,
  }))
)
const Pricing = lazy(() =>
  import("@/pages/pricing.page").then((module) => ({
    default: module.Pricing,
  }))
)
const Billing = lazy(() =>
  import("@/pages/billing.page").then((module) => ({
    default: module.Billing,
  }))
)
const Security = lazy(() =>
  import("@/pages/security.page").then((module) => ({
    default: module.Security,
  }))
)
const Trust = lazy(() =>
  import("@/pages/trust.page").then((module) => ({
    default: module.Trust,
  }))
)
const Privacy = lazy(() =>
  import("@/pages/privacy.page").then((module) => ({
    default: module.Privacy,
  }))
)
const Terms = lazy(() =>
  import("@/pages/terms.page").then((module) => ({
    default: module.Terms,
  }))
)
const SubprocessorsPage = lazy(() =>
  import("@/pages/subprocessors.page").then((module) => ({
    default: module.Subprocessors,
  }))
)
const DPAPage = lazy(() =>
  import("@/pages/dpa.page").then((module) => ({
    default: module.DPA,
  }))
)
const BugBounty = lazy(() =>
  import("@/pages/bug-bounty.page").then((module) => ({
    default: module.BugBounty,
  }))
)

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-sm font-mono text-gray-600">Loading...</div>
  </div>
)

// Redirect authenticated users to their respective dashboard
const AuthRedirectLanding = () => {
  const { isAuthenticated, isLoading, accountType } = useAuth()

  if (isLoading) {
    return <LoadingFallback />
  }

  if (isAuthenticated) {
    // Redirect based on account type
    if (accountType === "ORGANIZATION") {
      return <Navigate to="/organization" replace />
    }
    // Default to memories for personal accounts
    return <Navigate to="/memories" replace />
  }

  return <Landing />
}

const AppRoutes = () => {
  const enableInternalRoutes =
    import.meta.env.VITE_ENABLE_INTERNAL_ROUTES !== "false"
  const location = useLocation()

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AnimatePresence mode="wait" initial={false}>
        <AnimatedPage key={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={<AuthRedirectLanding />} />
            <Route path="/pricing" element={<Pricing />} />

            {/* Public trust & legal pages — always available */}
            <Route path="/security" element={<Security />} />
            <Route path="/security/bug-bounty" element={<BugBounty />} />
            <Route path="/trust" element={<Trust />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/subprocessors" element={<SubprocessorsPage />} />
            <Route path="/dpa" element={<DPAPage />} />
            {enableInternalRoutes ? (
              <>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Login />} />
                <Route path="/auth/verify-email" element={<VerifyEmail />} />
                <Route path="/auth/magic" element={<AuthMagic />} />
                <Route path="/memories" element={<Memories />} />
                <Route path="/memories/v2" element={<MemoriesV2 />} />
                <Route path="/memories/trash" element={<MemoriesTrash />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/organization" element={<Organization />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/mesh-showcase" element={<MeshShowcase />} />
                <Route path="/org-admin/:slug" element={<OrgAdmin />} />
                <Route path="/billing" element={<Billing />} />
              </>
            ) : (
              <>
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/signup" element={<Navigate to="/" replace />} />
                <Route
                  path="/auth/verify-email"
                  element={<Navigate to="/" replace />}
                />
                <Route
                  path="/auth/magic"
                  element={<Navigate to="/" replace />}
                />
                <Route path="/memories" element={<Navigate to="/" replace />} />
                <Route
                  path="/memories/v2"
                  element={<Navigate to="/" replace />}
                />
                <Route
                  path="/memories/trash"
                  element={<Navigate to="/" replace />}
                />
                <Route path="/docs" element={<Navigate to="/" replace />} />
                <Route
                  path="/analytics"
                  element={<Navigate to="/" replace />}
                />
                <Route path="/profile" element={<Navigate to="/" replace />} />
                <Route
                  path="/organization"
                  element={<Navigate to="/" replace />}
                />
                <Route
                  path="/integrations"
                  element={<Navigate to="/" replace />}
                />
                <Route
                  path="/mesh-showcase"
                  element={<Navigate to="/" replace />}
                />
                <Route
                  path="/org-admin/:slug"
                  element={<Navigate to="/" replace />}
                />
                <Route path="/billing" element={<Navigate to="/" replace />} />
              </>
            )}

            <Route path="*" element={<AuthRedirectLanding />} />
          </Routes>
        </AnimatedPage>
      </AnimatePresence>
    </Suspense>
  )
}

export default AppRoutes
