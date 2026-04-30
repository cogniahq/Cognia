import React, { useEffect, useMemo, useState } from "react"
import { workspaceService, type Workspace } from "@/services/workspace.service"
import { ChevronRight, FolderTree, Plus } from "lucide-react"

import { WorkspaceCreateDialog } from "./WorkspaceCreateDialog"

interface WorkspaceTreeProps {
  orgSlug: string
  selectedWorkspaceId?: string | null
  onSelect?: (workspaceId: string | null) => void
}

interface TreeNode {
  workspace: Workspace
  children: TreeNode[]
}

function buildTree(workspaces: Workspace[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  workspaces.forEach((w) => byId.set(w.id, { workspace: w, children: [] }))
  const roots: TreeNode[] = []
  workspaces.forEach((w) => {
    const node = byId.get(w.id)!
    if (w.parent_id && byId.has(w.parent_id)) {
      byId.get(w.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

const NodeRow: React.FC<{
  node: TreeNode
  depth: number
  selectedId?: string | null
  onSelect?: (id: string) => void
}> = ({ node, depth, selectedId, onSelect }) => {
  const [open, setOpen] = useState(true)
  const isSelected = selectedId === node.workspace.id

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 text-sm cursor-pointer hover:bg-gray-100 ${
          isSelected ? "bg-gray-200 font-semibold" : ""
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => onSelect?.(node.workspace.id)}
      >
        {node.children.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setOpen((v) => !v)
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform ${
                open ? "rotate-90" : ""
              }`}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <FolderTree className="w-3.5 h-3.5 text-gray-500" />
        <span className="truncate">{node.workspace.name}</span>
      </div>
      {open &&
        node.children.map((child) => (
          <NodeRow
            key={child.workspace.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  )
}

export const WorkspaceTree: React.FC<WorkspaceTreeProps> = ({
  orgSlug,
  selectedWorkspaceId,
  onSelect,
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await workspaceService.list(orgSlug)
      setWorkspaces(res.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug])

  const tree = useMemo(() => buildTree(workspaces), [workspaces])

  return (
    <aside className="w-56 border-r border-gray-200 bg-white flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">
          Workspaces
        </span>
        <button
          onClick={() => setCreateOpen(true)}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label="New workspace"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div
          className={`flex items-center gap-1 px-3 py-1 text-sm cursor-pointer hover:bg-gray-100 ${
            !selectedWorkspaceId ? "bg-gray-200 font-semibold" : ""
          }`}
          onClick={() => onSelect?.(null)}
        >
          <FolderTree className="w-3.5 h-3.5 text-gray-500" />
          All memories
        </div>

        {loading ? (
          <div className="px-3 py-2 text-xs text-gray-500">Loading...</div>
        ) : error ? (
          <div className="px-3 py-2 text-xs text-red-600">{error}</div>
        ) : tree.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-500 italic">
            No workspaces yet.
          </div>
        ) : (
          tree.map((node) => (
            <NodeRow
              key={node.workspace.id}
              node={node}
              depth={0}
              selectedId={selectedWorkspaceId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      <WorkspaceCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgSlug={orgSlug}
        onCreated={(w) => setWorkspaces((prev) => [...prev, w])}
      />
    </aside>
  )
}

export default WorkspaceTree
