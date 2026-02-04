import { useEffect, useState } from "react"
import type { DocumentPreviewData } from "@/services/organization/organization.service"
import { ChevronRight, Download, File, FileText, Image, X } from "lucide-react"

interface DocumentPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  documentData: DocumentPreviewData | null
  isLoading: boolean
  error: string | null
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function DocumentPreviewModal({
  isOpen,
  onClose,
  documentData,
  isLoading,
  error,
}: DocumentPreviewModalProps) {
  const [iframeError, setIframeError] = useState(false)

  useEffect(() => {
    setIframeError(false)
  }, [documentData?.downloadUrl])

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const mimeType = documentData?.document.mime_type || ""
  const isImage = mimeType.startsWith("image/")
  const isPdf = mimeType === "application/pdf"
  const isText = mimeType.startsWith("text/") || mimeType === "application/json"
  const canPreview = isImage || isPdf || isText

  function getFileIcon() {
    if (isImage) return <Image className="w-5 h-5" />
    if (isPdf || isText) return <FileText className="w-5 h-5" />
    return <File className="w-5 h-5" />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white border border-gray-200 shadow-2xl w-[90vw] h-[85vh] max-w-5xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-gray-500">{getFileIcon()}</div>
            <div className="min-w-0">
              <h2
                className="text-sm font-medium text-gray-900 truncate"
                title={documentData?.document.original_name}
              >
                {isLoading
                  ? "Loading..."
                  : documentData?.document.original_name || "Document"}
              </h2>
              {documentData && (
                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                  <span>{formatBytes(documentData.document.size_bytes)}</span>
                  {documentData.pageNumber && (
                    <>
                      <ChevronRight className="w-3 h-3" />
                      <span>Page {documentData.pageNumber}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {documentData?.downloadUrl && (
              <a
                href={documentData.downloadUrl}
                download={documentData.document.original_name}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm font-mono text-gray-500">
                Loading document...
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <File className="w-12 h-12 text-gray-300" />
              <div className="text-sm text-red-600 font-mono">{error}</div>
            </div>
          ) : !documentData ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm font-mono text-gray-500">
                No document data
              </div>
            </div>
          ) : !canPreview || iframeError ? (
            <div className="flex flex-col h-full">
              {/* Chunk content preview */}
              {documentData.chunkContent && (
                <div className="flex-1 overflow-auto p-6">
                  <div className="max-w-3xl mx-auto">
                    <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
                      Relevant excerpt
                      {documentData.pageNumber &&
                        ` (Page ${documentData.pageNumber})`}
                    </div>
                    <div className="bg-white border border-gray-200 p-4">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {documentData.chunkContent}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Download fallback */}
              <div className="p-6 border-t border-gray-200 bg-white">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-xs text-gray-500 font-mono">
                    Full preview not available for {mimeType}
                  </p>
                  <a
                    href={documentData.downloadUrl}
                    download={documentData.document.original_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-mono hover:bg-gray-800 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Full Document
                  </a>
                </div>
              </div>
            </div>
          ) : isImage ? (
            <div className="flex items-center justify-center h-full p-4">
              <img
                src={documentData.downloadUrl}
                alt={documentData.document.original_name}
                className="max-w-full max-h-full object-contain"
                onError={() => setIframeError(true)}
              />
            </div>
          ) : (
            <iframe
              src={documentData.downloadUrl}
              className="w-full h-full border-0"
              title={documentData.document.original_name}
              onError={() => setIframeError(true)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
