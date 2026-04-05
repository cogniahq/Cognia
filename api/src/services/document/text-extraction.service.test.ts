import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { textExtractionService } from './text-extraction.service'

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
