import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { AuthUser } from '@/types/admin.types'
import { login as apiLogin, getCurrentUser } from '@/services/api'

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    const token = localStorage.getItem('admin_token')
    const storedUser = localStorage.getItem('admin_user')

    if (token && storedUser) {
      try {
        const currentUser = await getCurrentUser()
        if (currentUser.role === 'ADMIN') {
          setUser(currentUser)
        } else {
          localStorage.removeItem('admin_token')
          localStorage.removeItem('admin_user')
        }
      } catch {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
      }
    }
    setIsLoading(false)
  }

  async function login(email: string, password: string) {
    const { token, user } = await apiLogin(email, password)
    localStorage.setItem('admin_token', token)
    localStorage.setItem('admin_user', JSON.stringify(user))
    setUser(user)
  }

  function logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
