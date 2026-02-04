import {
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Users,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { useAuth } from '@/contexts/auth.context'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/organizations', icon: Building2, label: 'Organizations' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/system', icon: Settings, label: 'System' },
]

export function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <span className="text-sm font-mono uppercase tracking-wider">
            Cognia Admin
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2 text-xs font-mono uppercase tracking-wide
                  transition-colors
                  ${
                    isActive
                      ? 'bg-white text-gray-900'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }
                `}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
          [ADMIN]
        </div>
        <div className="text-xs text-gray-400 truncate mb-3">{user?.email}</div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs font-mono text-gray-500 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  )
}
