"use client"

import React, { useState } from "react"

/**
 * "Notify me when subprocessors change" form. Client island because the
 * submit is purely client-state — there's no API endpoint behind this in
 * Phase 1. We surface success/error inline (the Vite version used a
 * sonner toast, but we don't want sonner on a server-rendered legal page
 * just for one form). Phase 6 wires it to a real Resend audience.
 */
export const SubprocessorSubscribeForm: React.FC = () => {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.")
      return
    }
    setSubmitted(true)
    setEmail("")
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-2 max-w-lg not-prose"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          aria-label="Email address"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <button
          type="submit"
          disabled={submitted}
          className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {submitted ? "Subscribed" : "Subscribe"}
        </button>
      </form>
      {submitted && (
        <p className="text-sm text-emerald-700 mt-3">
          Thanks — we will notify you when our subprocessor list changes.
        </p>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </>
  )
}
