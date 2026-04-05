import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

test('organization search hides fetched results while summary generation is still pending', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-results.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const payload = {
    results: [
      {
        memoryId: 'memory-1',
        title: 'Order Confirmation - Gmail',
        contentPreview: 'Order confirmation details',
      },
    ],
    answerJobId: 'job-123',
    citations: [] as Array<{ memoryId: string }>,
  }
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getVisibleOrganizationSearchResults }) => {
        const value = getVisibleOrganizationSearchResults(${JSON.stringify(payload)})
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const visible = JSON.parse(output) as Array<{ memoryId: string }>

  assert.deepEqual(visible, [])
})

test('organization search shows fetched results after summary generation finishes without citations', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-results.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const payload = {
    results: [
      {
        memoryId: 'memory-1',
        title: 'Order Confirmation - Gmail',
        contentPreview: 'Order confirmation details',
      },
    ],
    citations: [] as Array<{ memoryId: string }>,
  }
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getVisibleOrganizationSearchResults }) => {
        const value = getVisibleOrganizationSearchResults(${JSON.stringify(payload)})
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const visible = JSON.parse(output) as Array<{ memoryId: string }>

  assert.equal(visible.length, 1)
  assert.equal(visible[0].memoryId, 'memory-1')
})

test('organization search narrows fetched results to the source files cited by the summary', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-results.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const payload = {
    results: [
      {
        memoryId: 'memory-1',
        documentName: 'Master Services Agreement.pdf',
        title: 'Master Services Agreement - Chunk 1',
        contentPreview: 'Liability is capped at fees paid.',
      },
      {
        memoryId: 'memory-2',
        documentName: 'Master Services Agreement.pdf',
        title: 'Master Services Agreement - Chunk 2',
        contentPreview: 'Security incident notification commitment.',
      },
      {
        memoryId: 'memory-3',
        documentName: 'Statement of Work.pdf',
        title: 'Statement of Work',
        contentPreview: 'Delivery milestones and acceptance criteria.',
      },
    ],
    citations: [
      {
        memoryId: 'memory-1',
        documentName: 'Master Services Agreement.pdf',
      },
    ],
  }
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getVisibleOrganizationSearchResults }) => {
        const value = getVisibleOrganizationSearchResults(${JSON.stringify(payload)})
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const visible = JSON.parse(output) as Array<{ memoryId: string }>

  assert.deepEqual(
    visible.map(result => result.memoryId),
    ['memory-1', 'memory-2']
  )
})
