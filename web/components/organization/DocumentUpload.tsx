"use client";

import { useCallback, useRef, useState } from "react";

import type { Document } from "@/types/organization";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const FILE_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "text/plain": "TXT",
  "text/markdown": "MD",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/gif": "GIF",
  "image/webp": "WEBP",
};

type ProcessingStage =
  | "extracting_text"
  | "chunking"
  | "generating_embeddings"
  | "indexing"
  | "completed";

interface ProcessingProgress {
  current?: number;
  total?: number;
  summary?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "processing" | "completed" | "error";
  error?: string;
  document?: Document;
  processingStage?: ProcessingStage;
  processingProgress?: ProcessingProgress;
}

const STAGE_LABELS: Record<ProcessingStage, string> = {
  extracting_text: "Extracting text",
  chunking: "Chunking content",
  generating_embeddings: "Generating embeddings",
  indexing: "Indexing",
  completed: "Completed",
};

interface DocumentUploadProps {
  onUpload: (
    file: File,
    metadata?: Record<string, unknown>,
  ) => Promise<Document>;
  onPollStatus: (documentId: string) => Promise<Document>;
}

export function DocumentUpload({
  onUpload,
  onPollStatus,
}: DocumentUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Unsupported file type";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File too large (max 50MB)";
    }
    return null;
  };

  const handleUpload = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setUploadingFiles((prev) => [
          ...prev,
          {
            file,
            progress: 0,
            status: "error",
            error: validationError,
          },
        ]);
        return;
      }

      const uploadEntry: UploadingFile = {
        file,
        progress: 0,
        status: "uploading",
      };

      setUploadingFiles((prev) => [...prev, uploadEntry]);

      try {
        setUploadingFiles((prev) =>
          prev.map((f) => (f.file === file ? { ...f, progress: 50 } : f)),
        );

        const tags = tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

        const metadata: Record<string, unknown> | undefined =
          tags.length > 0 ? { tags } : undefined;

        const doc = await onUpload(file, metadata);

        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.file === file
              ? { ...f, progress: 100, status: "processing", document: doc }
              : f,
          ),
        );

        // Poll status; clear on terminal state, max 5 minutes overall.
        const pollInterval = setInterval(async () => {
          try {
            const updatedDoc = await onPollStatus(doc.id);
            const meta = updatedDoc.metadata as
              | {
                  processing_stage?: ProcessingStage;
                  processing_progress?: ProcessingProgress;
                }
              | null
              | undefined;

            if (updatedDoc.status === "COMPLETED") {
              clearInterval(pollInterval);
              setUploadingFiles((prev) =>
                prev.map((f) =>
                  f.file === file
                    ? {
                        ...f,
                        status: "completed",
                        document: updatedDoc,
                        processingStage: "completed",
                        processingProgress: meta?.processing_progress,
                      }
                    : f,
                ),
              );
            } else if (updatedDoc.status === "FAILED") {
              clearInterval(pollInterval);
              setUploadingFiles((prev) =>
                prev.map((f) =>
                  f.file === file
                    ? {
                        ...f,
                        status: "error",
                        error:
                          updatedDoc.error_message || "Processing failed",
                      }
                    : f,
                ),
              );
            } else if (
              updatedDoc.status === "PROCESSING" &&
              meta?.processing_stage
            ) {
              setUploadingFiles((prev) =>
                prev.map((f) =>
                  f.file === file
                    ? {
                        ...f,
                        document: updatedDoc,
                        processingStage: meta.processing_stage,
                        processingProgress: meta.processing_progress,
                      }
                    : f,
                ),
              );
            }
          } catch {
            // Ignore polling errors.
          }
        }, 1500);

        setTimeout(() => clearInterval(pollInterval), 300000);
      } catch (err) {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.file === file
              ? {
                  ...f,
                  status: "error",
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : f,
          ),
        );
      }
    },
    [onPollStatus, onUpload, tagsInput],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => handleUpload(file));
    },
    [handleUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (file: File) => {
    setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-gray-500">
              [TAGS]
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500">
              Add comma-separated tags that should attach to every file in
              this upload batch. Tags become available in search filters.
            </p>
          </div>
          <div className="text-xs font-mono text-gray-400">
            Applies to all selected files
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-xs font-mono uppercase tracking-wide text-gray-600">
            Tags
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Comma-separated tags"
            className="w-full border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>
      </div>

      <div
        className={`relative border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-gray-900 bg-gray-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="text-sm font-mono text-gray-600">
          {isDragging ? "Drop files here" : "Drop files or click to upload"}
        </div>
        <div className="mt-1 text-xs font-mono text-gray-400">
          PDF, DOCX, TXT, MD, PNG, JPG, GIF, WEBP — max 50MB
        </div>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((item, index) => (
            <div
              key={`${item.file.name}-${index}`}
              className={`flex items-center justify-between p-3 border text-xs font-mono ${
                item.status === "error"
                  ? "bg-red-50 border-red-200"
                  : item.status === "completed"
                    ? "bg-green-50 border-green-200"
                    : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-gray-400">
                  [{FILE_TYPE_LABELS[item.file.type] || "FILE"}]
                </span>
                <span className="truncate text-gray-900">
                  {item.file.name}
                </span>
                <span className="text-gray-400 flex-shrink-0">
                  {formatFileSize(item.file.size)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {item.status === "uploading" && (
                  <span className="text-gray-500">Uploading...</span>
                )}
                {item.status === "processing" && (
                  <div className="text-right">
                    <span className="text-blue-600">
                      {item.processingStage
                        ? STAGE_LABELS[item.processingStage]
                        : "Processing..."}
                    </span>
                    {item.processingProgress?.summary && (
                      <div className="text-xs text-gray-500">
                        {item.processingProgress.summary}
                      </div>
                    )}
                    {item.processingProgress?.current !== undefined &&
                      item.processingProgress?.total !== undefined && (
                        <div className="text-xs text-gray-400">
                          {item.processingProgress.current}/
                          {item.processingProgress.total}
                        </div>
                      )}
                  </div>
                )}
                {item.status === "completed" && (
                  <div className="text-right">
                    <span className="text-green-600">Ready</span>
                    {item.processingProgress?.summary && (
                      <div className="text-xs text-gray-500">
                        {item.processingProgress.summary}
                      </div>
                    )}
                  </div>
                )}
                {item.status === "error" && (
                  <span className="text-red-600">{item.error}</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(item.file);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
