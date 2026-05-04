"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { path: "/organization", label: "Workspace" },
  { path: "/docs", label: "Docs" },
  { path: "/analytics", label: "Analytics" },
  { path: "/profile", label: "Profile" },
  { path: "/login", label: "Login" },
];

export const Navbar = () => {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 sm:gap-6 relative z-20">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.path;
        return (
          <Link
            key={item.path}
            href={item.path}
            className={`text-sm font-primary transition-colors ${
              isActive
                ? "text-black font-semibold"
                : "text-gray-600 hover:text-black"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};
