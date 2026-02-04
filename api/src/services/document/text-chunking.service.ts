import { logger } from '../../utils/core/logger.util'

export interface TextChunk {
  content: string
  chunkIndex: number
  pageNumber?: number
  charStart: number
  charEnd: number
}

export interface ChunkingOptions {
  targetTokens?: number
  maxTokens?: number
  overlap?: number
}

const DEFAULT_TARGET_TOKENS = 500
const DEFAULT_MAX_TOKENS = 1000
const DEFAULT_OVERLAP = 50
const APPROX_CHARS_PER_TOKEN = 4

export class TextChunkingService {
  /**
   * Split text into semantic chunks
   * Tries to preserve paragraph/section boundaries
   */
  chunkText(text: string, options: ChunkingOptions = {}): TextChunk[] {
    const targetTokens = options.targetTokens || DEFAULT_TARGET_TOKENS
    const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS
    const overlap = options.overlap || DEFAULT_OVERLAP

    const targetChars = targetTokens * APPROX_CHARS_PER_TOKEN
    const maxChars = maxTokens * APPROX_CHARS_PER_TOKEN
    const overlapChars = overlap * APPROX_CHARS_PER_TOKEN

    // Split by paragraphs first (double newline)
    const paragraphs = text.split(/\n\s*\n/)
    const chunks: TextChunk[] = []
    let currentChunk = ''
    let chunkStart = 0
    let charPosition = 0

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim()
      if (!paragraph) {
        charPosition += 2 // Account for the double newline
        continue
      }

      const paragraphWithSeparator = currentChunk ? '\n\n' + paragraph : paragraph

      // If adding this paragraph would exceed max, finalize current chunk
      if (
        currentChunk.length + paragraphWithSeparator.length > maxChars &&
        currentChunk.length > 0
      ) {
        chunks.push({
          content: currentChunk.trim(),
          chunkIndex: chunks.length,
          charStart: chunkStart,
          charEnd: charPosition,
        })

        // Start new chunk with overlap from previous
        const overlapText = this.getOverlapText(currentChunk, overlapChars)
        currentChunk = overlapText + (overlapText ? '\n\n' : '') + paragraph
        chunkStart = charPosition - overlapText.length
      } else {
        currentChunk += paragraphWithSeparator
      }

      charPosition += paragraph.length + 2 // +2 for separator

      // If current chunk is at target size and there's more content, consider splitting
      if (currentChunk.length >= targetChars && i < paragraphs.length - 1) {
        chunks.push({
          content: currentChunk.trim(),
          chunkIndex: chunks.length,
          charStart: chunkStart,
          charEnd: charPosition,
        })

        const overlapText = this.getOverlapText(currentChunk, overlapChars)
        currentChunk = overlapText
        chunkStart = charPosition - overlapText.length
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex: chunks.length,
        charStart: chunkStart,
        charEnd: text.length,
      })
    }

    // If a single paragraph is too long, split it further
    const finalChunks: TextChunk[] = []
    for (const chunk of chunks) {
      if (chunk.content.length > maxChars) {
        const subChunks = this.splitLongParagraph(
          chunk.content,
          targetChars,
          maxChars,
          overlapChars
        )
        for (let i = 0; i < subChunks.length; i++) {
          finalChunks.push({
            content: subChunks[i],
            chunkIndex: finalChunks.length,
            charStart: chunk.charStart + i * targetChars,
            charEnd: chunk.charStart + (i + 1) * targetChars,
          })
        }
      } else {
        finalChunks.push({
          ...chunk,
          chunkIndex: finalChunks.length,
        })
      }
    }

    logger.log('[text-chunking] completed', {
      originalLength: text.length,
      chunkCount: finalChunks.length,
      avgChunkSize: Math.round(text.length / finalChunks.length),
    })

    return finalChunks
  }

  /**
   * Split text with page information (for PDFs)
   */
  chunkTextWithPages(
    text: string,
    pageBreaks: number[],
    options: ChunkingOptions = {}
  ): TextChunk[] {
    const chunks = this.chunkText(text, options)

    // Assign page numbers to chunks based on their position
    return chunks.map(chunk => {
      const pageNumber = this.getPageNumber(chunk.charStart, pageBreaks)
      return {
        ...chunk,
        pageNumber,
      }
    })
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(text: string, overlapChars: number): string {
    if (text.length <= overlapChars) {
      return text
    }

    // Try to break at a sentence boundary
    const endPortion = text.slice(-overlapChars * 2)
    const sentenceMatch = endPortion.match(/[.!?]\s+([^.!?]+)$/)

    if (sentenceMatch) {
      return sentenceMatch[1].trim()
    }

    // Otherwise, break at word boundary
    const lastPortion = text.slice(-overlapChars)
    const wordBreak = lastPortion.indexOf(' ')

    if (wordBreak > 0) {
      return lastPortion.slice(wordBreak + 1)
    }

    return lastPortion
  }

  /**
   * Split a long paragraph into smaller chunks at sentence boundaries
   */
  private splitLongParagraph(
    text: string,
    targetChars: number,
    maxChars: number,
    overlapChars: number
  ): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
    const chunks: string[] = []
    let currentChunk = ''

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        const overlap = this.getOverlapText(currentChunk, overlapChars)
        currentChunk = overlap + ' ' + sentence
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim())
    }

    return chunks
  }

  /**
   * Determine page number based on character position
   */
  private getPageNumber(charPosition: number, pageBreaks: number[]): number {
    for (let i = pageBreaks.length - 1; i >= 0; i--) {
      if (charPosition >= pageBreaks[i]) {
        return i + 2 // Pages are 1-indexed
      }
    }
    return 1
  }
}

export const textChunkingService = new TextChunkingService()
