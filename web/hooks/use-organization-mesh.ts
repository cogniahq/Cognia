"use client"

/**
 * Fetches the org-scoped memory mesh used by /organization's Mesh tab.
 * Mirrors client/src/hooks/use-organization-mesh.ts. Returns mesh data
 * cast to MemoryMesh because OrganizationMeshNode is a structural superset
 * of MemoryMeshNode (the mesh viz only reads x/y/z/type/source/url).
 */

import { useCallback, useEffect, useState } from "react"

import { getOrganizationMesh } from "@/services/organization.service"
import type { MemoryMesh } from "@/types/memory"

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
