import { Prisma, SourceType } from '@prisma/client'
import { prisma } from '../../lib/prisma.lib'
import {
  normalizeText,
  hashCanonical,
  normalizeUrl,
  calculateSimilarity,
  sanitizeContentForStorage,
} from '../../utils/text/text.util'
import {
  normalizeUnixTimestampSeconds,
  normalizeUnixTimestampSecondsNumber,
} from '../../utils/core/timestamp.util'
import { memoryScoringService } from './memory-scoring.service'
import { memoryStructureService } from './memory-structure.service'

type MetadataRecord = Record<string, unknown>

type BuildMetadataContext = {
  title?: string | null
  url?: string | null
  source?: string | null
  content?: string | null
}

type DuplicateMemory = Prisma.MemoryGetPayload<{
  select: {
    id: true
    title: true
    url: true
    timestamp: true
    created_at: true
    content: true
    source: true
    page_metadata: true
    canonical_text: true
    canonical_hash: true
    importance_score: true
    confidence_score: true
    access_count: true
    memory_type: true
  }
}>

type DuplicateCheckResult = {
  memory: DuplicateMemory
  reason: 'canonical' | 'url'
}

type CanonicalizationResult = {
  canonicalText: string
  canonicalHash: string
  normalizedUrl?: string
}

type MemoryCreatePayload = {
  userId: string
  title?: string | null
  url?: string | null
  source?: string | null
  content: string
  contentPreview?: string
  metadata?: MetadataRecord
  canonicalText: string
  canonicalHash: string
}

const DEFAULT_URL_DUPLICATE_LOOKBACK_MS = 60 * 60 * 1000
const EXTENSION_URL_DUPLICATE_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000
const DEFAULT_URL_DUPLICATE_SIMILARITY = 0.9
const EXTENSION_URL_DUPLICATE_SIMILARITY = 0.55
const DEFAULT_DUPLICATE_CANDIDATE_LIMIT = 50
const EXTENSION_DUPLICATE_CANDIDATE_LIMIT = 200

function normalizeDuplicateTitle(title?: string | null): string {
  return normalizeText(title || '')
}

function isExtensionCaptureSource(source?: string | null): boolean {
  return normalizeText(source || '') === 'extension'
}

export class MemoryIngestionService {
  canonicalizeContent(content: string, url?: string | null): CanonicalizationResult {
    const sanitizedContent = sanitizeContentForStorage(content)
    const canonicalText = normalizeText(sanitizedContent)
    const canonicalHash = hashCanonical(canonicalText)
    const normalizedUrl = url ? normalizeUrl(url) : undefined
    return { canonicalText, canonicalHash, normalizedUrl }
  }

