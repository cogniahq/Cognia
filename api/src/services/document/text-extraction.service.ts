import { logger } from '../../utils/core/logger.util'
import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'

import { getGenerationProvider, getGeminiVisionModel, getOpenAIVisionModel } from '../ai/ai-config'
import { aiProvider } from '../ai/ai-provider.service'

const execFileAsync = promisify(execFile)
const OCR_EMPTY_SENTINEL = 'NO_READABLE_TEXT'
const OCR_RENDER_DPI = 220
const OCR_RENDER_PREFIX = 'page'

export interface ExtractedText {
  text: string
  pageCount?: number
  metadata?: Record<string, unknown>
}

interface RenderedPdfPage {
  buffer: Buffer
  mimeType: string
  pageNumber: number
}

export class TextExtractionService {
  /**
   * Extract text from a file based on its MIME type
   */
  async extractText(buffer: Buffer, mimeType: string, filename: string): Promise<ExtractedText> {
    logger.log('[text-extraction] starting', { mimeType, filename, size: buffer.length })

    if (mimeType === 'application/pdf') {
      return this.extractFromPdf(buffer, filename)
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return this.extractFromDocx(buffer)
    }

    if (mimeType.startsWith('image/')) {
      return this.extractFromImage(buffer, mimeType)
    }

    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      return this.extractFromText(buffer)
    }

    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  /**
   * Extract text from PDF using pdf-parse
   */
  async extractFromPdf(buffer: Buffer, filename: string): Promise<ExtractedText> {
    // pdf-parse v2 exposes a parser class instead of the old v1 function API.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    let data: { text: string; total: number; pages?: unknown[] }

    try {
      data = await parser.getText()
    } finally {
      await parser.destroy()
    }

    logger.log('[text-extraction] pdf extracted', {
      pages: data.total,
      textLength: data.text.length,
    })

    const normalizedText = data.text.trim()
    if (normalizedText.length === 0) {
      logger.log('[text-extraction] pdf text layer empty, falling back to OCR', {
        filename,
        pages: data.total,
      })
      return this.extractFromPdfWithOcr(buffer, filename, data.total)
    }

    return {
      text: data.text,
      pageCount: data.total,
      metadata: {
        pages: data.pages,
      },
    }
  }

  async extractFromPdfWithOcr(
    buffer: Buffer,
    filename: string,
    pageCount?: number
  ): Promise<ExtractedText> {
    const renderedPages = await this.renderPdfPagesForOcr(buffer, filename, pageCount)
    const extracted = await this.extractTextFromRenderedPages(renderedPages, filename)

    return {
      text: extracted.text,
      pageCount: extracted.pageCount ?? renderedPages.length ?? pageCount,
      metadata: {
        usedOcrFallback: true,
        originalPageCount: pageCount,
        ...(extracted.metadata || {}),
      },
    }
  }

