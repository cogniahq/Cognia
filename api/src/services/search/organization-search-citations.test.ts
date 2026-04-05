import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

test('organization search summary citations collapse repeated references to the same file', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-citations.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const payload = [
    {
      index: 1,
      documentName: 'Master Services Agreement.pdf',
      memoryId: 'memory-1',
      sourceType: 'DOCUMENT',
    },
    {
      index: 2,
      documentName: 'Master Services Agreement.pdf',
      memoryId: 'memory-2',
      sourceType: 'DOCUMENT',
    },
    {
      index: 3,
      documentName: 'Security Questionnaire.txt',
      memoryId: 'memory-3',
      sourceType: 'DOCUMENT',
    },
  ]
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getVisibleOrganizationSearchCitations }) => {
        const value = getVisibleOrganizationSearchCitations(${JSON.stringify(payload)})
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const visible = JSON.parse(output) as Array<{
    documentName?: string
    memoryId: string
    indices: number[]
    index: number
    sourceType?: string
  }>

  assert.deepEqual(
    visible.map(citation => ({
      documentName: citation.documentName,
      memoryId: citation.memoryId,
      indices: citation.indices,
    })),
    [
      {
        documentName: 'Master Services Agreement.pdf',
        memoryId: 'memory-1',
        indices: [1, 2],
      },
      {
        documentName: 'Security Questionnaire.txt',
        memoryId: 'memory-3',
        indices: [3],
      },
    ]
  )
})
