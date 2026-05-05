"use client"

/**
 * Local org-data store for /organization. Replaces the React-Router-era
 * OrganizationContext (client/src/contexts/organization.context.tsx) with
 * a hook scoped to the OrganizationClient subtree. The (app) layout's
 * SessionProvider already supplies the user + memberships; this hook just
 * loads the per-slug detail (description, role) plus the org's documents
 * and members on demand.
 *
 * Persistence of the active workspace key (currentOrgSlug in localStorage)
 * is preserved so refreshing the page restores the same selection across
 * /organization, /upcoming, /analytics, etc.
 */

import { useCallback, useEffect, useState } from "react"

import * as orgService from "@/services/organization.service"
import type {
  Document,
  OrganizationMember,
  OrganizationWithRole,
} from "@/types/organization"

const STORAGE_KEY = "currentOrgSlug"

interface UseOrganizationDataResult {
  organizations: OrganizationWithRole[]
  currentOrganization: OrganizationWithRole | null
  isLoading: boolean
  error: string | null

  documents: Document[]
  members: OrganizationMember[]

  reloadOrganizations: () => Promise<void>
  selectOrganization: (slug: string) => Promise<void>
  createOrganization: (
    name: string,
    description?: string,
    industry?: string,
    teamSize?: string
  ) => Promise<OrganizationWithRole>
  deleteOrganization: (slug: string) => Promise<void>

  loadDocuments: () => Promise<void>
  uploadDocument: (
    file: File,
    metadata?: Record<string, unknown>
  ) => Promise<Document>
  deleteDocument: (
    documentId: string,
    type?: "document" | "integration"
  ) => Promise<void>
  refreshDocumentStatus: (documentId: string) => Promise<Document>
}

export function useOrganizationData(
  initialOrgSlug: string | null
): UseOrganizationDataResult {
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([])
  const [currentOrganization, setCurrentOrganization] =
    useState<OrganizationWithRole | null>(null)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reloadOrganizations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const orgs = await orgService.getUserOrganizations()
      setOrganizations(orgs)

      // Restore last-selected slug; falls back to the prop the server
      // component handed in (the user's primary org).
      let storedSlug: string | null = null
      try {
        storedSlug = localStorage.getItem(STORAGE_KEY)
      } catch {
        // private mode / SSR — ignore.
      }
      const targetSlug = storedSlug || initialOrgSlug
      if (targetSlug) {
        const matched = orgs.find((o) => o.slug === targetSlug)
        if (matched) setCurrentOrganization(matched)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load organizations"
      )
    } finally {
      setIsLoading(false)
    }
  }, [initialOrgSlug])

  const selectOrganization = useCallback(async (slug: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const org = await orgService.getOrganization(slug)
      setCurrentOrganization(org)
      try {
        localStorage.setItem(STORAGE_KEY, slug)
      } catch {
        // ignore
      }
      // Clear and reload members + docs for the new selection.
      setMembers([])
      setDocuments([])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to select organization"
      )
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createOrganization = useCallback(
    async (
      name: string,
      description?: string,
      industry?: string,
      teamSize?: string
    ) => {
      setIsLoading(true)
      setError(null)
      try {
        const org = await orgService.createOrganization({
          name,
          description,
          industry,
          teamSize,
        })
        const orgWithRole: OrganizationWithRole = {
          ...org,
          userRole: "ADMIN",
        }
        setOrganizations((prev) => [...prev, orgWithRole])
        setCurrentOrganization(orgWithRole)
        try {
          localStorage.setItem(STORAGE_KEY, org.slug)
        } catch {
          // ignore
        }
        return orgWithRole
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create organization"
        )
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const deleteOrganization = useCallback(
    async (slug: string) => {
      setIsLoading(true)
      setError(null)
      try {
        await orgService.deleteOrganization(slug)
        setOrganizations((prev) => prev.filter((o) => o.slug !== slug))
        if (currentOrganization?.slug === slug) {
          setCurrentOrganization(null)
          try {
            localStorage.removeItem(STORAGE_KEY)
          } catch {
            // ignore
          }
          setMembers([])
          setDocuments([])
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete organization"
        )
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [currentOrganization]
  )

  const loadDocuments = useCallback(async () => {
    if (!currentOrganization) return
    try {
      const docs = await orgService.getOrganizationDocuments(
        currentOrganization.slug
      )
      setDocuments(docs)
    } catch (err) {
      console.error("Failed to load documents:", err)
    }
  }, [currentOrganization])

  const loadMembers = useCallback(async () => {
    if (!currentOrganization) return
    try {
      const ms = await orgService.getOrganizationMembers(
        currentOrganization.slug
      )
      setMembers(ms)
    } catch (err) {
      console.error("Failed to load members:", err)
    }
  }, [currentOrganization])

  const uploadDocument = useCallback(
    async (file: File, metadata?: Record<string, unknown>) => {
      if (!currentOrganization) throw new Error("No organization selected")
      const doc = await orgService.uploadDocument(
        currentOrganization.slug,
        file,
        metadata
      )
      setDocuments((prev) => [doc, ...prev])
      return doc
    },
    [currentOrganization]
  )

  const deleteDocument = useCallback(
    async (documentId: string, type?: "document" | "integration") => {
      if (!currentOrganization) throw new Error("No organization selected")
      await orgService.deleteDocument(
        currentOrganization.slug,
        documentId,
        type
      )
      setDocuments((prev) => prev.filter((d) => d.id !== documentId))
    },
    [currentOrganization]
  )

  const refreshDocumentStatus = useCallback(
    async (documentId: string) => {
      if (!currentOrganization) throw new Error("No organization selected")
      const doc = await orgService.getDocumentStatus(
        currentOrganization.slug,
        documentId
      )
      setDocuments((prev) => prev.map((d) => (d.id === documentId ? doc : d)))
      return doc
    },
    [currentOrganization]
  )

  useEffect(() => {
    reloadOrganizations()
  }, [reloadOrganizations])

  useEffect(() => {
    if (currentOrganization) {
      loadDocuments()
      loadMembers()
    }
  }, [currentOrganization, loadDocuments, loadMembers])

  return {
    organizations,
    currentOrganization,
    isLoading,
    error,
    documents,
    members,
    reloadOrganizations,
    selectOrganization,
    createOrganization,
    deleteOrganization,
    loadDocuments,
    uploadDocument,
    deleteDocument,
    refreshDocumentStatus,
  }
}
