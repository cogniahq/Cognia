import React, { useState } from "react"
import { toast } from "sonner"

import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

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

export const Subprocessors: React.FC = () => {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address")
      return
    }
    setSubmitted(true)
    toast.success(
      "Thanks — we will notify you when our subprocessor list changes."
    )
    setEmail("")
  }

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
        <form
          onSubmit={handleSubscribe}
          className="flex flex-col sm:flex-row gap-2 max-w-lg not-prose"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <button
            type="submit"
            disabled={submitted}
            className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {submitted ? "Subscribed" : "Subscribe"}
          </button>
        </form>
      </section>
    </LegalPageLayout>
  )
}
