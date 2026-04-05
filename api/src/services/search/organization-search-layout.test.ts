import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

test('organization search renders the summary before fetched results when both are visible', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-layout.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getOrganizationSearchSectionOrder }) => {
        const value = getOrganizationSearchSectionOrder({ hasSummary: true, hasResults: true })
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const order = JSON.parse(output) as string[]

  assert.deepEqual(order, ['summary', 'results'])
})

test('organization search still shows fetched results when no summary is available', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-layout.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getOrganizationSearchSectionOrder }) => {
        const value = getOrganizationSearchSectionOrder({ hasSummary: false, hasResults: true })
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const order = JSON.parse(output) as string[]

  assert.deepEqual(order, ['results'])
})
