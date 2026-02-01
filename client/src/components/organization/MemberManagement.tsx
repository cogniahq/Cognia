import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useOrganization } from "@/contexts/organization.context"
import type { OrgRole } from "@/types/organization"

const ROLE_LABELS: Record<OrgRole, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
}

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  ADMIN: "Full access, can manage members and settings",
  EDITOR: "Can upload and edit documents",
  VIEWER: "Can view and search documents",
}

export function MemberManagement() {
  const {
    members,
    loadMembers,
    inviteMember,
    updateMemberRole,
    removeMember,
    currentOrganization,
  } = useOrganization()

  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<OrgRole>("VIEWER")
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState("")

  const [editMemberId, setEditMemberId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<OrgRole>("VIEWER")
  const [isUpdating, setIsUpdating] = useState(false)

  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    if (currentOrganization) {
      loadMembers()
    }
  }, [currentOrganization, loadMembers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) {
      setInviteError("Email is required")
      return
    }

    setIsInviting(true)
    setInviteError("")

    try {
      await inviteMember(inviteEmail.trim(), inviteRole)
      setInviteEmail("")
      setInviteRole("VIEWER")
      setShowInviteDialog(false)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite")
    } finally {
      setIsInviting(false)
    }
  }

  const handleUpdateRole = async () => {
    if (!editMemberId) return
    setIsUpdating(true)
    try {
      await updateMemberRole(editMemberId, editRole)
      setEditMemberId(null)
    } catch (err) {
      console.error("Failed to update role:", err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemove = async () => {
    if (!removeMemberId) return
    setIsRemoving(true)
    try {
      await removeMember(removeMemberId)
      setRemoveMemberId(null)
    } catch (err) {
      console.error("Failed to remove member:", err)
    } finally {
      setIsRemoving(false)
    }
  }

  const isAdmin = currentOrganization?.userRole === "ADMIN"

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-mono text-gray-600 uppercase tracking-wide">
            [TEAM MEMBERS] — {members.length} member{members.length !== 1 && "s"}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowInviteDialog(true)}
              className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors"
            >
              + Invite
            </button>
          )}
        </div>

        {/* Member list */}
        {members.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-sm font-mono text-gray-500">
              No team members yet
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Invite people to collaborate
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 divide-y divide-gray-100">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-200 flex items-center justify-center text-xs font-mono text-gray-600">
                    {(member.user?.email || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm text-gray-900">
                      {member.user?.email || "Unknown"}
                    </div>
                    <div className="text-xs font-mono text-gray-500">
                      {ROLE_LABELS[member.role]}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditMemberId(member.id)
                        setEditRole(member.role)
                      }}
                      className="text-xs font-mono text-gray-400 hover:text-gray-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setRemoveMemberId(member.id)}
                      className="text-xs font-mono text-gray-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md rounded-none">
          <DialogHeader>
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
              [INVITE MEMBER]
            </div>
            <DialogTitle className="text-lg font-bold">
              Invite Team Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-xs font-mono text-gray-600 uppercase tracking-wide mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value)
                    setInviteError("")
                  }}
                  disabled={isInviting}
                  className="w-full px-3 py-2 border border-gray-300 text-sm font-mono focus:outline-none focus:border-gray-900 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-600 uppercase tracking-wide mb-2">
                  Role
                </label>
                <div className="space-y-2">
                  {(["ADMIN", "EDITOR", "VIEWER"] as OrgRole[]).map((role) => (
                    <label
                      key={role}
                      className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                        inviteRole === role
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={inviteRole === role}
                        onChange={() => setInviteRole(role)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {ROLE_LABELS[role]}
                        </div>
                        <div className="text-xs text-gray-500">
                          {ROLE_DESCRIPTIONS[role]}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {inviteError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 text-xs font-mono text-red-600">
                  {inviteError}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <button
                type="button"
                onClick={() => setShowInviteDialog(false)}
                disabled={isInviting}
                className="px-4 py-2 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isInviting}
                className="px-4 py-2 text-xs font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isInviting ? "Inviting..." : "Send Invite"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editMemberId} onOpenChange={() => setEditMemberId(null)}>
        <DialogContent className="sm:max-w-md rounded-none">
          <DialogHeader>
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
              [CHANGE ROLE]
            </div>
            <DialogTitle className="text-lg font-bold">
              Update Member Role
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {(["ADMIN", "EDITOR", "VIEWER"] as OrgRole[]).map((role) => (
              <label
                key={role}
                className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                  editRole === role
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="editRole"
                  value={role}
                  checked={editRole === role}
                  onChange={() => setEditRole(role)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {ROLE_LABELS[role]}
                  </div>
                  <div className="text-xs text-gray-500">
                    {ROLE_DESCRIPTIONS[role]}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setEditMemberId(null)}
              className="px-4 py-2 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateRole}
              disabled={isUpdating}
              className="px-4 py-2 text-xs font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirm */}
      <ConfirmDialog
        isOpen={!!removeMemberId}
        onCancel={() => setRemoveMemberId(null)}
        title="Remove Member"
        message="Are you sure you want to remove this member? They will lose access to all documents."
        confirmLabel={isRemoving ? "Removing..." : "Remove"}
        onConfirm={handleRemove}
      />
    </>
  )
}
