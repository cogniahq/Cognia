import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { useAuth } from "@/contexts/auth.context"

const Landing = lazy(() =>
  import("@/pages/landing.page").then((module) => ({ default: module.Landing }))
)
const Memories = lazy(() =>
  import("@/pages/memories.page").then((module) => ({
    default: module.Memories,
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

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<AuthRedirectLanding />} />
        {enableInternalRoutes ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/memories" element={<Memories />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/organization" element={<Organization />} />
            <Route path="/integrations" element={<Integrations />} />
          </>
        ) : (
          <>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/memories" element={<Navigate to="/" replace />} />
            <Route path="/docs" element={<Navigate to="/" replace />} />
            <Route path="/analytics" element={<Navigate to="/" replace />} />
            <Route path="/profile" element={<Navigate to="/" replace />} />
            <Route path="/organization" element={<Navigate to="/" replace />} />
            <Route path="/integrations" element={<Navigate to="/" replace />} />
          </>
        )}

        <Route path="*" element={<AuthRedirectLanding />} />
      </Routes>
    </Suspense>
  )
}

export default AppRoutes
