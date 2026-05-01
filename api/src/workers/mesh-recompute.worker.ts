import { Worker } from 'bullmq'
import { MESH_QUEUE_NAME, type MeshRecomputeJobData } from '../lib/mesh-queue.lib'
import { meshSnapshotService } from '../services/memory/mesh-snapshot.service'
import { getRedisConnection } from '../utils/core/env.util'
import { logger } from '../utils/core/logger.util'

export const startMeshRecomputeWorker = () =>
  new Worker<MeshRecomputeJobData>(
    MESH_QUEUE_NAME,
    async job => {
      const { scopeType, scopeId } = job.data
      logger.log('[mesh-recompute-worker] starting', { jobId: job.id, scopeType, scopeId })

      const result = await meshSnapshotService.recompute({ scopeType, scopeId })

      logger.log('[mesh-recompute-worker] completed', {
        jobId: job.id,
        scopeType,
        scopeId,
        ...result,
      })
      return result
    },
    {
      connection: getRedisConnection(true),
      concurrency: 1,
      lockDuration: 30 * 60_000,
      lockRenewTime: 60_000,
    }
  )
