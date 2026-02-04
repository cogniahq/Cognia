import React from "react"

import { Section } from "./Section"
import { WaitlistForm } from "./WaitlistForm"

interface HeroSectionProps {
  isVisible: boolean
}

export const HeroSection: React.FC<HeroSectionProps> = ({ isVisible }) => {
  return (
    <Section className="min-h-screen bg-transparent relative overflow-hidden py-12 sm:py-16 lg:py-20 xl:py-28">
      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 h-full flex items-center">
        <div className="w-full text-center space-y-6 sm:space-y-8 lg:space-y-10 mx-auto">
          <div className="overflow-hidden">
            <h1
              className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-light leading-[1.1] sm:leading-tight font-editorial tracking-tight"
              style={{
                animation: isVisible ? "slideInUp 1s ease-out" : "none",
              }}
            >
              <span className="block text-black">
                <span className="align-baseline">Remember</span>{" "}
                <span className="font-editorial italic">everything</span>{" "}
                <span className="align-baseline">
                  you've<br />seen, written, or shared
                </span>
              </span>
            </h1>
          </div>

          {/* Concise value proposition */}
          <p
            className="mx-auto max-w-2xl text-base sm:text-lg lg:text-xl text-gray-800 leading-relaxed font-primary font-medium px-2 sm:px-0"
            style={{
              animation: isVisible ? "slideInUp 1s ease-out 0.6s both" : "none",
            }}
          >
            Cognia is your photographic memory for the web, capturing text,
            links and context as you browse so you can find it in seconds.
          </p>

          {/* Waitlist Form and Self-Host Option */}
          <div
            className="mt-6 sm:mt-8 lg:mt-10"
            style={{
              animation: isVisible ? "slideInUp 1s ease-out 0.8s both" : "none",
            }}
          >
            <div className="max-w-md mx-auto space-y-3 sm:space-y-4 px-2 sm:px-0">
              <WaitlistForm compact />
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-xs sm:text-sm text-gray-500 font-primary">
                  or
                </span>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>
              <button
                onClick={() =>
                  window.open("https://github.com/cogniahq/Cognia", "_blank")
                }
                className="w-full group relative overflow-hidden border border-gray-300 px-4 sm:px-6 py-2.5 sm:py-3 transition-all duration-200 hover:border-black hover:shadow-sm disabled:opacity-50 bg-white/80 backdrop-blur"
              >
                <span className="relative z-10 text-xs sm:text-sm font-medium text-gray-900 group-hover:text-white transition-colors duration-500 flex items-center justify-center gap-2">
                  <svg
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Self-host
                </span>
                <div className="absolute inset-0 bg-black transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
