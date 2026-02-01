import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth.context'
import { Sidebar } from './Sidebar'

export function AdminLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
          Loading...
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
