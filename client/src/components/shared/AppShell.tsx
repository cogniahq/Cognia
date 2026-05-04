import { Outlet } from "react-router-dom"

import { PageHeader } from "@/components/shared/PageHeader"

/**
 * Layout for authenticated app routes. Renders the persistent PageHeader
 * above an <Outlet/>. Hoisting the header out of every page (and above the
 * route-level Suspense boundary) keeps the chrome stable during lazy-route
 * transitions, eliminating the flash where the header disappears while the
 * next route's bundle loads.
 */
export const AppShell = () => {
  return (
    <div className="min-h-screen bg-white">
      <PageHeader />
      <Outlet />
    </div>
  )
}

export default AppShell
