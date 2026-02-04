import { useState } from 'react'
import { Shield } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '@/contexts/auth.context'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
          Loading...
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-8 h-8 text-gray-900" />
          </div>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
            [ADMIN PORTAL]
          </div>
          <h1 className="text-lg font-bold text-gray-900">Cognia Admin</h1>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 p-6"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-900 disabled:bg-gray-50"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-900 disabled:bg-gray-50"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 text-xs font-mono text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-gray-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            Admin access only. Unauthorized access is prohibited.
          </p>
        </div>
      </div>
    </div>
  )
}
