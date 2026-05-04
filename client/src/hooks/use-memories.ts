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
        MemoryService.getMemoriesWithTransactionDetails(10000, orgId),
        MemoryService.getUserMemoryCount(orgId),
      ])

      setMemories(memoriesData || [])
      setTotalMemoryCount(totalCount || 0)
    } catch (err) {
      console.error("Error fetching memories:", err)
    }
    // Re-fire whenever the active workspace changes and pass the active org id
    // so the server scopes the result. `null` sends no `organizationId`, which
    // the API treats as personal-vault scope (organization_id IS NULL).
  }, [orgId])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  return { memories, totalMemoryCount, refetch: fetchMemories }
}
