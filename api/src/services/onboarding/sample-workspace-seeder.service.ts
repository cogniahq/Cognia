import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'

interface SampleMemory {
  title: string
  url: string
  content: string
  topics: string[]
}

let cachedSamples: SampleMemory[] | null = null

function loadSamples(): SampleMemory[] {
  if (cachedSamples) return cachedSamples
  // Try the runtime location first (src or dist), then fall back to the src tree
  // so a tsc build that didn't copy the JSON still works in production.
  const candidates = [
    path.join(__dirname, '..', '..', 'data', 'sample-memories.json'),
    path.join(process.cwd(), 'src', 'data', 'sample-memories.json'),
    path.join(process.cwd(), 'dist', 'data', 'sample-memories.json'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8')
      cachedSamples = JSON.parse(raw) as SampleMemory[]
      return cachedSamples
    }
  }
  throw new Error(`sample-memories.json not found in: ${candidates.join(', ')}`)
}

export async function seedSampleWorkspace(userId: string): Promise<{ created: number }> {
  if (process.env.SEED_SAMPLE_DATA === 'false') return { created: 0 }
  const samples = loadSamples()
  let created = 0
  for (const s of samples) {
    try {
      await prisma.memory.create({
        data: {
          user_id: userId,
          source: 'demo',
          source_type: 'DEMO',
          title: s.title,
          url: s.url,
          content: s.content,
          memory_type: 'REFERENCE',
          confidence_score: 0.7,
          timestamp: BigInt(Date.now()),
          page_metadata: { topics: s.topics },
          importance_score: 0.5,
        },
      })
      created++
    } catch (err) {
      logger.warn('[seeder] failed to create demo memory', {
        userId,
        title: s.title,
        error: String(err),
      })
    }
  }
  logger.log('[seeder] seeded sample workspace', { userId, created })
  return { created }
}

export async function purgeDemoData(userId: string): Promise<{ deleted: number }> {
  const result = await prisma.memory.deleteMany({
    where: { user_id: userId, source_type: 'DEMO' },
  })
  await prisma.user.update({
    where: { id: userId },
    data: { demo_dismissed_at: new Date() },
  })
  return { deleted: result.count }
}