  async findDuplicateMemory(params: {
    userId: string
    canonicalHash: string
    canonicalText: string
    url?: string | null
    title?: string | null
    source?: string | null
  }): Promise<DuplicateCheckResult | null> {
    const { userId, canonicalHash, canonicalText, url, title, source } = params

    const existingByCanonical = await prisma.memory.findFirst({
      where: { user_id: userId, canonical_hash: canonicalHash },
      select: {
        id: true,
        title: true,
        url: true,
        timestamp: true,
        created_at: true,
        content: true,
        source: true,
        page_metadata: true,
        canonical_text: true,
        canonical_hash: true,
        importance_score: true,
        confidence_score: true,
        access_count: true,
        memory_type: true,
      },
    })

    if (existingByCanonical) {
      return { memory: existingByCanonical, reason: 'canonical' }
    }

    if (!url || url === 'unknown') {
      return null
    }

    const normalizedUrl = normalizeUrl(url)
    const isExtensionCapture = isExtensionCaptureSource(source)
    const lookbackStart = new Date(
      Date.now() -
        (isExtensionCapture
          ? EXTENSION_URL_DUPLICATE_LOOKBACK_MS
          : DEFAULT_URL_DUPLICATE_LOOKBACK_MS)
    )
    const normalizedTitle = normalizeDuplicateTitle(title)
    const recentMemories = await prisma.memory.findMany({
      where: {
        user_id: userId,
        created_at: { gte: lookbackStart },
        ...(isExtensionCapture ? { source: 'extension' } : {}),
      },
      select: {
        id: true,
        title: true,
        url: true,
        timestamp: true,
        created_at: true,
        content: true,
        source: true,
        page_metadata: true,
        canonical_text: true,
        canonical_hash: true,
        importance_score: true,
        confidence_score: true,
        access_count: true,
        memory_type: true,
      },
      orderBy: { created_at: 'desc' },
      take: isExtensionCapture
        ? EXTENSION_DUPLICATE_CANDIDATE_LIMIT
        : DEFAULT_DUPLICATE_CANDIDATE_LIMIT,
    })

    for (const existing of recentMemories) {
      if (!existing.url) continue
      if (normalizeUrl(existing.url) !== normalizedUrl) continue
      const similarity = calculateSimilarity(
        canonicalText,
        normalizeText(existing.content || existing.canonical_text || '')
      )
      const titlesMatch =
        normalizedTitle !== '' && normalizeDuplicateTitle(existing.title) === normalizedTitle
      const requiredSimilarity =
        isExtensionCapture && titlesMatch && isExtensionCaptureSource(existing.source)
          ? EXTENSION_URL_DUPLICATE_SIMILARITY
          : DEFAULT_URL_DUPLICATE_SIMILARITY

      if (similarity >= requiredSimilarity) {
        return { memory: existing, reason: 'url' }
      }
    }

    return null
  }

  async mergeDuplicateMemory(
    duplicate: DuplicateMemory,
    metadata: MetadataRecord | undefined,
    context?: BuildMetadataContext
  ): Promise<DuplicateMemory> {
    const mergedMetadata = memoryScoringService.mergeMetadata(
      duplicate.page_metadata,
      this.buildPageMetadata(metadata, context)
    )

    const boostedImportance = Math.min(1, (duplicate.importance_score ?? 0.35) + 0.05)
    const boostedConfidence = Math.min(1, (duplicate.confidence_score ?? 0.5) + 0.03)

    const updated = await prisma.memory.update({
      where: { id: duplicate.id },
      data: {
        access_count: { increment: 1 },
        last_accessed: new Date(),
        importance_score: boostedImportance,
        confidence_score: boostedConfidence,
        page_metadata: mergedMetadata,
      },
      select: {
        id: true,
        title: true,
        url: true,
        timestamp: true,
        created_at: true,
        content: true,
        source: true,
        page_metadata: true,
        canonical_text: true,
        canonical_hash: true,
        importance_score: true,
        confidence_score: true,
        access_count: true,
        memory_type: true,
      },
    })

    return updated
  }

  buildPageMetadata(metadata?: MetadataRecord, context?: BuildMetadataContext): MetadataRecord {
    const flattenedMetadata = {
      ...((metadata?.page_metadata as MetadataRecord | undefined) || {}),
      ...(metadata || {}),
    }
    delete flattenedMetadata.page_metadata

    if (!context?.content) {
      return flattenedMetadata
    }

    const structured = memoryStructureService.extract({
      title:
        context.title ||
        (typeof flattenedMetadata.title === 'string' ? flattenedMetadata.title : undefined),
      url:
        context.url ||
        (typeof flattenedMetadata.url === 'string' ? flattenedMetadata.url : undefined),
      source:
        context.source ||
        (typeof flattenedMetadata.source === 'string' ? flattenedMetadata.source : undefined),
      content: context.content,
      metadata: flattenedMetadata,
    })

    return {
      ...flattenedMetadata,
      content_type: structured.contentType,
      structuredSummary: structured.structuredSummary,
      representativeExcerpt: structured.representativeExcerpt,
      keyFacts: structured.keyFacts,
      topics: structured.topics,
      categories: structured.categories,
      searchableTerms: structured.searchableTerms,
      extractedEntities: structured.extractedEntities,
      retrievalText: structured.retrievalText,
      ingestionVersion: structured.ingestionVersion,
      ...(structured.commerce ? { commerce: structured.commerce } : {}),
    }
  }

