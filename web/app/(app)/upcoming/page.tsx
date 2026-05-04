import type { Metadata } from "next";

import { getSession } from "@/lib/auth/session";
import { apiFetch, ApiError } from "@/lib/api/server";
import { UpcomingList } from "@/components/upcoming/UpcomingList";
import type { MemoryTodo } from "@/services/todos.service";

export const metadata: Metadata = {
  title: "Upcoming",
  robots: { index: false, follow: false },
};

interface ApiTodosEnvelope {
  success: boolean;
  data: MemoryTodo[];
  nextCursor: string | null;
}

/**
 * Org-scoped "Upcoming" surface: extracted TODOs / scheduled events from
 * captured memories. The first page of PENDING todos is rendered on the
 * server so the page is meaningful before JavaScript boots; the client
 * island handles filter switches, infinite scroll, and per-row actions.
 *
 * Calendar OAuth itself lives at /integrations now (since the previous
 * pre-Phase-3 cleanup); the per-row "Add to calendar" button bounces
 * unconnected users there via UpcomingList → onCalendarConnectRequested.
 */
export default async function UpcomingPage() {
  const session = await getSession();
  if (!session) return null; // middleware redirects before we get here
  const orgId = session.primaryOrg?.id;
  if (!orgId) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="border border-gray-200 rounded-xl p-6 text-sm font-mono text-gray-600">
          Open an organization workspace to see extracted upcoming items.
        </div>
      </div>
    );
  }

  let initialTodos: MemoryTodo[] = [];
  let initialCursor: string | null = null;
  try {
    const res = await apiFetch<ApiTodosEnvelope>(
      `/api/todos?organizationId=${encodeURIComponent(orgId)}&status=PENDING`,
    );
    initialTodos = res.data ?? [];
    initialCursor = res.nextCursor ?? null;
  } catch (err) {
    // Best-effort SSR fetch — if the upstream is down, fall through with an
    // empty initial list and let the client retry on mount. Anything other
    // than a transient API error should re-throw to the error boundary.
    if (!(err instanceof ApiError)) throw err;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="space-y-6">
        <header>
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3">
            Workspace
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            Upcoming
          </div>
          <h1 className="text-2xl sm:text-3xl font-light font-editorial text-black">
            Upcoming
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 font-mono">
            Action items and scheduled events extracted from your captured
            memories.
          </p>
        </header>

        <UpcomingList
          organizationId={orgId}
          initialTodos={initialTodos}
          initialCursor={initialCursor}
        />
      </div>
    </div>
  );
}
