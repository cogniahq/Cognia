"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { UpcomingList } from "@/components/upcoming/UpcomingList";
import { todosService, type MemoryTodo } from "@/services/todos.service";

interface UpcomingTabProps {
  /** Org id (UUID). Resolved server-side from the slug → session.organizations. */
  orgId: string;
}

/**
 * Org-admin "Upcoming" tab — same UpcomingList component as the user
 * surface, but scoped to all org members rather than just the calling
 * user. The org-admin shell does not pre-fetch this list, so we run
 * the first page fetch client-side here and hand it to UpcomingList.
 */
export default function UpcomingTab({ orgId }: UpcomingTabProps) {
  const [initial, setInitial] = useState<{
    todos: MemoryTodo[];
    cursor: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await todosService.list({
        organizationId: orgId,
        status: "PENDING",
        allMembers: true,
      });
      setInitial({ todos: res.data, cursor: res.nextCursor });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load upcoming");
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="px-4 py-3 border border-red-200 rounded-xl bg-red-50 text-xs text-red-700">
        {error}
      </div>
    );
  }

  if (!initial) {
    return (
      <div className="flex items-center justify-center py-16 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-xs text-gray-500">Loading upcoming...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs font-mono text-gray-600 uppercase tracking-wide">
        [UPCOMING] — extracted action items across all members
      </div>
      <UpcomingList
        organizationId={orgId}
        initialTodos={initial.todos}
        initialCursor={initial.cursor}
        allMembers
      />
    </div>
  );
}
