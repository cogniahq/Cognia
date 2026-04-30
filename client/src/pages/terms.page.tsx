import React from "react"

import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="mt-10 first:mt-0">
    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
      {title}
    </h2>
    <div className="text-sm sm:text-base text-gray-700 leading-relaxed space-y-3">
      {children}
    </div>
  </section>
)

export const Terms: React.FC = () => {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="The agreement between you and Cognia."
      lastUpdated="2026-04-30"
    >
      <p>
        By creating an account or otherwise using the Cognia service, you agree
        to these terms. If you are accepting on behalf of an organization, you
        represent that you have authority to bind that organization.
      </p>

      <Section title="The service">
        <p>
          Cognia is a personal and team memory layer for the web. We ingest,
          summarize, search, and surface content you choose to capture. Specific
          feature availability varies by plan; see the{" "}
          <a href="/pricing" className="text-blue-600 underline">
            pricing page
          </a>{" "}
          for current details.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Abuse or attempt to disrupt the service, including automated
            scraping or load that exceeds documented rate limits.
          </li>
          <li>
            Scrape, mirror, or republish Cognia's own product content,
            documentation, or UI.
          </li>
          <li>
            Resell, sublicense, or white-label the service except under a
            written reseller agreement.
          </li>
          <li>
            Use the service to store or transmit content that is unlawful,
            infringing, or violates a third party's rights.
          </li>
          <li>
            Use the service to develop a competing product based on comparing
            Cognia's behavior to ours.
          </li>
        </ul>
      </Section>

      <Section title="Intellectual property">
        <p>
          You retain all rights to the memories and content you upload. By
          uploading content, you grant Cognia a limited license to process that
          content on your behalf solely to operate the service.
        </p>
        <p>
          Cognia retains all rights to its software, models, design, and
          documentation. No license is granted to you except the right to use
          the service per these terms.
        </p>
      </Section>

      <Section title="Subscriptions and payment">
        <p>
          Paid plans are billed through Stripe in advance on a monthly or annual
          basis. Charges are non-refundable except as required by law or as
          expressly stated in your order form. You may cancel a subscription at
          any time via the billing portal; the cancellation takes effect at the
          end of the current billing period.
        </p>
        <p>
          Taxes (where applicable) are added to invoices and are your
          responsibility.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          To the maximum extent permitted by law, Cognia's aggregate liability
          arising out of or relating to the service is limited to the amounts
          you paid us in the twelve months preceding the event giving rise to
          the claim. We are not liable for indirect, incidental, consequential,
          special, or punitive damages.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You may terminate at any time by cancelling your subscription or
          deleting your account. We may suspend or terminate your account for
          material breach of these terms (including non-payment) on notice and a
          reasonable cure period where appropriate. Sections that by their
          nature should survive termination will survive.
        </p>
      </Section>

      <Section title="Governing law and disputes">
        <p>
          These terms are governed by the laws of the State of California,
          without regard to its conflict-of-laws principles. Any dispute that
          cannot be resolved informally within 60 days will be resolved by
          binding arbitration administered by the American Arbitration
          Association under its Commercial Arbitration Rules, held in San
          Francisco, California. Either party may seek injunctive relief in
          court for intellectual property infringement.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may revise these terms. Material changes will be communicated by
          email and in-product notice at least 30 days before they take effect.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions? Email{" "}
          <a
            href="mailto:legal@cognia.example"
            className="text-blue-600 underline"
          >
            legal@cognia.example
          </a>
          .
        </p>
      </Section>
    </LegalPageLayout>
  )
}
