import { useEffect, useState } from "react"

import { Section } from "../components/landing"
import { AnalyticsDemo } from "../components/landing/AnalyticsDemo"
import { CTASection } from "../components/landing/CTASection"
import { EmailDraftingDemo } from "../components/landing/EmailDraftingDemo"
import { FlowSection } from "../components/landing/FlowSection"
import { Footer } from "../components/landing/Footer"
import { Header } from "../components/landing/Header"
import { HeroSection } from "../components/landing/HeroSection"
import { IntegrationsDemo } from "../components/landing/IntegrationsDemo"
import { MemoryMeshDemo } from "../components/landing/MemoryMeshDemo"
import { SecuritySection } from "../components/landing/SecuritySection"

export const Landing = () => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Prevent browser from restoring previous scroll position and ensure top on load
    if (typeof window !== "undefined" && typeof history !== "undefined") {
      try {
        if ("scrollRestoration" in history) {
          const historyWithScrollRestoration = history as {
            scrollRestoration?: string
          }
          historyWithScrollRestoration.scrollRestoration = "manual"
        }
      } catch {
        // Ignore errors setting scroll restoration
      }
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    }

    setIsVisible(true)
  }, [])

  return (
    <div
      className="min-h-screen text-black relative font-primary overflow-hidden"
      role="main"
      style={{
        backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
        color: "#000000",
      }}
    >
      {/* Configurable gradient blur overlays */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {[
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

      <Header />

      {/* spacer to offset fixed header height */}
      <div className="h-16 sm:h-20 lg:h-24" aria-hidden="true" />

      <HeroSection isVisible={isVisible} />

      <FlowSection isVisible={isVisible} />

      <IntegrationsDemo />

      <MemoryMeshDemo />

      <Section className="bg-transparent py-8 sm:py-10 lg:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmailDraftingDemo />
        </div>
      </Section>

      <AnalyticsDemo />

      <SecuritySection />

      <CTASection />

      <Footer />
    </div>
  )
}
