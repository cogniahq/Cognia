import React from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"

import { fadeUpVariants } from "@/components/shared/site-motion-variants"

const TRUST_LINKS: { label: string; to: string; external?: boolean }[] = [
  { label: "Trust center", to: "/trust" },
  { label: "Security", to: "/security" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Subprocessors", to: "/subprocessors" },
  { label: "DPA", to: "/dpa" },
  { label: "Bug bounty", to: "/security/bug-bounty" },
  { label: "Status", to: "https://status.cogniahq.com", external: true },
]

export const Footer: React.FC = () => {
  return (
    <motion.footer
      className="bg-white/80 backdrop-blur border-t border-gray-200/50"
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, amount: 0.2 }}
      variants={fadeUpVariants}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 sm:gap-8">
          {/* Left: Brand */}
          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src="/black-transparent.png"
              alt="Cognia"
              className="w-7 h-7 sm:w-8 sm:h-8"
            />
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold font-editorial text-black leading-tight">
                Cognia
              </span>
              <span className="text-[10px] sm:text-xs text-gray-500 font-mono -mt-0.5">
                We Remember What The Web Showed You
              </span>
            </div>
          </div>

          {/* Right: Links */}
          <div className="flex items-center gap-4 sm:gap-6">
            <motion.button
              onClick={() =>
                window.open("https://github.com/cogniahq/Cognia", "_blank")
              }
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors group"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg
                className="w-4 h-4 group-hover:scale-110 transition-transform"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>GitHub</span>
            </motion.button>
            <motion.button
              onClick={() => window.open("https://x.com/cogniahq", "_blank")}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors group"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg
                className="w-4 h-4 group-hover:scale-110 transition-transform"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </motion.button>
          </div>
        </div>

        {/* Trust & legal */}
        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-200/50">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="text-xs font-mono uppercase tracking-wide text-gray-500">
              Trust & legal
            </div>
            <nav className="flex flex-wrap gap-x-4 gap-y-2">
              {TRUST_LINKS.map((link) =>
                link.external ? (
                  <a
                    key={link.to}
                    href={link.to}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs sm:text-sm text-gray-600 hover:text-black transition-colors"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-xs sm:text-sm text-gray-600 hover:text-black transition-colors"
                  >
                    {link.label}
                  </Link>
                )
              )}
            </nav>
          </div>
        </div>

        {/* Bottom: Copyright */}
        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-200/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500">
            <div>
              © {new Date().getFullYear()} Cognia. All rights reserved.
            </div>
            <div className="text-gray-400">
              A searchable memory for everything you see online.
            </div>
          </div>
        </div>
      </div>
    </motion.footer>
  )
}