  /**
   * Extract text from DOCX using mammoth
   */
  private async extractFromDocx(buffer: Buffer): Promise<ExtractedText> {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })

    logger.log('[text-extraction] docx extracted', {
      textLength: result.value.length,
      messages: result.messages.length,
    })

    return {
      text: result.value,
      metadata: {
        warnings: result.messages,
      },
    }
  }

  /**
   * Extract text from images using the configured vision model for OCR
   */
  async extractFromImage(buffer: Buffer, mimeType: string): Promise<ExtractedText> {
    const base64 = buffer.toString('base64')

    const prompt = `Extract all readable text from this image in reading order.
Return only the extracted text. Do not describe the image.
Do not add commentary, markdown, bullets, or headings.
If there is no readable text, respond exactly with ${OCR_EMPTY_SENTINEL} and nothing else.`

    try {
      const response = await aiProvider.generateContentWithImage(prompt, base64, mimeType)
      const text = this.normalizeOcrResponse(response)
      const { provider, model } = this.getOcrProviderAndModel()

      logger.log('[text-extraction] image OCR completed', {
        textLength: text.length,
        provider,
        model,
      })

      return {
        text,
        metadata: {
          extractionMethod: 'vision-ocr',
          ocrProvider: provider,
          ocrModel: model,
          sourceMimeType: mimeType,
        },
      }
    } catch (error) {
      logger.error('[text-extraction] image OCR failed', { error })
      throw new Error(
        `Failed to extract text from image: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  async extractTextFromRenderedPages(
    pages: RenderedPdfPage[],
    filename: string
  ): Promise<ExtractedText> {
    const chunks: string[] = []
    let pagesWithText = 0
    const metadata: Record<string, unknown> = {
      ocrProvider: this.getOcrProviderAndModel().provider,
      ocrModel: this.getOcrProviderAndModel().model,
      sourceFile: filename,
      pagesWithText: 0,
    }

    for (const page of pages) {
      const extracted = await this.extractFromImage(page.buffer, page.mimeType)
      const text = extracted.text.trim()
      if (!text) {
        continue
      }

      chunks.push(text)
      pagesWithText++
      metadata.pagesWithText = pagesWithText
      if (extracted.metadata) {
        Object.assign(metadata, extracted.metadata)
      }
    }

    return {
      text: chunks.join('\n\n').trim(),
      pageCount: pages.length,
      metadata,
    }
  }

  async renderPdfPagesForOcr(
    buffer: Buffer,
    filename: string,
    pageCount?: number
  ): Promise<RenderedPdfPage[]> {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'cognia-pdf-ocr-'))
    const pdfPath = path.join(tempDir, filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'input.pdf')
    const outputPrefix = path.join(tempDir, OCR_RENDER_PREFIX)

    try {
      await writeFile(pdfPath, buffer)

      const args = ['-png', '-r', String(OCR_RENDER_DPI)]
      if (pageCount && pageCount > 0) {
        args.push('-f', '1', '-l', String(pageCount))
      }
      args.push(pdfPath, outputPrefix)

      await execFileAsync('pdftoppm', args)

      const files = (await readdir(tempDir))
        .filter(file => file.startsWith(`${OCR_RENDER_PREFIX}-`) && file.endsWith('.png'))
        .sort((a, b) => this.extractPageNumber(a) - this.extractPageNumber(b))

      const renderedPages: RenderedPdfPage[] = []
      for (const file of files) {
        const pageNumber = this.extractPageNumber(file)
        const pageBuffer = await readFile(path.join(tempDir, file))
        renderedPages.push({
          buffer: pageBuffer,
          mimeType: 'image/png',
          pageNumber,
        })
      }

      return renderedPages
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

  private normalizeOcrResponse(response: string): string {
    const trimmed = response.trim()
    if (!trimmed) {
      return ''
    }

    const normalized = trimmed
      .replace(/```(?:text)?\n?/gi, '')
      .replace(/```/g, '')
      .trim()
    if (
      normalized.toUpperCase() === OCR_EMPTY_SENTINEL ||
      normalized.toUpperCase() === `${OCR_EMPTY_SENTINEL}.` ||
      /^NO\s+READABLE\s+TEXT$/i.test(normalized) ||
      /^NO\s+TEXT$/i.test(normalized) ||
      /^EMPTY$/i.test(normalized)
    ) {
      return ''
    }

    return normalized
  }

  private getOcrProviderAndModel(): { provider: 'openai' | 'gemini'; model: string } {
    const generationProvider = getGenerationProvider()
    if (generationProvider === 'gemini') {
      return {
        provider: 'gemini',
        model: getGeminiVisionModel(),
      }
    }

    return {
      provider: 'openai',
      model: getOpenAIVisionModel(),
    }
  }

  private extractPageNumber(filename: string): number {
    const match = filename.match(/-(\d+)\.png$/)
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
  }

  /**
   * Extract text from plain text files
   */
  private async extractFromText(buffer: Buffer): Promise<ExtractedText> {
    const text = buffer.toString('utf-8')

    logger.log('[text-extraction] text extracted', { textLength: text.length })

    return {
      text,
    }
  }
}

export const textExtractionService = new TextExtractionService()
