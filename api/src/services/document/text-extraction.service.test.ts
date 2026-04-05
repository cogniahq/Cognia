import assert from 'node:assert/strict'
import fs from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import test from 'node:test'

import { aiProvider } from '../ai/ai-provider.service'
import { textExtractionService, TextExtractionService } from './text-extraction.service'

type PdfParseResult = {
  text: string
  total: number
  pages?: unknown[]
}

function mockPdfParse(result: PdfParseResult): () => void {
  const moduleLoader = Module as typeof Module & {
    _load: (request: string, parent: NodeModule | null, isMain: boolean) => unknown
  }
  const originalLoad = moduleLoader._load

  class MockPdfParse {
    async getText(): Promise<PdfParseResult> {
      return result
    }

    async destroy(): Promise<void> {}
  }

  moduleLoader._load = function patchedLoad(
    request: string,
    parent: NodeModule | null,
    isMain: boolean
  ): unknown {
    if (request === 'pdf-parse') {
      return { PDFParse: MockPdfParse }
    }

    return originalLoad.call(this, request, parent, isMain)
  }

  return () => {
    moduleLoader._load = originalLoad
  }
}

function mockVisionResponse(response: string): { restore: () => void; prompts: string[] } {
  const prompts: string[] = []
  const original = aiProvider.generateContentWithImage

  aiProvider.generateContentWithImage = async prompt => {
    prompts.push(prompt)
    return response
  }

  return {
    prompts,
    restore: () => {
      aiProvider.generateContentWithImage = original
    },
  }
}

test('extractText reads text from PDF uploads', async () => {
  const pdfPath = path.resolve(__dirname, '../../../../docs/cognia-product-whitepaper.pdf')
  const extracted = await textExtractionService.extractText(
    fs.readFileSync(pdfPath),
    'application/pdf',
    'cognia-product-whitepaper.pdf'
  )

  assert.match(extracted.text, /Cognia Product Whitepaper/)
  assert.equal(extracted.pageCount, 9)
})

test('extractText falls back to OCR when a PDF has no readable text layer', async () => {
  const restorePdfParse = mockPdfParse({
    text: '',
    total: 1,
    pages: [],
  })

  const service = new TextExtractionService() as TextExtractionService & {
    renderPdfPagesForOcr: (
      buffer: Buffer,
      filename: string
    ) => Promise<Array<{ buffer: Buffer; mimeType: string; pageNumber: number }>>
    extractTextFromRenderedPages: (
      pages: Array<{ buffer: Buffer; mimeType: string; pageNumber: number }>,
      filename: string
    ) => Promise<{ text: string; pageCount?: number; metadata?: Record<string, unknown> }>
  }

  service.renderPdfPagesForOcr = async () => [
    {
      buffer: Buffer.from('page-1'),
      mimeType: 'image/png',
      pageNumber: 1,
    },
  ]
  service.extractTextFromRenderedPages = async pages => ({
    text: 'Scanned contract text',
    pageCount: pages.length,
    metadata: {
      usedOcrFallback: true,
    },
  })

  try {
    const extracted = await service.extractText(
      Buffer.from('%PDF-1.4 scanned pdf'),
      'application/pdf',
      'scanned-contract.pdf'
    )

    assert.equal(extracted.text, 'Scanned contract text')
    assert.equal(extracted.pageCount, 1)
    assert.equal(extracted.metadata?.usedOcrFallback, true)
  } finally {
    restorePdfParse()
  }
})

test('extractText returns an empty string when OCR finds no readable text in an image', async () => {
  const service = new TextExtractionService()
  const { restore, prompts } = mockVisionResponse('NO_READABLE_TEXT')

  try {
    const extracted = await service.extractText(Buffer.from('fake-image'), 'image/png', 'blank.png')

    assert.equal(extracted.text, '')
    assert.match(prompts[0] || '', /NO_READABLE_TEXT/)
    assert.match(prompts[0] || '', /Do not describe the image/i)
  } finally {
    restore()
  }
})

test('extractText records OCR provider and model metadata for image extraction', async () => {
  process.env.GEN_PROVIDER = 'openai'
  process.env.OPENAI_VISION_MODEL = 'gpt-4.1-mini'

  const service = new TextExtractionService()
  const { restore } = mockVisionResponse('Quarterly revenue was $4.2M')

  try {
    const extracted = await service.extractText(
      Buffer.from('fake-image'),
      'image/png',
      'quarterly-report.png'
    )

    assert.equal(extracted.text, 'Quarterly revenue was $4.2M')
    assert.equal(extracted.metadata?.extractionMethod, 'vision-ocr')
    assert.equal(extracted.metadata?.ocrProvider, 'openai')
    assert.equal(extracted.metadata?.ocrModel, 'gpt-4.1-mini')
    assert.equal(extracted.metadata?.sourceMimeType, 'image/png')
  } finally {
    restore()
    delete process.env.GEN_PROVIDER
    delete process.env.OPENAI_VISION_MODEL
  }
})
