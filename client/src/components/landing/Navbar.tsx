import { Link, useLocation } from "react-router-dom"

export const Navbar = () => {
  const location = useLocation()
  const enableInternalRoutes =
    import.meta.env.VITE_ENABLE_INTERNAL_ROUTES !== "false"

  if (!enableInternalRoutes) {
    return null
  }

  const navItems = [
    { path: "/memories", label: "Memories" },
    { path: "/docs", label: "Docs" },
    { path: "/analytics", label: "Analytics" },
    { path: "/profile", label: "Profile" },
    { path: "/login", label: "Login" },
  ]

  return (
    <nav className="flex items-center gap-4 sm:gap-6 relative z-20">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`text-sm font-primary transition-colors ${
              isActive
                ? "text-black font-semibold"
                : "text-gray-600 hover:text-black"
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
