import { lazy, Suspense, useRef } from "react"
import { useAuth } from "@/contexts/auth.context"
import { Navigate, Route, Routes } from "react-router-dom"

const Landing = lazy(() =>
  import("@/pages/landing.page").then((module) => ({ default: module.Landing }))
)
const Memories = lazy(() =>
  import("@/pages/memories.page").then((module) => ({
    default: module.Memories,
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
const ApiKeysPage = lazy(() =>
  import("@/pages/api-keys.page").then((module) => ({
    default: module.ApiKeys,
  }))
)
const Upcoming = lazy(() =>
  import("@/pages/upcoming.page").then((module) => ({
    default: module.Upcoming,
  }))
)
const OnboardingWorkspace = lazy(() =>
  import("@/pages/onboarding/workspace.page").then((module) => ({
    default: module.OnboardingWorkspace,
  }))
)

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-sm font-mono text-gray-600">Loading...</div>
  </div>
)

// Redirect authenticated users to /memories. The require-org-membership
// wall on the server will 403-redirect them to /onboarding/workspace if
// they haven't created or joined a workspace yet (handled by the axios
// interceptor).
const AuthRedirectLanding = () => {
  const { isAuthenticated, isLoading } = useAuth()
  const hadTokenAtMount = useRef(
    typeof window !== "undefined" && !!localStorage.getItem("auth_token")
  )

  if (isLoading) {
    return <LoadingFallback />
  }

  if (isAuthenticated) {
    return <Navigate to="/memories" replace />
  }

  // Returning user with a stored token that failed auth (expired locally,
  // /auth/me network error, etc.) — send to /login instead of the public
  // marketing landing so they can re-authenticate.
  if (hadTokenAtMount.current) {
    return <Navigate to="/login" replace />
  }

  return <Landing />
}

const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<AuthRedirectLanding />} />
        <Route path="/pricing" element={<Pricing />} />

        {/* Public trust & legal pages */}
        <Route path="/security" element={<Security />} />
        <Route path="/security/bug-bounty" element={<BugBounty />} />
        <Route path="/trust" element={<Trust />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/subprocessors" element={<SubprocessorsPage />} />
        <Route path="/dpa" element={<DPAPage />} />

        {/* App routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login />} />
        <Route path="/auth/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/magic" element={<AuthMagic />} />
        <Route path="/onboarding/workspace" element={<OnboardingWorkspace />} />
        <Route path="/memories" element={<Memories />} />
        <Route
          path="/memories/v2"
          element={<Navigate to="/memories" replace />}
        />
        <Route path="/memories/trash" element={<MemoriesTrash />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/organization" element={<Organization />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/mesh-showcase" element={<MeshShowcase />} />
        <Route path="/org-admin/:slug" element={<OrgAdmin />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/settings/api-keys" element={<ApiKeysPage />} />
        <Route path="/upcoming" element={<Upcoming />} />

        <Route path="*" element={<AuthRedirectLanding />} />
      </Routes>
    </Suspense>
  )
}

export default AppRoutes
