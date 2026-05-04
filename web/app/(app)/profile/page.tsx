import type { Metadata } from "next";

import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

/**
 * Profile — placeholder shell.
 *
 * The Vite version (client/src/pages/profile.page.tsx, 1144 lines) renders
 * an auto-maintained profile derived from captured memories: static profile
 * (long-term facts) + dynamic profile (recent context), plus a 2FA settings
 * card and a privacy/data-rights card with export + delete-account flows.
 *
 * TODO(phase-3-followup): port in this order:
 *   1. The basic profile fetch + render (read-only static + dynamic
 *      sections) — straightforward port of the JSON-driven UI.
 *   2. TwoFactorSettings (TOTP enroll + backup codes) — needs the
 *      two-factor.service.ts.
 *   3. DeleteAccountDialog (GDPR scheduled-delete with 30-day grace).
 *   4. Export-my-data link → ${publicApiUrl}/api/export.
 */
export default async function ProfilePage() {
  const session = await getSession();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Profile</h1>
          <p className="text-xs text-gray-600">
            Your automatically maintained profile based on processed content.
          </p>
        </div>

        {session && (
          <div className="bg-white border border-gray-200 p-4">
            <div className="text-sm font-mono text-gray-600 mb-2 uppercase tracking-wide">
              [ACCOUNT]
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-mono">
              <div>
                <span className="text-gray-600">Email:</span>{" "}
                <span className="text-gray-900">{session.user.email}</span>
              </div>
              <div>
                <span className="text-gray-600">Role:</span>{" "}
                <span className="text-gray-900">{session.user.role}</span>
              </div>
              {session.primaryOrg && (
                <div>
                  <span className="text-gray-600">Workspace:</span>{" "}
                  <span className="text-gray-900">
                    {session.primaryOrg.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border border-gray-200 rounded-xl p-6 text-sm font-mono text-gray-600">
          Static / dynamic profile, 2FA settings, export/delete: shipping in
          the Phase 3 follow-up. See client/src/pages/profile.page.tsx for the
          source-of-truth UI.
        </div>
      </div>
    </div>
  );
}
