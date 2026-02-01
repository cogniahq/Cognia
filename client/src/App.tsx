import { AuthProvider } from "@/contexts/auth.context"
import { NotificationProvider } from "@/contexts/notification.context"
import { TransactionPopupProvider } from "@/contexts/transaction-popup.context"
import { OrganizationProvider } from "@/contexts/organization.context"
import AppRoutes from "@/router/routes.route"
import { Analytics } from "@vercel/analytics/react"
import { BrowserRouter as Router } from "react-router-dom"

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { Toaster } from "@/components/ui/sonner"
import { CommandMenu } from "@/components/shared/CommandMenu"
import { ErrorBoundary } from "@/components/shared/ErrorBoundary"

function AppContent() {
  useKeyboardShortcuts()

  return (
    <>
      <CommandMenu />
      <AppRoutes />
      <Toaster />
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <OrganizationProvider>
            <NotificationProvider>
              <TransactionPopupProvider>
                <Analytics />
                <AppContent />
              </TransactionPopupProvider>
            </NotificationProvider>
          </OrganizationProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
