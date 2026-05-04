import type { Metadata } from "next"
import Link from "next/link"

import { Footer } from "@/components/landing/Footer"
import { Header } from "@/components/landing/Header"

const SITE_URL = "https://cogniahq.tech"

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
  // Numeric monthly USD price for the structured-data Offer. null = "Talk to
  // sales" tiers, which we surface as a separate Quote/contact link.
  priceMonthlyUsd: number | null
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
    priceMonthlyUsd: 0,
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
    priceMonthlyUsd: 20,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Talk to sales",
    blurb: "For organisations with compliance and scale needs.",
    cta: "Contact sales",
    ctaHref: "mailto:sales@cogniahq.tech?subject=Cognia%20Enterprise",
    features: [
      "Unlimited users",
      "Unlimited memories",
      "Unlimited integrations",
      "Real-time sync",
      "SSO & SCIM",
      "Audit logs",
      "Dedicated support",
    ],
    priceMonthlyUsd: null,
  },
]

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Cognia pricing — start free, scale to Pro at $20 per user / month for up to ten teammates, and upgrade to Enterprise when SSO, SCIM, and audit logs become non-negotiable.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing · Cognia",
    description:
      "Start free, scale to Pro for small teams, and upgrade to Enterprise when compliance, SSO, and audit logs enter the conversation.",
    url: "/pricing",
  },
}

/**
 * One Product per tier, each with a single Offer. AggregateOffer would be
 * cleaner but Google's pricing rich snippets work better against discrete
 * Product+Offer pairs and the tiers differ enough that grouping them into
 * a single Product is misleading.
 */
const productLdJson = TIERS.filter((t) => t.priceMonthlyUsd !== null).map(
  (tier) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: `Cognia ${tier.name}`,
    description: tier.blurb,
    brand: {
      "@type": "Brand",
      name: "Cognia",
    },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/pricing`,
      priceCurrency: "USD",
      price: String(tier.priceMonthlyUsd),
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: String(tier.priceMonthlyUsd),
        priceCurrency: "USD",
        unitText: tier.id === "pro" ? "MONTH" : "FOREVER",
      },
    },
  })
)

export default function PricingPage() {
  return (
    <>
      {productLdJson.map((schema, idx) => (
        <script
          key={`pricing-product-${idx}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <div
        className="min-h-screen text-black relative font-primary overflow-hidden"
        style={{
          backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
          color: "#000000",
        }}
      >
        <Header />
        <div className="h-16 sm:h-20 lg:h-24" aria-hidden="true" />

        <main>
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
                Enterprise when compliance and SSO enter the conversation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {TIERS.map((tier) => {
                const isMail = tier.ctaHref.startsWith("mailto:")
                const cardClasses = `flex flex-col border bg-white p-6 sm:p-8 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md ${
                  tier.highlighted
                    ? "border-gray-900 ring-1 ring-gray-900/10"
                    : "border-gray-200 hover:border-gray-300"
                }`
                const ctaClasses = `w-full px-4 py-2.5 text-sm font-medium transition-colors text-center block ${
                  tier.highlighted
                    ? "bg-gray-900 text-white hover:bg-black"
                    : "border border-gray-300 text-gray-900 hover:border-black hover:bg-gray-50"
                }`

                return (
                  <div key={tier.id} className={cardClasses}>
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

                    {isMail ? (
                      <a href={tier.ctaHref} className={ctaClasses}>
                        {tier.cta}
                      </a>
                    ) : (
                      <Link href={tier.ctaHref} className={ctaClasses}>
                        {tier.cta}
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="text-center text-xs font-mono text-gray-500 mt-10">
              Need something different?{" "}
              <a
                href="mailto:sales@cogniahq.tech"
                className="underline hover:text-gray-900"
              >
                Email us
              </a>{" "}
              — we&apos;re flexible.
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  )
}
