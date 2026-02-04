import React, { useEffect, useRef, useState } from "react"

import { Section } from "./Section"

const securityFeatures = [
  {
    id: "2fa",
    title: "Two-factor authentication",
    description: "Add an extra layer of security with TOTP-based 2FA",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
  },
  {
    id: "privacy",
    title: "Audit logs & controls",
    description: "Full visibility into data access with granular permissions",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
  {
    id: "selfhost",
    title: "Self-host option",
    description: "Deploy on your own infrastructure for complete control",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
        />
      </svg>
    ),
  },
]

export const SecuritySection: React.FC = () => {
  const [isInView, setIsInView] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isInView) {
            setIsInView(true)
          }
        })
      },
      { threshold: 0.2 }
    )

    const currentContainer = containerRef.current
    if (currentContainer) {
      observer.observe(currentContainer)
    }

    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer)
      }
    }
  }, [isInView])

  useEffect(() => {
    if (!isInView) return

    const timers: ReturnType<typeof setTimeout>[] = []

    securityFeatures.forEach((feature, index) => {
      timers.push(
        setTimeout(
          () => {
            setCheckedItems((prev) => new Set([...prev, feature.id]))
          },
          800 + index * 400
        )
      )
    })

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [isInView])

  return (
    <Section className="bg-transparent py-12 sm:py-16 lg:py-20 xl:py-24">
      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes checkmarkDraw {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        ref={containerRef}
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3 sm:mb-4">
            Security
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            Trust
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-light font-editorial mb-3 sm:mb-4 px-2 sm:px-0">
            Built for trust
          </h2>
          <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-gray-700 px-4 sm:px-2 md:px-0 leading-relaxed">
            Your data stays yours. Enterprise-grade security with full
            transparency through open source.
          </p>
        </div>

        {/* Security Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {securityFeatures.map((feature, index) => {
            const isChecked = checkedItems.has(feature.id)
            return (
              <div
                key={feature.id}
                className="relative border border-gray-200 bg-white p-5 sm:p-6 rounded-xl shadow-sm transition-all duration-500 hover:shadow-md"
                style={{
                  animation: isInView
                    ? `fadeInScale 0.5s ease-out ${0.2 + index * 0.15}s both`
                    : "none",
                }}
              >
                {/* Checkmark indicator */}
                <div
                  className={`absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isChecked ? "bg-emerald-100" : "bg-gray-100"
                  }`}
                >
                  <svg
                    className={`w-3 h-3 transition-colors duration-300 ${
                      isChecked ? "text-emerald-600" : "text-gray-300"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                      style={{
                        strokeDasharray: 24,
                        strokeDashoffset: isChecked ? 0 : 24,
                        transition: "stroke-dashoffset 0.4s ease-out",
                      }}
                    />
                  </svg>
                </div>

                <div className="text-gray-700 mb-4">{feature.icon}</div>
                <h3 className="text-sm sm:text-base font-medium text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* Open Source Banner */}
        <div
          className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 sm:p-8"
          style={{
            animation: isInView ? "slideInUp 0.6s ease-out 0.8s both" : "none",
          }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
            {/* GitHub Logo */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-900 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  className="w-8 h-8 sm:w-10 sm:h-10 text-white"
                >
                  <path
                    fill="currentColor"
                    d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
                  />
                </svg>
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg sm:text-xl font-editorial font-light text-gray-900 mb-2">
                100% Open Source
              </h3>
              <p className="text-sm text-gray-600 mb-4 max-w-xl">
                Cognia is fully open source. Inspect the code, contribute
                improvements, or deploy your own instance. Transparency builds
                trust.
              </p>
              <a
                href="https://github.com/CogniaHQ/Cognia"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <path
                    fill="currentColor"
                    d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
                  />
                </svg>
                View on GitHub
              </a>
            </div>

            {/* Star count badge */}
            <div className="flex-shrink-0 hidden lg:block">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm">
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-mono text-gray-700">Star us</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
