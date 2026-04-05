import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

test('organization search highlights matched query terms within fetched file content', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-highlighting.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const payload = {
    text: 'Production data stays in the EU region and SAML SSO is included.',
    query: 'EU region SAML',
  }
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ buildOrganizationSearchHighlights }) => {
        const value = buildOrganizationSearchHighlights(${JSON.stringify(payload.text)}, ${JSON.stringify(payload.query)})
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const highlights = JSON.parse(output) as Array<{ text: string; isMatch: boolean }>

  assert.equal(
    highlights.map(segment => segment.text).join(''),
    payload.text
  )
  assert.deepEqual(
    highlights.filter(segment => segment.isMatch).map(segment => segment.text),
    ['EU', 'region', 'SAML']
  )
})

test('organization search highlighting treats empty or stopword-only queries as plain text', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-highlighting.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const payload = {
    text: 'Customer data is retained for thirty days after termination.',
    query: 'the is for after',
  }
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ buildOrganizationSearchHighlights }) => {
        const value = buildOrganizationSearchHighlights(${JSON.stringify(payload.text)}, ${JSON.stringify(payload.query)})
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const highlights = JSON.parse(output) as Array<{ text: string; isMatch: boolean }>

  assert.deepEqual(highlights, [{ text: payload.text, isMatch: false }])
})

test('organization search highlighting matches hyphenated query terms', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-highlighting.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const payload = {
    text: 'No production go-live may occur without written approval from InfoSec.',
    query: 'go-live approval gate',
  }
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ buildOrganizationSearchHighlights }) => {
        const value = buildOrganizationSearchHighlights(${JSON.stringify(payload.text)}, ${JSON.stringify(payload.query)})
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const highlights = JSON.parse(output) as Array<{ text: string; isMatch: boolean }>

  assert.deepEqual(
    highlights.filter(segment => segment.isMatch).map(segment => segment.text),
    ['go-live', 'approval']
  )
})
