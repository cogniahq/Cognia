import React from "react"

import { Navbar } from "./Navbar"

export const Header: React.FC = () => {
  return (
    <header className="fixed top-0 inset-x-0 z-40 py-3 sm:py-4 lg:py-5 relative">
      {/* Gradient blur overlays for header */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {[
          {
            className: "absolute -top-12 -left-12 w-32 sm:w-40 h-32 sm:h-40",
            from: "#a5b4fc",
            via: "#fbcfe8",
            to: "#fde68a",
            opacity: 0.25,
          },
          {
            className: "absolute -top-8 right-0 w-24 sm:w-32 h-24 sm:h-32",
            from: "#99f6e4",
            via: "#6ee7b7",
            to: "#a7f3d0",
            opacity: 0.2,
          },
        ].map((b, i) => (
          <div
            key={i}
            className={`${b.className} rounded-full blur-3xl`}
            style={{
              backgroundImage: `linear-gradient(135deg, ${b.from}, ${b.via}, ${b.to})`,
              opacity: b.opacity as number,
              filter: "blur(64px)",
            }}
          />
        ))}
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between gap-2 sm:gap-3 lg:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
            <img
              src="/black-transparent.png"
              alt="Cognia"
              className="w-8 h-8 sm:w-10 sm:h-10"
            />
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-bold text-italics font-editorial text-black">
                Cognia
              </span>
              <span className="text-[10px] sm:text-xs text-gray-600 font-mono -mt-0.5 sm:-mt-1">
                We Remember What The Web Showed You
              </span>
            </div>
          </div>
          <Navbar />
        </div>
      </div>
    </header>
  )
}
