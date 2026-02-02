import crypto from 'crypto'
import { getRedisClient } from '../../lib/redis.lib'
import { logger } from '../../utils/core/logger.util'
import type { SearchJobStatus, SearchJob } from '../../types/search.types'

export type { SearchJobStatus, SearchJob }

const JOB_PREFIX = 'search_job:'
const JOB_TTL = 15 * 60 // 15 minutes in seconds

export async function createSearchJob(): Promise<SearchJob> {
  const id = crypto.randomUUID()
  const job: SearchJob = {
    id,
    status: 'pending',
    created_at: new Date(),
    expires_at: Date.now() + JOB_TTL * 1000,
  }

  const client = getRedisClient()
  const key = `${JOB_PREFIX}${id}`

  try {
    await client.setex(key, JOB_TTL, JSON.stringify(job))
    logger.log('[search-job] created job', { jobId: id })
  } catch (err) {
    logger.error('Error creating search job in Redis:', err)
    throw err
  }

  return job
}

export async function setSearchJobResult(
  id: string,
  data: {
    answer?: string
    citations?: Array<{
      label: number
      memory_id: string
      title: string | null
      url: string | null
    }>
    results?: Array<{ memory_id: string; title: string | null; url: string | null; score: number }>
    status?: SearchJobStatus
  }
): Promise<void> {
  try {
    const client = getRedisClient()
    const key = `${JOB_PREFIX}${id}`
    const existing = await client.get(key)

    if (!existing) {
      logger.error('[search-job] job not found for update', { jobId: id })
      return
    }

    const job: SearchJob = JSON.parse(existing)
    job.status = data.status || job.status || 'completed'
    if (data.answer !== undefined) job.answer = data.answer
    if (data.citations !== undefined) job.citations = data.citations
    if (data.results !== undefined) job.results = data.results
    job.expires_at = Date.now() + JOB_TTL * 1000

    await client.setex(key, JOB_TTL, JSON.stringify(job))
    logger.log('[search-job] updated job', {
      jobId: id,
      status: job.status,
      hasAnswer: !!job.answer,
      citationCount: job.citations?.length,
    })
  } catch (error) {
    logger.error('[search-job] error updating job result', { jobId: id, error })
  }
}

export async function getSearchJob(id: string): Promise<SearchJob | null> {
  try {
    const client = getRedisClient()
    const key = `${JOB_PREFIX}${id}`
    const data = await client.get(key)

    if (!data) {
      return null
    }

    return JSON.parse(data) as SearchJob
  } catch (error) {
    logger.error('Error retrieving search job:', error)
    return null
  }
}
