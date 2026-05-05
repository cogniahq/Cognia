"use client"

import { useActionState, useState } from "react"
import {
  acceptInviteAction,
  createWorkspaceAction,
  type ActionError,
} from "@/lib/auth/actions"

type Mode = "create" | "join"

export function OnboardingForm() {
  const [mode, setMode] = useState<Mode>("create")
  const [createState, createFormAction, creating] = useActionState<
    ActionError | null,
    FormData
  >(createWorkspaceAction, null)
  const [joinState, joinFormAction, joining] = useActionState<
    ActionError | null,
    FormData
  >(acceptInviteAction, null)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={
            "text-left p-5 border bg-white/80 backdrop-blur transition-colors " +
            (mode === "create"
              ? "border-black ring-1 ring-black"
              : "border-gray-200 hover:border-gray-400")
          }
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 mb-2">
            Option 1
          </div>
          <div className="text-base font-medium text-gray-900 mb-1">
            Create a workspace
          </div>
          <div className="text-xs text-gray-600">
            You become the admin and can invite teammates later.
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={
            "text-left p-5 border bg-white/80 backdrop-blur transition-colors " +
            (mode === "join"
              ? "border-black ring-1 ring-black"
              : "border-gray-200 hover:border-gray-400")
          }
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 mb-2">
            Option 2
          </div>
          <div className="text-base font-medium text-gray-900 mb-1">
            I have an invite code
          </div>
          <div className="text-xs text-gray-600">
            Paste the token from your invite email or message.
          </div>
        </button>
      </div>

      <div className="mt-6 bg-white/80 backdrop-blur border border-gray-200 p-6">
        {mode === "create" ? (
          <form action={createFormAction} className="space-y-4">
            <div>
              <label
                htmlFor="workspace-name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Workspace name
              </label>
              <input
                id="workspace-name"
                name="name"
                type="text"
                required
                autoFocus
                className="block w-full px-4 py-3 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                placeholder="e.g. Acme Research"
                disabled={creating}
                maxLength={64}
              />
              <p className="mt-2 text-xs text-gray-500">
                You can rename it any time from workspace settings.
              </p>
            </div>

            {createState?.error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                {createState.error}
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full px-4 py-2.5 bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {creating ? "Creating workspace..." : "Create workspace"}
            </button>
          </form>
        ) : (
          <form action={joinFormAction} className="space-y-4">
            <div>
              <label
                htmlFor="invite-code"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Invite code
              </label>
              <input
                id="invite-code"
                name="code"
                type="text"
                required
                autoFocus
                className="block w-full px-4 py-3 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm font-mono"
                placeholder="paste-your-token-here"
                disabled={joining}
              />
              <p className="mt-2 text-xs text-gray-500">
                Find this in the invite email your workspace admin sent you.
              </p>
            </div>

            {joinState?.error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                {joinState.error}
              </div>
            )}

            <button
              type="submit"
              disabled={joining}
              className="w-full px-4 py-2.5 bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {joining ? "Joining workspace..." : "Accept invite"}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
