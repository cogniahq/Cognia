import { useEffect, useRef, useState } from "react"
import { useOrganization } from "@/contexts/organization.context"

import type { Document } from "@/types/organization"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

const FILE_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "text/plain": "TXT",
  "text/markdown": "MD",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
}

const INTEGRATION_SOURCE_LABELS: Record<string, string> = {
  google_drive: "Google Drive",
  slack: "Slack",
  notion: "Notion",
  box: "Box",
  github: "GitHub",
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

interface ActionMenuProps {
  doc: Document
  isAdmin: boolean
  onView: () => void
  onRemove: () => void
}

function ActionMenu({ doc, isAdmin, onView, onRemove }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs font-mono text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
      >
        ...
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 shadow-lg z-10 min-w-[120px]">
          {doc.url && (
            <button
              onClick={() => {
                onView()
                setIsOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-xs font-mono text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                onRemove()
                setIsOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-xs font-mono text-red-600 hover:bg-red-50 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function DocumentList() {
  const { documents, loadDocuments, deleteDocument, currentOrganization } =
    useOrganization()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const isAdmin = currentOrganization?.userRole === "ADMIN"

  useEffect(() => {
    if (currentOrganization) {
      loadDocuments()
    }
  }, [currentOrganization, loadDocuments])

  const handleRemove = (doc: Document) => {
    setDeleteId(doc.id)
    setDeleteDoc(doc)
  }

  const handleDelete = async () => {
    if (!deleteId || !deleteDoc) return
    setIsDeleting(true)
    try {
      await deleteDocument(deleteId, deleteDoc.type)
    } catch (err) {
      console.error("Failed to delete document:", err)
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
      setDeleteDoc(null)
    }
  }

  const handleView = (doc: Document) => {
    if (doc.url) {
      window.open(doc.url, "_blank", "noopener,noreferrer")
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-sm font-mono text-gray-500">No documents yet</div>
        <p className="mt-1 text-xs text-gray-400">
          Upload files to make them searchable
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="border border-gray-200">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-mono text-gray-500 uppercase tracking-wider">
          <div className="col-span-5">Document</div>
          <div className="col-span-2 hidden sm:block">Size</div>
          <div className="col-span-2 hidden md:block">Added</div>
          {isAdmin && (
            <div className="col-span-2 hidden lg:block">Added By</div>
          )}
          <div className={isAdmin ? "col-span-1" : "col-span-3"}>Actions</div>
        </div>

        {/* Rows */}
        {documents.map((doc) => {
          const isIntegration = doc.type === "integration"
          const typeLabel = isIntegration
            ? INTEGRATION_SOURCE_LABELS[doc.source || ""] ||
              doc.source?.toUpperCase() ||
              "SYNC"
            : FILE_TYPE_LABELS[doc.mime_type] || "FILE"

          // Get uploader info from metadata if available
          const uploaderName = doc.metadata?.uploader_name as string | undefined
          const uploaderRole = doc.metadata?.uploader_role as string | undefined

          return (
            <div
              key={doc.id}
              className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors items-center"
            >
              <div className="col-span-5 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono flex-shrink-0 ${
                      isIntegration ? "text-amber-600" : "text-gray-400"
                    }`}
                  >
                    [{typeLabel}]
                  </span>
                  {isIntegration && doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 truncate"
                    >
                      {doc.original_name}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-900 truncate">
                      {doc.original_name}
                    </span>
                  )}
                </div>
                {doc.page_count && (
                  <div className="text-xs font-mono text-gray-400 mt-0.5">
                    {doc.page_count} page{doc.page_count !== 1 && "s"}
                  </div>
                )}
              </div>
              <div className="col-span-2 hidden sm:block text-xs font-mono text-gray-500">
                {formatFileSize(doc.size_bytes)}
              </div>
              <div className="col-span-2 hidden md:block text-xs font-mono text-gray-500">
                {formatDate(doc.created_at)}
              </div>
              {isAdmin && (
                <div className="col-span-2 hidden lg:block">
                  <div className="text-xs font-mono text-gray-600 truncate">
                    {uploaderName ||
                      (isIntegration ? "Integration" : "Unknown")}
                  </div>
                  {uploaderRole && (
                    <div className="text-xs font-mono text-gray-400">
                      {uploaderRole}
                    </div>
                  )}
                </div>
              )}
              <div
                className={`${isAdmin ? "col-span-1" : "col-span-3"} text-right`}
              >
                <ActionMenu
                  doc={doc}
                  isAdmin={isAdmin}
                  onView={() => handleView(doc)}
                  onRemove={() => handleRemove(doc)}
                />
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        isOpen={!!deleteId}
        onCancel={() => {
          setDeleteId(null)
          setDeleteDoc(null)
        }}
        title="Remove Document"
        message={
          deleteDoc?.type === "integration"
            ? "This will remove the document from your knowledge base. It will not be re-synced unless you manually allow it again."
            : "This will permanently delete the document and remove it from search."
        }
        confirmLabel={isDeleting ? "Removing..." : "Remove"}
        onConfirm={handleDelete}
      />
    </>
  )
}
