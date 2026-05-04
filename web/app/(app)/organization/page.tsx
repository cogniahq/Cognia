import type { Metadata } from "next";

import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};

/**
 * Workspace landing — currently a placeholder. The full Vite version
 * (client/src/pages/organization.page.tsx, ~800 lines) renders four
 * sub-tabs: Search, Mesh viz, Documents, Settings. Each has substantial
 * sub-component dependencies (mesh 3D viz, document upload + preview,
 * org settings forms).
 *
 * TODO(phase-3-followup): port the four-tab layout. Suggested order:
 *   1. Search tab (text query, hits list, citation drawer).
 *   2. Documents tab (DocumentList + DocumentUpload).
 *   3. Mesh tab (server-fetch /api/organizations/:slug/mesh, hand to a
 *      next/dynamic-loaded MemoryMesh3D island — same pattern as
 *      /mesh-showcase).
 *   4. Settings tab (basic org metadata + 2FA enforcement toggle).
 */
export default async function OrganizationPage() {
  const session = await getSession();
  if (!session) return null; // middleware redirect handles this
  const org = session.primaryOrg;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="space-y-6">
        <header>
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3">
            Workspace
            {org && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-500" />
                {org.name}
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-light font-editorial text-black">
            {org?.name ?? "Workspace"}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 font-mono">
            Organization knowledge graph and search.
          </p>
        </header>

        <div className="border border-gray-200 rounded-xl p-6 text-sm font-mono text-gray-600">
          The full workspace surface — search, mesh viz, documents, settings —
          ships in the Phase 3 follow-up. Use the nav to access /upcoming,
          /integrations, /docs, /analytics, and /profile in the meantime.
        </div>
      </div>
    </div>
  );
}
