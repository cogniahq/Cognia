import { useCallback, useEffect, useState } from "react"
import { orgAdminService, type AdminMember } from "@/services/org-admin.service"
import { Loader2, MoreHorizontal } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Can } from "@/components/auth/Can"

import OffboardDialog from "./OffboardDialog"

interface MembersTabProps {
  slug: string
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

export default function MembersTab({ slug }: MembersTabProps) {
  const [members, setMembers] = useState<AdminMember[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offboardTarget, setOffboardTarget] = useState<AdminMember | null>(null)
  const [hardDeleteDefault, setHardDeleteDefault] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await orgAdminService.getMembers(slug)
      setMembers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members")
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  const openOffboard = (member: AdminMember, hard: boolean) => {
    setHardDeleteDefault(hard)
    setOffboardTarget(member)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-gray-600 uppercase tracking-wide">
          [MEMBERS] — {members.length} total
        </div>
        <button
          onClick={load}
          disabled={isLoading}
          className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors rounded-md disabled:opacity-50"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 border border-red-200 rounded-xl bg-red-50 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {isLoading && members.length === 0 ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500">Loading members...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm font-mono text-gray-500">
            No members found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5 font-mono">Email</th>
                  <th className="text-left px-4 py-2.5 font-mono">Role</th>
                  <th className="text-left px-4 py-2.5 font-mono">2FA</th>
                  <th className="text-left px-4 py-2.5 font-mono">Joined</th>
                  <th className="text-left px-4 py-2.5 font-mono">Status</th>
                  <th className="text-right px-4 py-2.5 font-mono">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((member) => {
                  const isDeactivated = !!member.deactivated_at
                  const has2FA = !!member.user?.two_factor_enabled
                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-900">
                        {member.user?.email || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-700">
                        {member.role}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono ${
                            has2FA
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-gray-200 bg-gray-50 text-gray-500"
                          }`}
                        >
                          {has2FA ? "Enabled" : "Off"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-600 whitespace-nowrap">
                        {formatDate(member.joined_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono ${
                            isDeactivated
                              ? "border-gray-300 bg-gray-100 text-gray-600"
                              : "border-green-200 bg-green-50 text-green-700"
                          }`}
                        >
                          {isDeactivated ? "Deactivated" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Can
                          permission="member.remove"
                          fallback={
                            <span
                              className="text-[10px] font-mono text-gray-400"
                              aria-label="No permission to manage member"
                            >
                              —
                            </span>
                          }
                        >
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="inline-flex items-center justify-center w-7 h-7 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                aria-label="Open menu"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                disabled={isDeactivated}
                                onSelect={() => openOffboard(member, false)}
                              >
                                Deactivate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-700"
                                onSelect={() => openOffboard(member, true)}
                              >
                                Remove permanently
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Can>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <OffboardDialog
        slug={slug}
        members={members}
        member={offboardTarget}
        open={!!offboardTarget}
        defaultHardDelete={hardDeleteDefault}
        onClose={() => setOffboardTarget(null)}
        onCompleted={load}
        key={`${offboardTarget?.id ?? "none"}-${hardDeleteDefault ? "hard" : "soft"}`}
      />
    </div>
  )
}
