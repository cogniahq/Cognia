import React from "react"
import { useNavigate } from "react-router-dom"

import { Footer } from "@/components/landing/Footer"
import { Header } from "@/components/landing/Header"

interface Tier {
  id: "free" | "pro" | "enterprise"
  name: string
  price: string
  cadence?: string
  blurb: string
  cta: string
  ctaHref: string
  features: string[]
  highlighted?: boolean
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "For individuals trying Cognia.",
    cta: "Start free",
    ctaHref: "/signup?plan=free",
    features: [
      "1 user",
      "100 memories",
      "1 integration",
      "Daily sync",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$20",
    cadence: "per user / month",
    blurb: "For small teams that need shared knowledge.",
    cta: "Start Pro trial",
    ctaHref: "/signup?plan=pro",
    highlighted: true,
    features: [
      "Up to 10 users",
      "10,000 memories",
      "5 integrations",
      "Hourly sync",
      "Email support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Talk to sales",
    blurb: "For organisations with compliance and scale needs.",
    cta: "Contact sales",
    ctaHref: "mailto:sales@cognia.so?subject=Cognia%20Enterprise",
    features: [
      "Unlimited users",
      "Unlimited memories",
      "Unlimited integrations",
      "Real-time sync",
      "SSO & SCIM",
      "Audit logs",
      "SOC 2",
      "Dedicated support",
    ],
  },
]

export const Pricing: React.FC = () => {
  const navigate = useNavigate()

  const handleCta = (tier: Tier) => {
    if (tier.ctaHref.startsWith("mailto:")) {
      window.location.href = tier.ctaHref
      return
    }
    navigate(tier.ctaHref)
  }

  return (
    <div
      className="min-h-screen text-black relative font-primary overflow-hidden"
      role="main"
      style={{
        backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
        color: "#000000",
      }}
    >
      <Header />
      <div className="h-16 sm:h-20 lg:h-24" aria-hidden="true" />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-4">
            Pricing
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            Transparent
          </div>
          <h1 className="text-3xl sm:text-5xl font-light font-editorial mb-3">
            One memory. Three plans.
          </h1>
          <p className="text-sm sm:text-base text-gray-700 max-w-xl mx-auto leading-relaxed">
            Start free, scale to Pro when your team grows, and upgrade to
            Enterprise when compliance, SSO, and SOC 2 enter the conversation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`flex flex-col border bg-white p-6 sm:p-8 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md ${
                tier.highlighted
                  ? "border-gray-900 ring-1 ring-gray-900/10"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-medium text-gray-900">
                    {tier.name}
                  </h2>
                  {tier.highlighted && (
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-900 border border-gray-900 px-2 py-0.5">
                      Most popular
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-light font-editorial text-gray-900">
                    {tier.price}
                  </span>
                  {tier.cadence && (
                    <span className="text-xs font-mono text-gray-500">
                      {tier.cadence}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  {tier.blurb}
                </p>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {tier.features.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-start gap-2.5 text-sm text-gray-700"
                  >
                    <svg
                      className="w-4 h-4 text-gray-900 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCta(tier)}
                className={`w-full px-4 py-2.5 text-sm font-medium transition-colors ${
                  tier.highlighted
                    ? "bg-gray-900 text-white hover:bg-black"
                    : "border border-gray-300 text-gray-900 hover:border-black hover:bg-gray-50"
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center text-xs font-mono text-gray-500 mt-10">
          Need something different?{" "}
          <a
            href="mailto:sales@cognia.so"
            className="underline hover:text-gray-900"
          >
            Email us
          </a>{" "}
          — we're flexible.
        </div>
      </section>

      <Footer />
    </div>
  )
}

export default Pricing
