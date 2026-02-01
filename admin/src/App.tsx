import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/auth.context'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { LoginPage } from '@/pages/Login'
import { DashboardPage } from '@/pages/Dashboard'
import { UsersPage } from '@/pages/Users'
import { OrganizationsPage } from '@/pages/Organizations'
import { DocumentsPage } from '@/pages/Documents'
import { AnalyticsPage } from '@/pages/Analytics'
import { SystemPage } from '@/pages/System'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AdminLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/system" element={<SystemPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
