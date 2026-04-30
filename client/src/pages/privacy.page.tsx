import React from "react"
import { Link } from "react-router-dom"

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

export const Privacy: React.FC = () => {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How Cognia collects, uses, and protects your information."
      lastUpdated="2026-04-30"
    >
      <p>
        This policy describes how Cognia ("we", "us") handles personal data when
        you use the Cognia service. We have designed Cognia to follow the
        principles of data minimization, transparency, and user control.
      </p>

      <Section title="Information we collect">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Account information</strong> — name, email address,
            authentication factors (hashed password and TOTP secret), and the
            organization you belong to.
          </li>
          <li>
            <strong>Captured memories</strong> — content you save through the
            Cognia browser extension, integrations, or API. This may include
            URLs, page text, screenshots, and the metadata you attach.
          </li>
          <li>
            <strong>Usage analytics</strong> — pages visited, features used,
            performance timings, and crash reports. Optional and controlled by
            cookie consent.
          </li>
          <li>
            <strong>Billing information</strong> — handled by Stripe; we store
            only the subset of metadata needed to operate subscriptions.
          </li>
        </ul>
      </Section>

      <Section title="How we use it">
        <ul className="list-disc pl-6 space-y-1">
          <li>To provide and maintain the Cognia service.</li>
          <li>
            To run AI-driven analysis on captured memories so we can generate
            summaries, tags, and search results — strictly within the scope of
            the prompt that produced the request.
          </li>
          <li>To process payments and manage subscriptions through Stripe.</li>
          <li>
            To detect, prevent, and respond to abuse, fraud, and security
            incidents.
          </li>
          <li>
            To send transactional emails (auth, billing, security
            notifications). Marketing emails are opt-in.
          </li>
        </ul>
      </Section>

      <Section title="Sharing">
        <p>
          We do not sell personal data. We share data only with the
          subprocessors listed on our{" "}
          <Link to="/subprocessors" className="text-blue-600 underline">
            subprocessors page
          </Link>
          , each bound by a data-processing agreement, and with law enforcement
          when compelled by valid legal process.
        </p>
      </Section>

      <Section title="Your rights (GDPR / CCPA)">
        <p>
          Subject to applicable law, you have the right to access, correct,
          delete, restrict, and port your personal data, and to object to
          certain processing.
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Self-serve</strong> — the GDPR section in your in-app
            settings exposes data export and account deletion.
          </li>
          <li>
            <strong>By email</strong> — write to{" "}
            <a
              href="mailto:privacy@cognia.example"
              className="text-blue-600 underline"
            >
              privacy@cognia.example
            </a>{" "}
            and we will respond within 30 days.
          </li>
        </ul>
      </Section>

      <Section title="Retention">
        <p>
          Memories are retained until you delete them or close your account;
          deleted memories are purged within 30 days of deletion. Audit logs are
          retained per your organization's policy — 90 days, 365 days, or
          unlimited (Enterprise). Backups roll on a 30-day window.
        </p>
      </Section>

      <Section title="Cookies">
        <p>We use three categories of cookies:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Strictly necessary</strong> — required for authentication,
            security, and core functionality. Always on.
          </li>
          <li>
            <strong>Analytics</strong> — opt-in. Helps us understand which
            features are useful and where we should invest.
          </li>
          <li>
            <strong>Marketing</strong> — opt-in. Helps us measure outreach
            campaigns.
          </li>
        </ul>
        <p>
          You can review and change your preferences any time via the consent
          banner; your stored choice is honored across sessions.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Cognia is not intended for children under 16 and we do not knowingly
          collect personal data from children.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update this policy. Material changes will be communicated by
          email and a notice in-product at least 30 days before they take
          effect.
        </p>
      </Section>
    </LegalPageLayout>
  )
}
