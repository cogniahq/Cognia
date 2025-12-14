import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ApiKeyInfo, type CreateApiKeyRequest } from "@/services/api-key.service"

interface ApiKeyFormProps {
  onSubmit: (data: CreateApiKeyRequest) => Promise<void>
  onCancel: () => void
  initialData: ApiKeyInfo | null
}

export const ApiKeyForm: React.FC<ApiKeyFormProps> = ({ onSubmit, onCancel, initialData }) => {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [rateLimit, setRateLimit] = useState("")
  const [rateLimitWindow, setRateLimitWindow] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (initialData) {
      setName(initialData.name)
      setDescription(initialData.description || "")
      setRateLimit(initialData.rateLimit?.toString() || "")
      setRateLimitWindow(initialData.rateLimitWindow?.toString() || "")
      if (initialData.expiresAt) {
        const date = new Date(initialData.expiresAt)
        setExpiresAt(date.toISOString().slice(0, 16))
      } else {
        setExpiresAt("")
      }
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const data: CreateApiKeyRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        rateLimit: rateLimit ? Number(rateLimit) : undefined,
        rateLimitWindow: rateLimitWindow ? Number(rateLimitWindow) : undefined,
        expiresAt: expiresAt || undefined,
      }
      await onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded-md"
          placeholder="My API Key"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
          rows={3}
          placeholder="Optional description for this API key"
        />
      </div>


      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="rateLimit" className="block text-sm font-medium mb-1">
            Rate Limit (requests)
          </label>
          <input
            id="rateLimit"
            type="number"
            value={rateLimit}
            onChange={e => setRateLimit(e.target.value)}
            min="1"
            className="w-full px-3 py-2 border rounded-md"
            placeholder="e.g., 1000"
          />
        </div>
        <div>
          <label htmlFor="rateLimitWindow" className="block text-sm font-medium mb-1">
            Rate Limit Window (seconds)
          </label>
          <input
            id="rateLimitWindow"
            type="number"
            value={rateLimitWindow}
            onChange={e => setRateLimitWindow(e.target.value)}
            min="1"
            className="w-full px-3 py-2 border rounded-md"
            placeholder="e.g., 3600"
          />
        </div>
      </div>

      <div>
        <label htmlFor="expiresAt" className="block text-sm font-medium mb-1">
          Expiration Date
        </label>
        <input
          id="expiresAt"
          type="datetime-local"
          value={expiresAt}
          onChange={e => setExpiresAt(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? "Saving..." : initialData ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  )
}

