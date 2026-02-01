import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import type {
  OrganizationWithRole,
  OrganizationMember,
  Document,
} from "../types/organization"
import * as organizationService from "../services/organization/organization.service"

interface OrganizationContextType {
  // Organizations
  organizations: OrganizationWithRole[]
  currentOrganization: OrganizationWithRole | null
  isLoading: boolean
  error: string | null

  // Actions
  loadOrganizations: () => Promise<void>
  selectOrganization: (slug: string) => Promise<void>
  createOrganization: (name: string, description?: string) => Promise<OrganizationWithRole>
  deleteOrganization: (slug: string) => Promise<void>

  // Members
  members: OrganizationMember[]
  loadMembers: () => Promise<void>
  inviteMember: (email: string, role: "ADMIN" | "EDITOR" | "VIEWER") => Promise<void>
  updateMemberRole: (memberId: string, role: "ADMIN" | "EDITOR" | "VIEWER") => Promise<void>
  removeMember: (memberId: string) => Promise<void>

  // Documents
  documents: Document[]
  loadDocuments: () => Promise<void>
  uploadDocument: (file: File) => Promise<Document>
  deleteDocument: (documentId: string) => Promise<void>
  refreshDocumentStatus: (documentId: string) => Promise<Document>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
)

export function OrganizationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([])
  const [currentOrganization, setCurrentOrganization] =
    useState<OrganizationWithRole | null>(null)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadOrganizations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const orgs = await organizationService.getUserOrganizations()
      setOrganizations(orgs)

      // Restore last selected org from localStorage
      const lastOrgSlug = localStorage.getItem("currentOrgSlug")
      if (lastOrgSlug) {
        const org = orgs.find((o) => o.slug === lastOrgSlug)
        if (org) {
          setCurrentOrganization(org)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load organizations"
      setError(message)
      console.error("Failed to load organizations:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const selectOrganization = useCallback(
    async (slug: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const org = await organizationService.getOrganization(slug)
        setCurrentOrganization(org)
        localStorage.setItem("currentOrgSlug", slug)

        // Clear and reload members and documents
        setMembers([])
        setDocuments([])
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to select organization"
        setError(message)
        console.error("Failed to select organization:", err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const createOrganization = useCallback(
    async (name: string, description?: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const org = await organizationService.createOrganization({
          name,
          description,
        })
        const orgWithRole: OrganizationWithRole = {
          ...org,
          userRole: "ADMIN",
        }
        setOrganizations((prev) => [...prev, orgWithRole])
        setCurrentOrganization(orgWithRole)
        localStorage.setItem("currentOrgSlug", org.slug)
        return orgWithRole
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create organization"
        setError(message)
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
        await organizationService.deleteOrganization(slug)
        setOrganizations((prev) => prev.filter((o) => o.slug !== slug))
        if (currentOrganization?.slug === slug) {
          setCurrentOrganization(null)
          localStorage.removeItem("currentOrgSlug")
          setMembers([])
          setDocuments([])
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete organization"
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [currentOrganization]
  )

  // Members
  const loadMembers = useCallback(async () => {
    if (!currentOrganization) return
    try {
      const membersList = await organizationService.getOrganizationMembers(
        currentOrganization.slug
      )
      setMembers(membersList)
    } catch (err) {
      console.error("Failed to load members:", err)
    }
  }, [currentOrganization])

  const inviteMember = useCallback(
    async (email: string, role: "ADMIN" | "EDITOR" | "VIEWER") => {
      if (!currentOrganization) throw new Error("No organization selected")
      const member = await organizationService.inviteMember(
        currentOrganization.slug,
        { email, role }
      )
      setMembers((prev) => [...prev, member])
    },
    [currentOrganization]
  )

  const updateMemberRole = useCallback(
    async (memberId: string, role: "ADMIN" | "EDITOR" | "VIEWER") => {
      if (!currentOrganization) throw new Error("No organization selected")
      const updated = await organizationService.updateMemberRole(
        currentOrganization.slug,
        memberId,
        { role }
      )
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? updated : m))
      )
    },
    [currentOrganization]
  )

  const removeMember = useCallback(
    async (memberId: string) => {
      if (!currentOrganization) throw new Error("No organization selected")
      await organizationService.removeMember(currentOrganization.slug, memberId)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    },
    [currentOrganization]
  )

  // Documents
  const loadDocuments = useCallback(async () => {
    if (!currentOrganization) return
    try {
      const docs = await organizationService.getOrganizationDocuments(
        currentOrganization.slug
      )
      setDocuments(docs)
    } catch (err) {
      console.error("Failed to load documents:", err)
    }
  }, [currentOrganization])

  const uploadDocument = useCallback(
    async (file: File) => {
      if (!currentOrganization) throw new Error("No organization selected")
      const doc = await organizationService.uploadDocument(
        currentOrganization.slug,
        file
      )
      setDocuments((prev) => [doc, ...prev])
      return doc
    },
    [currentOrganization]
  )

  const deleteDocument = useCallback(
    async (documentId: string) => {
      if (!currentOrganization) throw new Error("No organization selected")
      await organizationService.deleteDocument(
        currentOrganization.slug,
        documentId
      )
      setDocuments((prev) => prev.filter((d) => d.id !== documentId))
    },
    [currentOrganization]
  )

  const refreshDocumentStatus = useCallback(
    async (documentId: string) => {
      if (!currentOrganization) throw new Error("No organization selected")
      const doc = await organizationService.getDocumentStatus(
        currentOrganization.slug,
        documentId
      )
      setDocuments((prev) =>
        prev.map((d) => (d.id === documentId ? doc : d))
      )
      return doc
    },
    [currentOrganization]
  )

  // Load orgs on mount
  useEffect(() => {
    const token = localStorage.getItem("auth_token")
    if (token) {
      loadOrganizations()
    }
  }, [loadOrganizations])

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        isLoading,
        error,
        loadOrganizations,
        selectOrganization,
        createOrganization,
        deleteOrganization,
        members,
        loadMembers,
        inviteMember,
        updateMemberRole,
        removeMember,
        documents,
        loadDocuments,
        uploadDocument,
        deleteDocument,
        refreshDocumentStatus,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider"
    )
  }
  return context
}
