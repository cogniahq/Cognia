import { lazy, Suspense, useRef } from "react"
import { useAuth } from "@/contexts/auth.context"
import { Navigate, Route, Routes } from "react-router-dom"

import { AppShell } from "@/components/shared/AppShell"

const Landing = lazy(() =>
  import("@/pages/landing.page").then((module) => ({ default: module.Landing }))
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

// Used inside AppShell's Outlet — the AppShell already renders chrome, so
// this fallback only fills the content area, no chrome flash.
const ContentLoadingFallback = () => (
  <div className="flex items-center justify-center py-24">
    <div className="text-sm font-mono text-gray-500">Loading...</div>
  </div>
)

// Redirect authenticated users to /organization. The require-org-membership
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
    return <Navigate to="/organization" replace />
  }

  // Returning user with a stored token that failed auth (expired locally,
  // /auth/me network error, etc.) — send to /login instead of the public
  // marketing landing so they can re-authenticate.
  if (hadTokenAtMount.current) {
    return <Navigate to="/login" replace />
  }

  return <Landing />
}

// Authed routes mount inside <AppShell> which renders the persistent
// PageHeader above an <Outlet>. The Suspense boundary lives INSIDE the shell
// so lazy-route bundle loads no longer flash the chrome away.
const AppRoutes = () => {
  return (
    <Routes>
      {/* Public marketing + auth surfaces — no app chrome */}
      <Route
        path="/"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <AuthRedirectLanding />
          </Suspense>
        }
      />
      <Route
        path="/pricing"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Pricing />
          </Suspense>
        }
      />
      <Route
        path="/security"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Security />
          </Suspense>
        }
      />
      <Route
        path="/security/bug-bounty"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <BugBounty />
          </Suspense>
        }
      />
      <Route
        path="/trust"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Trust />
          </Suspense>
        }
      />
      <Route
        path="/privacy"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Privacy />
          </Suspense>
        }
      />
      <Route
        path="/terms"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Terms />
          </Suspense>
        }
      />
      <Route
        path="/subprocessors"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <SubprocessorsPage />
          </Suspense>
        }
      />
      <Route
        path="/dpa"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <DPAPage />
          </Suspense>
        }
      />
      <Route
        path="/login"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Login />
          </Suspense>
        }
      />
      <Route
        path="/signup"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Login />
          </Suspense>
        }
      />
      <Route
        path="/auth/verify-email"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <VerifyEmail />
          </Suspense>
        }
      />
      <Route
        path="/auth/magic"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <AuthMagic />
          </Suspense>
        }
      />
      <Route
        path="/onboarding/workspace"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <OnboardingWorkspace />
          </Suspense>
        }
      />

      {/* Authed app routes — share the persistent AppShell chrome */}
      <Route element={<AppShell />}>
        <Route
          path="/docs"
          element={
            <Suspense fallback={<ContentLoadingFallback />}>
              <Docs />
            </Suspense>
          }
        />
        <Route
          path="/analytics"
          element={
            <Suspense fallback={<ContentLoadingFallback />}>
              <Analytics />
            </Suspense>
          }
        />
        <Route
          path="/profile"
          element={
            <Suspense fallback={<ContentLoadingFallback />}>
              <Profile />
            </Suspense>
          }
        />
        <Route
          path="/organization"
          element={
            <Suspense fallback={<ContentLoadingFallback />}>
              <Organization />
            </Suspense>
          }
        />
        <Route
          path="/integrations"
          element={
            <Suspense fallback={<ContentLoadingFallback />}>
              <Integrations />
            </Suspense>
          }
        />
        <Route
          path="/mesh-showcase"
          element={
            <Suspense fallback={<ContentLoadingFallback />}>
              <MeshShowcase />
            </Suspense>
          }
        />
        <Route
          path="/org-admin/:slug"
          element={
            <Suspense fallback={<ContentLoadingFallback />}>
              <OrgAdmin />
            </Suspense>
          }
        />
        <Route
          path="/billing"
          element={
            <Suspense fallback={<ContentLoadingFallback />}>
              <Billing />
            </Suspense>
          }
        />
        <Route
          path="/settings/api-keys"
          element={
            <Suspense fallback={<ContentLoadingFallback />}>
              <ApiKeysPage />
            </Suspense>
          }
        />
        <Route
          path="/upcoming"
          element={
            <Suspense fallback={<ContentLoadingFallback />}>
              <Upcoming />
            </Suspense>
          }
        />
      </Route>

      {/* Legacy /memories paths land authed users back on /organization */}
      <Route
        path="/memories"
        element={<Navigate to="/organization" replace />}
      />
      <Route
        path="/memories/*"
        element={<Navigate to="/organization" replace />}
      />

      <Route
        path="*"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <AuthRedirectLanding />
          </Suspense>
        }
      />
    </Routes>
  )
}

export default AppRoutes
