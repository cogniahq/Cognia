import fetch from 'node-fetch'
import { logger } from '../../utils/core/logger.util'

export interface RerankInput {
  id: string
  text: string
}

export interface RerankResult {
  id: string
  score: number
}

interface RerankRequest {
  query: string
  documents: RerankInput[]
  topN: number
}

const COHERE_RERANK_MODEL = process.env.COHERE_RERANK_MODEL || 'rerank-v3.5'
const VOYAGE_RERANK_MODEL = process.env.VOYAGE_RERANK_MODEL || 'rerank-2'
const JINA_RERANK_MODEL = process.env.JINA_RERANK_MODEL || 'jina-reranker-v2-base-multilingual'
const RERANK_TIMEOUT_MS = Number(process.env.RERANK_TIMEOUT_MS) || 15000

interface CohereRerankResponse {
  results?: Array<{ index: number; relevance_score: number }>
}

interface VoyageRerankResponse {
  data?: Array<{ index: number; relevance_score: number }>
}

interface JinaRerankResponse {
  results?: Array<{ index: number; relevance_score: number }>
}

async function fetchWithTimeout(
  url: string,
  init: Parameters<typeof fetch>[1],
  timeoutMs: number
): Promise<Awaited<ReturnType<typeof fetch>>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function rerankCohere(req: RerankRequest, apiKey: string): Promise<RerankResult[]> {
  const res = await fetchWithTimeout(
    'https://api.cohere.com/v2/rerank',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: COHERE_RERANK_MODEL,
        query: req.query,
        documents: req.documents.map(doc => doc.text),
        top_n: Math.min(req.topN, req.documents.length),
      }),
    },
    RERANK_TIMEOUT_MS
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Cohere rerank failed: ${res.status} ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as CohereRerankResponse
  const results = data.results || []
  return results.map(r => ({
    id: req.documents[r.index].id,
    score: r.relevance_score,
  }))
}

async function rerankVoyage(req: RerankRequest, apiKey: string): Promise<RerankResult[]> {
  const res = await fetchWithTimeout(
    'https://api.voyageai.com/v1/rerank',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VOYAGE_RERANK_MODEL,
        query: req.query,
        documents: req.documents.map(doc => doc.text),
        top_k: Math.min(req.topN, req.documents.length),
      }),
    },
    RERANK_TIMEOUT_MS
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Voyage rerank failed: ${res.status} ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as VoyageRerankResponse
  const results = data.data || []
  return results.map(r => ({
    id: req.documents[r.index].id,
    score: r.relevance_score,
  }))
}

async function rerankJina(req: RerankRequest, apiKey: string): Promise<RerankResult[]> {
  const res = await fetchWithTimeout(
    'https://api.jina.ai/v1/rerank',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: JINA_RERANK_MODEL,
        query: req.query,
        documents: req.documents.map(doc => doc.text),
        top_n: Math.min(req.topN, req.documents.length),
      }),
    },
    RERANK_TIMEOUT_MS
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Jina rerank failed: ${res.status} ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as JinaRerankResponse
  const results = data.results || []
  return results.map(r => ({
    id: req.documents[r.index].id,
    score: r.relevance_score,
  }))
}

/**
 * Pass-through ranker. Used as last-resort fallback when no cross-encoder
 * provider is configured. Preserves the input order (already sorted by RRF).
 */
function passThroughRerank(req: RerankRequest): RerankResult[] {
  return req.documents.slice(0, req.topN).map((doc, idx) => ({
    id: doc.id,
    // Convert input rank → descending score for callers that sort by score.
    score: 1 / (idx + 1),
  }))
}

type Provider = 'cohere' | 'voyage' | 'jina' | 'passthrough'

function activeProviderOrder(): Provider[] {
  const explicit = (process.env.RERANK_PROVIDER || '').toLowerCase().trim()
  if (explicit === 'cohere' && process.env.COHERE_API_KEY) return ['cohere', 'passthrough']
  if (explicit === 'voyage' && process.env.VOYAGE_API_KEY) return ['voyage', 'passthrough']
  if (explicit === 'jina' && process.env.JINA_API_KEY) return ['jina', 'passthrough']
  if (explicit === 'passthrough' || explicit === 'none') return ['passthrough']

  const order: Provider[] = []
  if (process.env.COHERE_API_KEY) order.push('cohere')
  if (process.env.VOYAGE_API_KEY) order.push('voyage')
  if (process.env.JINA_API_KEY) order.push('jina')
  order.push('passthrough')
  return order
}

class RerankProvider {
  async rerank(request: RerankRequest): Promise<RerankResult[]> {
    if (request.documents.length === 0) return []
    if (request.documents.length === 1) {
      return [{ id: request.documents[0].id, score: 1 }]
    }

    const providers = activeProviderOrder()

    for (const provider of providers) {
      try {
        if (provider === 'cohere') {
          return await rerankCohere(request, process.env.COHERE_API_KEY!)
        }
        if (provider === 'voyage') {
          return await rerankVoyage(request, process.env.VOYAGE_API_KEY!)
        }
        if (provider === 'jina') {
          return await rerankJina(request, process.env.JINA_API_KEY!)
        }
        return passThroughRerank(request)
      } catch (error) {
        logger.warn(`[rerank] ${provider} provider failed, falling back`, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return passThroughRerank(request)
  }
}

export const rerankProvider = new RerankProvider()
