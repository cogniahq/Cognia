import { useEffect, useState } from "react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useOrganization } from "@/contexts/organization.context"
import type { Document } from "@/types/organization"

const FILE_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
  "text/markdown": "MD",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
}

const STATUS_LABELS: Record<Document["status"], string> = {
  PENDING: "Queued",
  PROCESSING: "Processing",
  COMPLETED: "Ready",
  FAILED: "Failed",
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

export function DocumentList() {
  const { documents, loadDocuments, deleteDocument, currentOrganization } =
    useOrganization()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (currentOrganization) {
      loadDocuments()
    }
  }, [currentOrganization, loadDocuments])

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      await deleteDocument(deleteId)
    } catch (err) {
      console.error("Failed to delete document:", err)
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-sm font-mono text-gray-500">
          No documents yet
        </div>
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
          <div className="col-span-2 hidden md:block">Uploaded</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1"></div>
        </div>

        {/* Rows */}
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors items-center"
          >
            <div className="col-span-5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400 flex-shrink-0">
                  [{FILE_TYPE_LABELS[doc.mime_type] || "FILE"}]
                </span>
                <span className="text-sm text-gray-900 truncate">
                  {doc.original_name}
                </span>
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
            <div className="col-span-2">
              <span
                className={`text-xs font-mono ${
                  doc.status === "COMPLETED"
                    ? "text-green-600"
                    : doc.status === "FAILED"
                      ? "text-red-600"
                      : doc.status === "PROCESSING"
                        ? "text-blue-600"
                        : "text-gray-500"
                }`}
              >
                {STATUS_LABELS[doc.status]}
              </span>
              {doc.status === "FAILED" && doc.error_message && (
                <div className="text-xs font-mono text-red-500 truncate mt-0.5">
                  {doc.error_message}
                </div>
              )}
            </div>
            <div className="col-span-1 text-right">
              <button
                onClick={() => setDeleteId(doc.id)}
                className="text-xs font-mono text-gray-400 hover:text-red-600 transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={!!deleteId}
        onCancel={() => setDeleteId(null)}
        title="Delete Document"
        message="This will permanently delete the document and remove it from search."
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        onConfirm={handleDelete}
      />
    </>
  )
}
