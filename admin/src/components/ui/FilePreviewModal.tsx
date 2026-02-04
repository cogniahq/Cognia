import { useEffect, useState } from 'react'
import { Download, File, FileText, Image, X } from 'lucide-react'

import { formatBytes } from '@/lib/chart-config'

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  file: {
    id: string
    name: string
    size: number
    mimeType: string
    organizationName: string
  } | null
  downloadUrl: string | null
  isLoading: boolean
}

export function FilePreviewModal({
  isOpen,
  onClose,
  file,
  downloadUrl,
  isLoading,
}: FilePreviewModalProps) {
  const [iframeError, setIframeError] = useState(false)

  useEffect(() => {
    setIframeError(false)
  }, [downloadUrl])

  if (!isOpen) return null

  const isImage = file?.mimeType.startsWith('image/')
  const isPdf = file?.mimeType === 'application/pdf'
  const isText =
    file?.mimeType.startsWith('text/') || file?.mimeType === 'application/json'
  const canPreview = isImage || isPdf || isText

  function getFileIcon() {
    if (isImage) return <Image className="w-5 h-5" />
    if (isPdf || isText) return <FileText className="w-5 h-5" />
    return <File className="w-5 h-5" />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-[90vw] h-[90vh] max-w-6xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-muted-foreground">{getFileIcon()}</div>
            <div className="min-w-0">
              <h2
                className="text-sm font-medium text-foreground truncate"
                title={file?.name}
              >
                {file?.name || 'Loading...'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{file?.organizationName}</span>
                {file && (
                  <>
                    <span>•</span>
                    <span>{formatBytes(file.size)}</span>
                    <span>•</span>
                    <span className="font-mono">{file.mimeType}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={file?.name}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-muted/30">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground">
                Loading preview...
              </div>
            </div>
          ) : !downloadUrl ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground">
                Failed to load file
              </div>
            </div>
          ) : !canPreview || iframeError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <File className="w-16 h-16 text-muted-foreground/50" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  Preview not available for this file type
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {file?.mimeType}
                </p>
              </div>
              <a
                href={downloadUrl}
                download={file?.name}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download File
              </a>
            </div>
          ) : isImage ? (
            <div className="flex items-center justify-center h-full p-4">
              <img
                src={downloadUrl}
                alt={file?.name}
                className="max-w-full max-h-full object-contain rounded-md"
                onError={() => setIframeError(true)}
              />
            </div>
          ) : (
            <iframe
              src={downloadUrl}
              className="w-full h-full border-0"
              title={file?.name}
              onError={() => setIframeError(true)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
