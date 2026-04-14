import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const importModule = (specifier: string) =>
  Function('modulePath', 'return import(modulePath)')(specifier) as Promise<unknown>

test('search highlight text match expands the matched phrase to the containing sentence', async () => {
  const modulePath = pathToFileURL(
    '/Users/art3mis/Developer/CogniaHQ/Cognia/extension/src/content/highlighting/search-highlight-range.ts'
  ).href
  const { findSearchHighlightTextMatch } = (await importModule(modulePath)) as {
    findSearchHighlightTextMatch: (
      rawText: string,
      candidates: string[]
    ) => {
      rawStart: number
      rawEnd: number
      matchedCandidate: string
      sentenceText: string
    } | null
  }

  const match = findSearchHighlightTextMatch(
    'Coverage summary. Aperture Cloud will notify Northstar Bank without undue delay and no later than twenty-four hours after confirmation of a security incident affecting customer data. Final note.',
    ['breach notification timeline', 'twenty-four hours after confirmation']
  )

  assert.ok(match)
  assert.equal(match?.matchedCandidate, 'twenty-four hours after confirmation')
  assert.equal(
    match?.sentenceText,
    'Aperture Cloud will notify Northstar Bank without undue delay and no later than twenty-four hours after confirmation of a security incident affecting customer data.'
  )
})

test('search highlight text match tolerates fragmented whitespace in the source text', async () => {
  const modulePath = pathToFileURL(
    '/Users/art3mis/Developer/CogniaHQ/Cognia/extension/src/content/highlighting/search-highlight-range.ts'
  ).href
  const { findSearchHighlightTextMatch } = (await importModule(modulePath)) as {
    findSearchHighlightTextMatch: (
      rawText: string,
      candidates: string[]
    ) => {
      rawStart: number
      rawEnd: number
      matchedCandidate: string
      sentenceText: string
    } | null
  }

  const match = findSearchHighlightTextMatch(
    'Security incident response:\nAperture Cloud will notify Northstar Bank without undue delay and no later than twenty-four hours   after confirmation\nof a security incident affecting customer data.\nAdditional notes follow.',
    ['twenty-four hours after confirmation of a security incident']
  )

  assert.ok(match)
  assert.equal(
    match?.sentenceText,
    'Aperture Cloud will notify Northstar Bank without undue delay and no later than twenty-four hours after confirmation of a security incident affecting customer data.'
  )
})

test('search highlight text match tolerates Notion-style sentence fragments across node boundaries', async () => {
  const modulePath = pathToFileURL(
    '/Users/art3mis/Developer/CogniaHQ/Cognia/extension/src/content/highlighting/search-highlight-range.ts'
  ).href
  const { findSearchHighlightTextMatchFromSegments } = (await importModule(modulePath)) as {
    findSearchHighlightTextMatchFromSegments: (
      segments: string[],
      candidates: string[]
    ) => {
      rawStart: number
      rawEnd: number
      matchedCandidate: string
      sentenceText: string
    } | null
  }

  const match = findSearchHighlightTextMatchFromSegments(
    [
      'Aperture Cloud will notify Northstar Bank',
      'without undue delay and no later than',
      'twenty-four hours after confirmation',
      'of a security incident affecting customer data.',
    ],
    ['twenty-four hours after confirmation of a security incident']
  )

  assert.ok(match)
  assert.equal(
    match?.sentenceText,
    'Aperture Cloud will notify Northstar Bank without undue delay and no later than twenty-four hours after confirmation of a security incident affecting customer data.'
  )
})
