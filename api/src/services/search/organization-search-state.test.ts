import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

test('organization search stays enabled when there are no uploaded documents', async () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-state.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getOrganizationSearchState }) => {
        const state = getOrganizationSearchState({ documentCount: 0 })
        process.stdout.write(JSON.stringify(state))
      })`,
    ],
    { encoding: 'utf8' }
  )
  const state = JSON.parse(output) as { isDisabled: boolean; placeholder: string }

  assert.equal(state.isDisabled, false)
  assert.equal(state.placeholder, 'Ask anything about your documents and browsing memories...')
})
