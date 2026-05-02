import { useCallback, useEffect, useState } from "react"

import { useOrganization } from "../contexts/organization.context"
import { MemoryService } from "../services/memory.service"
import type { Memory } from "../types/memory"
import { requireAuthToken } from "../utils/auth"

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [totalMemoryCount, setTotalMemoryCount] = useState<number>(0)
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id ?? null

  const fetchMemories = useCallback(async () => {
    try {
      requireAuthToken()

      const [memoriesData, totalCount] = await Promise.all([
        MemoryService.getMemoriesWithTransactionDetails(10000),
        MemoryService.getUserMemoryCount(),
      ])

      setMemories(memoriesData || [])
      setTotalMemoryCount(totalCount || 0)
    } catch (err) {
      console.error("Error fetching memories:", err)
    }
    // Re-fire whenever the active workspace changes. The fetch itself does
    // not yet pass org_id (server-side scoping lands in a follow-up commit),
    // but trigger parity matters now so the list refreshes on switch and the
    // future scoped call observes the right value the moment it ships.
  }, [orgId])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  return { memories, totalMemoryCount, refetch: fetchMemories }
}