  buildMemoryCreatePayload(payload: MemoryCreatePayload): Prisma.MemoryCreateInput {
    const metadata = payload.metadata || {}
    const metadataTimestamp = (metadata as { timestamp?: unknown }).timestamp
    const sanitizedContent = sanitizeContentForStorage(payload.content)
    const url =
      payload.url ||
      (typeof metadata.url === 'string' && metadata.url.trim() !== ''
        ? metadata.url.trim()
        : 'unknown')
    const title =
      payload.title ||
      (typeof metadata.title === 'string' && metadata.title.trim() !== ''
        ? metadata.title.trim()
        : 'Untitled')

    // Determine source_type from metadata or infer from source
    const sourceValue = (metadata.source as string | undefined) || payload.source || 'extension'
    const pageMetadata = this.buildPageMetadata(metadata, {
      title,
      url,
      source: sourceValue,
      content: sanitizedContent,
    })
    if (metadataTimestamp !== undefined) {
      pageMetadata.timestamp = normalizeUnixTimestampSecondsNumber(metadataTimestamp)
    }
    const topics = Array.isArray(pageMetadata.topics)
      ? pageMetadata.topics.filter((topic): topic is string => typeof topic === 'string')
      : []
    const categories = Array.isArray(pageMetadata.categories)
      ? pageMetadata.categories.filter(
          (category): category is string => typeof category === 'string'
        )
      : []

    const memoryType = memoryScoringService.inferMemoryType({
      explicitType: pageMetadata.memory_type as string | undefined,
      metadata: pageMetadata,
      title,
      contentPreview:
        (typeof pageMetadata.structuredSummary === 'string'
          ? pageMetadata.structuredSummary
          : undefined) || payload.contentPreview,
    })

    const pageImportance =
      typeof (pageMetadata as { importance?: unknown }).importance === 'number'
        ? ((pageMetadata as { importance?: number }).importance as number)
        : undefined

    const importanceScore = memoryScoringService.calculateImportanceScore({
      memoryType,
      contentLength: sanitizedContent.length,
      topics,
      categories,
      metadata: pageMetadata,
      extractedImportance: pageImportance,
    })

    const confidenceScore = memoryScoringService.calculateConfidenceScore({
      memoryType,
      contentLength: sanitizedContent.length,
      topics,
      categories,
      metadata: pageMetadata,
      extractedImportance: pageImportance,
      importanceScore,
    })
    let sourceType: SourceType = SourceType.EXTENSION
    if (metadata.source_type) {
      sourceType = metadata.source_type as SourceType
    } else if (['google_drive', 'slack', 'notion', 'github'].includes(sourceValue)) {
      sourceType = SourceType.INTEGRATION
    }

    // Get organization_id from metadata if provided
    const organizationId = metadata.organization_id as string | undefined

    const result: Prisma.MemoryCreateInput = {
      user: { connect: { id: payload.userId } },
      source: sourceValue,
      source_type: sourceType,
      url,
      title,
      content: sanitizedContent,
      canonical_text: payload.canonicalText,
      canonical_hash: payload.canonicalHash,
      timestamp: normalizeUnixTimestampSeconds(metadataTimestamp),
      full_content: sanitizedContent,
      page_metadata: pageMetadata as Prisma.InputJsonValue,
      importance_score: importanceScore,
      confidence_score: confidenceScore,
      memory_type: memoryType,
    }

    // Add organization connection if provided
    if (organizationId) {
      result.organization = { connect: { id: organizationId } }
    }

    return result
  }
}

export const memoryIngestionService = new MemoryIngestionService()
