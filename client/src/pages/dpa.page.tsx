import React from "react"

import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

export const DPA: React.FC = () => {
  return (
    <LegalPageLayout
      title="Data Processing Addendum"
      subtitle="Our standard DPA, available to every customer regardless of plan."
      lastUpdated="2026-04-30"
    >
      <section>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Standard DPA
        </h2>
        <p>
          Cognia's standard Data Processing Addendum is modeled on the European
          Commission's Standard Contractual Clauses (Module 2 — Controller to
          Processor) and incorporates the UK International Data Transfer
          Addendum where applicable. It documents:
        </p>
        <ul className="list-disc pl-6 space-y-1 mt-3">
          <li>
            The scope, nature, and purpose of processing under your
            subscription.
          </li>
          <li>Categories of data subjects and personal data processed.</li>
          <li>
            Technical and organizational measures (TOMs) — encryption, access
            control, monitoring, incident response.
          </li>
          <li>
            Subprocessor flow-down obligations and our notification commitments.
          </li>
          <li>
            International transfer mechanisms (SCCs, UK IDTA, Swiss addendum).
          </li>
          <li>Data subject rights assistance and breach notification SLAs.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Download
        </h2>
        <p className="mb-4">
          The standard DPA is pre-signed by Cognia. Counter-sign and email the
          executed copy back to{" "}
          <a
            href="mailto:legal@cognia.example"
            className="text-blue-600 underline"
          >
            legal@cognia.example
          </a>{" "}
          and we will return it for your records.
        </p>
        <a
          href="/legal/cognia-dpa-template.pdf"
          download
          className="inline-block px-4 py-2 bg-zinc-900 text-white text-sm rounded-md hover:bg-zinc-800 transition-colors not-prose"
        >
          Download standard DPA (PDF)
        </a>
      </section>

      <section className="mt-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Custom DPA
        </h2>
        <p>
          Enterprise customers with specific legal or regulatory requirements
          (HIPAA BAA, sector-specific addenda, jurisdiction riders) can request
          a custom DPA. Contact{" "}
          <a
            href="mailto:legal@cognia.example"
            className="text-blue-600 underline"
          >
            legal@cognia.example
          </a>{" "}
          with the relevant context and we will route to our outside counsel.
        </p>
      </section>
    </LegalPageLayout>
  )
}
