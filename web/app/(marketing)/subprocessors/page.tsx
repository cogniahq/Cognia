import type { Metadata } from "next"
import React from "react"

import { LegalPageLayout } from "@/components/legal/LegalPageLayout"
import { SubprocessorSubscribeForm } from "@/components/legal/SubprocessorSubscribeForm"

interface Subprocessor {
  name: string
  purpose: string
  region: string
  dpa: string
}

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "AWS",
    purpose: "Hosting & infrastructure",
    region: "us-east-1",
    dpa: "https://aws.amazon.com/compliance/gdpr-center/",
  },
  {
    name: "OpenAI",
    purpose: "LLM inference",
    region: "us-east-1",
    dpa: "https://openai.com/policies/data-processing-addendum/",
  },
  {
    name: "Anthropic",
    purpose: "LLM inference (BYOK supported)",
    region: "us-east-1",
    dpa: "https://anthropic.com/legal/dpa",
  },
  {
    name: "Stripe",
    purpose: "Billing & payments",
    region: "us-east-1",
    dpa: "https://stripe.com/legal/dpa",
  },
  {
    name: "Resend",
    purpose: "Transactional email",
    region: "us-east-1",
    dpa: "https://resend.com/dpa",
  },
  {
    name: "Sentry",
    purpose: "Error tracking",
    region: "us-east-1",
    dpa: "https://sentry.io/legal/dpa/",
  },
]

export const metadata: Metadata = {
  title: "Subprocessors",
  description:
    "Third parties that process customer data on Cognia's behalf — AWS, OpenAI, Anthropic, Stripe, Resend, Sentry — each bound by a DPA and listed with their region and our notification commitments.",
  alternates: { canonical: "/subprocessors" },
  openGraph: {
    title: "Subprocessors · Cognia",
    description:
      "The third parties that process customer data on Cognia's behalf, with regions and links to each subprocessor's DPA.",
    url: "/subprocessors",
  },
}

export default function SubprocessorsPage() {
  return (
    <LegalPageLayout
      title="Subprocessors"
      subtitle="Third parties that process customer data on Cognia's behalf."
      lastUpdated="2026-04-30"
    >
      <p>
        We use the subprocessors listed below to deliver the Cognia service.
        Each is bound by a data-processing agreement that requires them to
        handle customer data with at least the protections we commit to in our
        own DPA.
      </p>

      <div className="mt-8 not-prose overflow-x-auto">
        <table className="min-w-full border border-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-900 border-b border-gray-200">
                Subprocessor
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-900 border-b border-gray-200">
                Purpose
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-900 border-b border-gray-200">
                Region
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-900 border-b border-gray-200">
                DPA
              </th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((sub) => (
              <tr key={sub.name} className="even:bg-gray-50/50">
                <td className="px-4 py-3 border-b border-gray-100 font-medium text-gray-900">
                  {sub.name}
                </td>
                <td className="px-4 py-3 border-b border-gray-100 text-gray-700">
                  {sub.purpose}
                </td>
                <td className="px-4 py-3 border-b border-gray-100 font-mono text-xs text-gray-700">
                  {sub.region}
                </td>
                <td className="px-4 py-3 border-b border-gray-100">
                  <a
                    href={sub.dpa}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-blue-600 underline"
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-12">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Subscribe to subprocessor changes
        </h2>
        <p className="text-sm sm:text-base text-gray-700 mb-4">
          We notify subscribed customers at least 30 days before adding a new
          subprocessor or materially changing our reliance on an existing one.
        </p>
        <SubprocessorSubscribeForm />
      </section>
    </LegalPageLayout>
  )
}
