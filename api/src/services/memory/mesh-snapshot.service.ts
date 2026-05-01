import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import { memoryMeshService } from './memory-mesh.service'

export interface MeshSnapshotPayload {
  nodes: unknown[]
  edges: unknown[]
}

export type MeshScope =
  | { scopeType: 'user'; scopeId: string }
  | { scopeType: 'organization'; scopeId: string }

class MeshSnapshotService {
  /**
   * Recompute the mesh for the given scope and persist it as the canonical
   * snapshot. Called from the BullMQ recurring job (nightly) and on-demand
   * after very large ingests.
   */
  async recompute(scope: MeshScope): Promise<{ nodeCount: number; edgeCount: number }> {
    const startedAt = Date.now()
    let payload: MeshSnapshotPayload

    if (scope.scopeType === 'user') {
      const mesh = await memoryMeshService.getMemoryMesh(scope.scopeId)
      payload = mesh as unknown as MeshSnapshotPayload
    } else {
      const memoryIds = await prisma.memory
        .findMany({
          where: { organization_id: scope.scopeId, deleted_at: null },
          select: { id: true },
          take: 5000,
        })
        .then(rows => rows.map(row => row.id))

      const mesh = await memoryMeshService.getMemoryMeshForMemoryIds(memoryIds, Infinity, 0.4, {
        organizationId: scope.scopeId,
      })
      payload = mesh as unknown as MeshSnapshotPayload
    }

    const nodeCount = payload.nodes.length
    const edgeCount = payload.edges.length

    await prisma.meshSnapshot.upsert({
      where: {
        scope_type_scope_id: {
          scope_type: scope.scopeType,
          scope_id: scope.scopeId,
        },
      },
      create: {
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        node_count: nodeCount,
        edge_count: edgeCount,
        payload: payload as object,
      },
      update: {
        node_count: nodeCount,
        edge_count: edgeCount,
        payload: payload as object,
        computed_at: new Date(),
      },
    })

    logger.log('[mesh-snapshot] recomputed', {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      nodeCount,
      edgeCount,
      elapsedMs: Date.now() - startedAt,
    })

    return { nodeCount, edgeCount }
  }

  async read(scope: MeshScope): Promise<{
    payload: MeshSnapshotPayload
    nodeCount: number
    edgeCount: number
    computedAt: Date
  } | null> {
    const row = await prisma.meshSnapshot.findUnique({
      where: {
        scope_type_scope_id: {
          scope_type: scope.scopeType,
          scope_id: scope.scopeId,
        },
      },
    })
    if (!row) return null
    return {
      payload: row.payload as unknown as MeshSnapshotPayload,
      nodeCount: row.node_count,
      edgeCount: row.edge_count,
      computedAt: row.computed_at,
    }
  }
}

export const meshSnapshotService = new MeshSnapshotService()
