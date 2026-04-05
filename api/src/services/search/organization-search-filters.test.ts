import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

test('organization search maps the documents filter to document source types', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-filters.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getOrganizationSearchSourceTypes }) => {
        const value = getOrganizationSearchSourceTypes('DOCUMENTS')
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const sourceTypes = JSON.parse(output) as string[]

  assert.deepEqual(sourceTypes, ['DOCUMENT'])
})

test('organization search falls back to the all-sources filter label', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-filters.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getOrganizationSearchFilterLabel }) => {
        const value = getOrganizationSearchFilterLabel('UNKNOWN')
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const label = JSON.parse(output) as string

  assert.equal(label, 'All Sources')
})
