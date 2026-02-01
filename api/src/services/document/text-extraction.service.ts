import { logger } from '../../utils/core/logger.util'
import { aiProvider } from '../ai/ai-provider.service'

export interface ExtractedText {
  text: string
  pageCount?: number
  metadata?: Record<string, unknown>
}

export class TextExtractionService {
  /**
   * Extract text from a file based on its MIME type
   */
  async extractText(buffer: Buffer, mimeType: string, filename: string): Promise<ExtractedText> {
    logger.log('[text-extraction] starting', { mimeType, filename, size: buffer.length })

    if (mimeType === 'application/pdf') {
      return this.extractFromPdf(buffer)
    }

    if (
      mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
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
  private async extractFromPdf(buffer: Buffer): Promise<ExtractedText> {
    // Dynamic import to avoid issues if pdf-parse isn't installed yet
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)

    logger.log('[text-extraction] pdf extracted', {
      pages: data.numpages,
      textLength: data.text.length,
    })

    return {
      text: data.text,
      pageCount: data.numpages,
      metadata: {
        info: data.info,
        version: data.version,
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
   * Extract text from images using Gemini Vision API for OCR
   */
  private async extractFromImage(buffer: Buffer, mimeType: string): Promise<ExtractedText> {
    const base64 = buffer.toString('base64')

    const prompt = `Please extract all text from this image. If the image contains a document, extract all readable text maintaining the structure as much as possible. If there is no text, describe what you see briefly.`

    try {
      const response = await aiProvider.generateContentWithImage(prompt, base64, mimeType)

      logger.log('[text-extraction] image OCR completed', {
        textLength: response.length,
      })

      return {
        text: response,
        metadata: {
          extractionMethod: 'gemini-vision',
        },
      }
    } catch (error) {
      logger.error('[text-extraction] image OCR failed', { error })
      throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : String(error)}`)
    }
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
