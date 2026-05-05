"use client"

import { motion } from "framer-motion"

const BLUR_ORBS = [
  {
    className:
      "absolute -top-24 -left-24 w-[28rem] sm:w-[36rem] h-[28rem] sm:h-[36rem]",
    from: "#818cf8",
    via: "#c084fc",
    to: "#f472b6",
    opacity: 0.55,
  },
  {
    className:
      "absolute -bottom-28 right-0 w-[28rem] sm:w-[36rem] h-[28rem] sm:h-[36rem]",
    from: "#2dd4bf",
    via: "#34d399",
    to: "#a78bfa",
    opacity: 0.55,
  },
]

/**
 * Decorative animated gradient orbs + grid backdrop for the landing page.
 * Pulled out as its own client island so the bulk of the landing page
 * stays a server component. Visual fidelity matches the Vite app.
 */
export const LandingBackground: React.FC = () => {
  return (
    <>
      {/* Configurable gradient blur overlays */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {BLUR_ORBS.map((b, i) => (
          <motion.div
            key={i}
            className={`${b.className} rounded-full blur-3xl`}
            style={{
              backgroundImage: `linear-gradient(135deg, ${b.from}, ${b.via}, ${b.to})`,
              opacity: b.opacity,
              filter: "blur(64px)",
            }}
            animate={{
              x: i === 0 ? [0, 30, -18, 0] : [0, -24, 16, 0],
              y: i === 0 ? [0, 18, -12, 0] : [0, -20, 12, 0],
              scale: [1, 1.05, 0.98, 1],
            }}
            transition={{
              duration: 18 + i * 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Animated background grid */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "24px 24px",
            animation: "gridMove 20s linear infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(24px, 24px); }
        }
      `}</style>
    </>
  )
}
