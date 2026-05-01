/**
 * Backfill the new hybrid (dense + sparse) Qdrant index from Postgres.
 *
 * Usage:
 *   # Re-embed all memories
 *   npm exec ts-node src/scripts/backfill-search-index.script.ts
 *
 *   # Re-embed only one organization
 *   npm exec ts-node src/scripts/backfill-search-index.script.ts -- --org=<uuid>
 *
 *   # Reindex from a specific cursor (resume after a crash)
 *   npm exec ts-node src/scripts/backfill-search-index.script.ts -- --cursor=<memoryId>
 *
 * Idempotent: each memory's existing Qdrant points (matching memory_id) are
 * deleted before the new dense+sparse point is upserted.
 */
import { prisma } from '../lib/prisma.lib'
import { ensureCollection, deleteMemoryPoints } from '../lib/qdrant.lib'
import { memoryMeshService } from '../services/memory/memory-mesh.service'
import { logger } from '../utils/core/logger.util'

const BATCH_SIZE = Number(process.env.BACKFILL_BATCH_SIZE) || 64

interface Args {
  organizationId?: string
  cursor?: string
  dryRun?: boolean
}

function parseArgs(): Args {
  const out: Args = {}
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--org=')) out.organizationId = arg.slice('--org='.length)
    else if (arg.startsWith('--cursor=')) out.cursor = arg.slice('--cursor='.length)
    else if (arg === '--dry-run') out.dryRun = true
  }
  return out
}

async function main(): Promise<void> {
  const args = parseArgs()
  await ensureCollection()

  let processed = 0
  let cursor = args.cursor

  for (;;) {
    const memories = await prisma.memory.findMany({
      where: {
        deleted_at: null,
        ...(args.organizationId ? { organization_id: args.organizationId } : {}),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      select: { id: true },
      take: BATCH_SIZE,
    })

    if (memories.length === 0) break

    const memoryIds = memories.map(m => m.id)

    if (args.dryRun) {
      logger.log('[backfill] dry-run batch', { count: memoryIds.length, cursor })
    } else {
      await deleteMemoryPoints(memoryIds)
      try {
        await memoryMeshService.generateEmbeddingsForMemoriesBatch(memoryIds)
      } catch (error) {
        logger.error('[backfill] batch failed; resume with --cursor=' + memoryIds[0], {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    }

    processed += memoryIds.length
    cursor = memoryIds[memoryIds.length - 1]
    logger.log('[backfill] progress', { processed, lastId: cursor })
  }

  logger.log('[backfill] complete', { processed })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    logger.error('[backfill] fatal', {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exit(1)
  })
