import { useCallback, useEffect, useState } from "react"

import { getOrganizationMesh } from "../services/organization/organization.service"
import type { MemoryMesh } from "../types/memory"

export function useOrganizationMesh(
  slug: string | null,
  similarityThreshold: number = 0.3
) {
  const [meshData, setMeshData] = useState<MemoryMesh | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMeshData = useCallback(async () => {
    if (!slug) {
      setMeshData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await getOrganizationMesh(slug, 10000, similarityThreshold)
      // Cast to MemoryMesh - the service ensures the types are compatible
      setMeshData(data as unknown as MemoryMesh)
    } catch (err) {
      setError("Failed to load organization mesh")
      console.error("Error fetching organization mesh data:", err)
    } finally {
      setIsLoading(false)
    }
  }, [slug, similarityThreshold])

  useEffect(() => {
    fetchMeshData()
  }, [fetchMeshData])

  return { meshData, isLoading, error, refetch: fetchMeshData }
}
