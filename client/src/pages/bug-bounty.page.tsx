import React from "react"

import { LegalPageLayout } from "@/components/legal/LegalPageLayout"

interface RewardTier {
  severity: string
  payout: string
  description: string
}

const REWARDS: RewardTier[] = [
  {
    severity: "Critical",
    payout: "$5,000",
    description:
      "Remote code execution, authentication bypass, large-scale data exposure.",
  },
  {
    severity: "High",
    payout: "$1,500",
    description:
      "Privilege escalation, IDOR with sensitive data, server-side request forgery.",
  },
  {
    severity: "Medium",
    payout: "$500",
    description:
      "Stored XSS, CSRF on sensitive actions, leaks of non-public metadata.",
  },
  {
    severity: "Low",
    payout: "$100",
    description:
      "Reflected XSS in unauthenticated surfaces, minor information disclosure.",
  },
]

export const BugBounty: React.FC = () => {
  return (
    <LegalPageLayout
      title="Bug Bounty"
      subtitle="We reward security researchers who help us keep Cognia safe."
    >
      <section>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Scope
        </h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            All hosts under <code className="font-mono">*.cognia.example</code>
          </li>
          <li>The Cognia public API</li>
          <li>The Cognia browser extension (Chrome and Firefox)</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Out of scope
        </h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Denial-of-service, volumetric attacks, or rate-limit testing</li>
          <li>
            Vulnerabilities in third-party services and subprocessors — please
            report those directly to the vendor
          </li>
          <li>Social engineering of Cognia employees or customers</li>
          <li>Physical attacks against Cognia property or personnel</li>
          <li>
            Issues that require a rooted/jailbroken device, a custom browser
            build, or pre-existing local access
          </li>
          <li>Self-XSS that requires victim cooperation to exploit</li>
          <li>Missing best-practice headers without a demonstrable impact</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Rewards
        </h2>
        <div className="not-prose overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-200">
                  Severity
                </th>
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-200">
                  Payout
                </th>
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-200">
                  Examples
                </th>
              </tr>
            </thead>
            <tbody>
              {REWARDS.map((r) => (
                <tr key={r.severity} className="even:bg-gray-50/50">
                  <td className="px-4 py-3 border-b border-gray-100 font-medium">
                    {r.severity}
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 font-mono">
                    {r.payout}
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700">
                    {r.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600 mt-3">
          Final severity is determined by the Cognia security team using CVSS
          3.1 as a guide. Duplicate reports are awarded to the first submitter
          with a working proof of concept.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Disclosure window
        </h2>
        <p>
          We aim to remediate confirmed reports within 90 days. We ask that you
          withhold public disclosure until we have shipped a fix or the 90-day
          window has elapsed, whichever comes first. If you need a longer or
          shorter window, tell us and we will negotiate in good faith.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Safe harbor
        </h2>
        <p>
          Research conducted within the scope and rules of this program is
          authorized; we will not pursue or support legal action against you for
          that research. Please do not access more data than is needed to
          demonstrate the vulnerability, and do not exfiltrate, destroy, or
          modify customer data.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3">
          Report a vulnerability
        </h2>
        <p>
          Email a written report with reproduction steps, affected URLs or
          endpoints, and your proposed severity to{" "}
          <a
            href="mailto:security@cognia.example"
            className="text-blue-600 underline"
          >
            security@cognia.example
          </a>
          . PGP keys are available on request.
        </p>
        <a
          href="mailto:security@cognia.example?subject=Vulnerability%20report"
          className="inline-block mt-4 px-4 py-2 bg-zinc-900 text-white text-sm rounded-md hover:bg-zinc-800 transition-colors not-prose"
        >
          Report a vulnerability
        </a>
      </section>
    </LegalPageLayout>
  )
}
