import React, { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

interface DocLink {
  title: string
  description: string
  href: string
  external?: boolean
}

const COMPLIANCE_LINKS: DocLink[] = [
  {
    title: "Security overview",
    description:
      "Encryption, access controls, network protections, and incident response.",
    href: "/security",
  },
  {
    title: "Privacy policy",
    description: "What we collect, how we use it, and your rights.",
    href: "/privacy",
  },
  {
    title: "Terms of service",
    description: "The contract that governs your use of Cognia.",
    href: "/terms",
  },
  {
    title: "Subprocessors",
    description: "Third parties that process customer data on our behalf.",
    href: "/subprocessors",
  },
  {
    title: "Data Processing Addendum",
    description: "Our standard DPA, modeled on the EU SCCs.",
    href: "/dpa",
  },
  {
    title: "Bug bounty",
    description: "Scope, rewards, and how to report a vulnerability.",
    href: "/security/bug-bounty",
  },
]

export const Trust: React.FC = () => {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleSoc2Request = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address")
      return
    }
    setSubmitted(true)
    toast.success(
      "Thanks — once your request is approved, we will email you the SOC 2 letter."
    )
    setEmail("")
  }

  return (
    <LegalPageLayout
      title="Trust Center"
      subtitle="Everything you need to evaluate Cognia for security, privacy, and compliance."
    >
      <section className="mt-2">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">
          Compliance
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 not-prose">
          {COMPLIANCE_LINKS.map((doc) => (
            <Link
              key={doc.href}
              to={doc.href}
              className="block p-4 border border-gray-200 rounded-md hover:border-gray-400 transition-colors"
            >
              <div className="font-semibold text-gray-900">{doc.title}</div>
              <div className="text-sm text-gray-600 mt-1">
                {doc.description}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Status page
        </h2>
        <p className="text-sm sm:text-base text-gray-700">
          Real-time uptime and incident history is available at{" "}
          <a
            href="https://status.cogniahq.com"
            target="_blank"
            rel="noreferrer noopener"
            className="text-blue-600 underline"
          >
            status.cogniahq.com
          </a>
          . Subscribe there to receive incident notifications by email or RSS.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Reports
        </h2>
        <p className="text-sm sm:text-base text-gray-700 mb-4">
          Our SOC 2 Type 1 audit letter is available under NDA. Enter your work
          email and a member of our security team will follow up.
        </p>
        <form
          onSubmit={handleSoc2Request}
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
            {submitted ? "Submitted" : "Request SOC 2 letter"}
          </button>
        </form>
      </section>

      <section className="mt-12">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Penetration testing
        </h2>
        <p className="text-sm sm:text-base text-gray-700">
          We perform an annual third-party penetration test of our public API,
          web application, and authentication surfaces. Cure53 is our target
          partner; pen-test summary letters are available under NDA.
        </p>
      </section>
    </LegalPageLayout>
  )
}
