import type { Metadata } from "next";

import { ProfileClient } from "@/components/profile/ProfileClient";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

/**
 * Profile dashboard. The static + dynamic profile JSON, the 2FA settings
 * card, and the GDPR export/delete card all live in ProfileClient. The
 * (app) layout already gates on a valid session, so we don't need to
 * fetch session here.
 */
export default function ProfilePage() {
  return <ProfileClient />;
}
