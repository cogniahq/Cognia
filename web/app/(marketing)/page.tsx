import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AnalyticsDemo } from "@/components/landing/AnalyticsDemo"
import { CTASection } from "@/components/landing/CTASection"
import { EmailDraftingDemo } from "@/components/landing/EmailDraftingDemo"
import { FlowSection } from "@/components/landing/FlowSection"
import { Footer } from "@/components/landing/Footer"
import { Header } from "@/components/landing/Header"
import { HeroSection } from "@/components/landing/HeroSection"
import { IntegrationsDemo } from "@/components/landing/IntegrationsDemo"
import { LandingBackground } from "@/components/landing/LandingBackground"
import MemoryMeshDemo from "@/components/landing/MemoryMeshDemoClient"
import { Section } from "@/components/landing/Section"
import { SecuritySection } from "@/components/landing/SecuritySection"
import { getSession } from "@/lib/auth/session"

const SITE_URL = "https://cogniahq.tech"

export const metadata: Metadata = {
  // Use the root layout's default title (no template suffix on /).
  title: { absolute: "Cognia — Your team's searchable memory" },
  description:
    "Cognia is your team's photographic memory for the web — capture, weave, and recall everything you read, write, and decide, without changing how you work.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Cognia — Your team's searchable memory",
    description:
      "Capture, weave, and recall everything your team reads, writes, and decides — a living knowledge graph for the modern web.",
    url: "/",
  },
}

const softwareApplicationLdJson = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Cognia",
  description:
    "A living, searchable knowledge graph for your team. Cognia captures everything you read, write, and decide across the web and stitches it into a private memory mesh you can ask in plain language.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "0",
    highPrice: "20",
    offerCount: 3,
    url: `${SITE_URL}/pricing`,
  },
  publisher: {
    "@type": "Organization",
    name: "Cognia",
    url: SITE_URL,
  },
}

/**
 * Marketing landing. Authenticated users are bounced to /organization
 * server-side, so signed-in folks never see the marketing chrome flash.
 * Anonymous visitors get the full marketing experience with SSR'd HTML
 * for SEO + first-paint.
 */
export default async function HomePage() {
  const session = await getSession()
  if (session && session.organizations.length > 0) {
    redirect("/organization")
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationLdJson),
        }}
      />
      <main
        className="min-h-screen text-black relative font-primary overflow-hidden"
        style={{
          backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
          color: "#000000",
        }}
      >
        <LandingBackground />

        <Header />

        {/* spacer to offset fixed header height */}
        <div className="h-16 sm:h-20 lg:h-24" aria-hidden="true" />

        <HeroSection />
        <FlowSection />
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
      </main>
    </>
  )
}
