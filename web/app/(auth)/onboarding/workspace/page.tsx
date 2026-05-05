import type { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"
import { OnboardingForm } from "@/components/auth/OnboardingForm"
import { getSession } from "@/lib/auth/session"

export const metadata: Metadata = {
  title: "Set up your workspace",
  robots: { index: false, follow: false },
}

/**
 * Forced onboarding wall. Reached two ways:
 *   1. Brand-new users right after /register.
 *   2. Authenticated users without an OrganizationMember row (they get
 *      bounced here from any /api/* call that returns
 *      403 NO_ORG_MEMBERSHIP, plus from (app)/layout.tsx).
 *
 * Server Component shell — verifies session, then mounts the client form
 * (<OnboardingForm />) which posts to the create/join Server Actions.
 */
export default async function OnboardingWorkspacePage() {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }
  if (session.organizations.length > 0) {
    redirect("/organization")
  }

  return (
    <div
      className="min-h-screen text-black font-primary"
      style={{
        backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
        color: "#000000",
      }}
    >
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Image
                src="/black-transparent.png"
                alt="Cognia"
                width={40}
                height={40}
                className="w-10 h-10"
                priority
              />
              <div className="flex flex-col text-left">
                <span className="text-xl font-bold font-editorial text-black">
                  Welcome to Cognia
                </span>
                <span className="text-xs text-gray-600 font-mono -mt-1">
                  One last step before you get started
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Cognia organizes memories into shared workspaces. Create your own,
              or join an existing one with an invite code.
            </p>
          </div>

          <OnboardingForm />
        </div>
      </div>
    </div>
  )
}
