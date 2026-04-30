import React from "react"
import { Link } from "react-router-dom"

import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

const Section: React.FC<{
  id: string
  title: string
  children: React.ReactNode
}> = ({ id, title, children }) => (
  <section id={id} className="mt-10 first:mt-0">
    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
      {title}
    </h2>
    <div className="text-sm sm:text-base text-gray-700 leading-relaxed space-y-3">
      {children}
    </div>
  </section>
)

export const Security: React.FC = () => {
  return (
    <LegalPageLayout
      title="Security at Cognia"
      subtitle="How we protect your memories, identities, and infrastructure."
      lastUpdated="2026-04-30"
    >
      <Section id="encryption" title="Encryption">
        <p>
          All traffic between your browser, our APIs, and our backing databases
          is encrypted in transit with TLS 1.2 or higher; older protocols are
          explicitly disabled.
        </p>
        <p>
          At rest, we apply AES-256-GCM column-level encryption to OAuth access
          and refresh tokens, TOTP 2FA secrets, and OIDC client secrets. Backing
          volumes are additionally encrypted by the underlying cloud provider.
        </p>
        <p>
          Master encryption keys are currently injected via environment
          variables on isolated runtime hosts. We are migrating to a managed KMS
          (AWS KMS) with envelope encryption and per-tenant data keys; the
          rotation tooling already lives behind the same interface.
        </p>
      </Section>

      <Section id="access-controls" title="Access controls">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Role-based access control with three tiers — ADMIN, EDITOR, VIEWER —
            enforced at the API layer.
          </li>
          <li>
            JWT access tokens are short-lived; refresh tokens rotate on every
            use with reuse-detection that revokes the entire token family on
            suspicious replay.
          </li>
          <li>
            Configurable session timeout per organization, with an
            org-admin-controlled IP allowlist that rejects connections at the
            gateway.
          </li>
          <li>
            Mandatory 2FA can be enforced for all org members; admins cannot
            disable their own 2FA without re-verification.
          </li>
        </ul>
      </Section>

      <Section id="authentication" title="Authentication">
        <ul className="list-disc pl-6 space-y-1">
          <li>TOTP-based 2FA (RFC 6238) with backup recovery codes.</li>
          <li>
            SAML 2.0 SSO (SP-initiated and IdP-initiated) with signed
            assertions.
          </li>
          <li>
            OIDC SSO with verified providers including Okta, Azure AD, and
            Google Workspace.
          </li>
          <li>
            SCIM 2.0 user provisioning and deprovisioning, including group
            mappings to Cognia roles.
          </li>
          <li>OAuth login via Google and Microsoft for personal accounts.</li>
          <li>
            Password breach checking against the HIBP k-anonymity API on sign-up
            and password change.
          </li>
        </ul>
      </Section>

      <Section id="audit-logging" title="Audit logging">
        <p>
          Every security-relevant action — logins, role changes, token issuance,
          memory exports, settings updates — is appended to an immutable audit
          log with the actor, timestamp, IP address, and user-agent.
        </p>
        <p>
          Org admins can export audit logs as CSV from the admin console.
          Retention is configurable per organization at 90 days, 365 days, or
          unlimited (Enterprise).
        </p>
      </Section>

      <Section id="network" title="Network">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            HTTP responses include a strict set of security headers via Helmet —
            HSTS with preload, a CSP that blocks inline scripts outside an
            explicit nonce list, X-Frame-Options DENY, and Referrer-Policy
            strict-origin-when-cross-origin.
          </li>
          <li>
            CORS is allowlist-based; no wildcard origins are accepted on
            authenticated endpoints.
          </li>
          <li>
            Per-IP and per-user rate limits protect login, password reset, and
            write endpoints. Failed-auth events feed an automatic temporary
            lockout.
          </li>
        </ul>
      </Section>

      <Section id="data-residency" title="Data residency">
        <p>
          Production data is stored in AWS us-east-1. EU and APAC residency
          options are on the Enterprise roadmap; if you require a specific
          region today, contact{" "}
          <a
            href="mailto:sales@cognia.example"
            className="text-blue-600 underline"
          >
            sales@cognia.example
          </a>
          .
        </p>
      </Section>

      <Section id="compliance" title="Compliance">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            SOC 2 Type 1 audit is in progress with a target completion of Q3.
            The audit letter will be available under NDA via the trust center.
          </li>
          <li>
            GDPR-ready: data subject rights (access, rectification, erasure,
            portability) are exposed in-product and by request.
          </li>
          <li>
            HIPAA: available on Enterprise with a signed Business Associate
            Agreement.
          </li>
        </ul>
      </Section>

      <Section id="incident-response" title="Incident response">
        <p>
          We acknowledge reported incidents within 24 hours. For confirmed
          incidents, we publish a public root-cause analysis within 72 hours of
          resolution and notify affected customers within 24 hours of confirming
          any exposure of personally identifiable information.
        </p>
      </Section>

      <Section id="bug-bounty" title="Bug bounty">
        <p>
          Responsible disclosures are rewarded. See our{" "}
          <Link to="/security/bug-bounty" className="text-blue-600 underline">
            bug bounty program
          </Link>{" "}
          for scope, rewards, and reporting instructions.
        </p>
      </Section>
    </LegalPageLayout>
  )
}
