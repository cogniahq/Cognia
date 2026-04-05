import { createHash } from 'node:crypto'
import type { ResourceContent } from '@cogniahq/integrations'

import { logger } from '../../utils/core/logger.util'
import { textExtractionService, type ExtractedText } from '../document/text-extraction.service'

const PLACEHOLDER_PREFIXES = ['[Unsupported', '[Binary']

export interface IntegrationTextExtractor {
  extractText(buffer: Buffer, mimeType: string, filename: string): Promise<ExtractedText>
}

export interface PreparedIntegrationContent {
  content: ResourceContent
  shouldSkip: boolean
}

function isPlaceholderContent(content: string): boolean {
  return PLACEHOLDER_PREFIXES.some(prefix => content.startsWith(prefix))
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export async function prepareIntegrationContentForSync(
  content: ResourceContent,
  extractor: IntegrationTextExtractor = textExtractionService
): Promise<PreparedIntegrationContent> {
  if (!isPlaceholderContent(content.content)) {
    return { content, shouldSkip: false }
  }

  if (!content.rawContent || !content.mimeType) {
    return { content, shouldSkip: true }
  }

  try {
    const extracted = await extractor.extractText(
      content.rawContent,
      content.mimeType,
      content.title
    )
    const normalizedText = extracted.text.trim()

    if (!normalizedText) {
      logger.warn('[integration] extracted binary content was empty', {
        title: content.title,
        mimeType: content.mimeType,
      })
      return { content, shouldSkip: true }
    }

    return {
      shouldSkip: false,
      content: {
        ...content,
        content: normalizedText,
        contentHash: hashContent(normalizedText),
        metadata: {
          ...content.metadata,
          extractedFromBinary: true,
          extractedMimeType: content.mimeType,
          extractedPageCount: extracted.pageCount,
          extractionMetadata: extracted.metadata,
        },
      },
    }
  } catch (error) {
    logger.warn('[integration] failed to extract binary content', {
      title: content.title,
      mimeType: content.mimeType,
      error: error instanceof Error ? error.message : String(error),
    })
    return { content, shouldSkip: true }
  }
}
