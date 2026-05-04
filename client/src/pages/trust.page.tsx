import React from "react"
import { Link } from "react-router-dom"

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
    </LegalPageLayout>
  )
}
