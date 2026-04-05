import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

test('organization search loading state surfaces retrieval context instead of a generic pending message', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-loading.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const payload = {
    query: 'What is the breach notification timeline?',
    filterLabel: 'All Sources',
    phaseIndex: 1,
    results: [
      {
        memoryId: 'memory-1',
        documentName: 'Master Services Agreement.pdf',
        sourceType: 'DOCUMENT',
      },
      {
        memoryId: 'memory-2',
        documentName: 'Security Questionnaire.txt',
        sourceType: 'DOCUMENT',
      },
      {
        memoryId: 'memory-3',
        title: 'Northstar trust center',
        sourceType: 'EXTENSION',
      },
    ],
  }
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getOrganizationSearchLoadingState }) => {
        const value = getOrganizationSearchLoadingState(${JSON.stringify(payload)})
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const loadingState = JSON.parse(output) as {
    activeStep: { label: string }
    queryLabel: string
    metrics: Array<{ label: string; value: string }>
    sourceLabels: string[]
  }

  assert.equal(loadingState.activeStep.label, 'Linking citations')
  assert.equal(loadingState.queryLabel, 'What is the breach notification timeline?')
  assert.deepEqual(loadingState.metrics, [
    { label: 'Retrieved', value: '3' },
    { label: 'Source Mix', value: 'Documents + Browsing' },
    { label: 'Filter', value: 'All Sources' },
  ])
  assert.deepEqual(loadingState.sourceLabels, [
    'Master Services Agreement.pdf',
    'Security Questionnaire.txt',
    'Northstar trust center',
  ])
})

test('organization search loading state stays on the final step instead of wrapping back to step one', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-search-loading.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const payload = {
    phaseIndex: 3,
    results: [
      {
        memoryId: 'memory-1',
        documentName: 'Security Questionnaire.txt',
        sourceType: 'DOCUMENT',
      },
    ],
  }
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getOrganizationSearchLoadingState }) => {
        const value = getOrganizationSearchLoadingState(${JSON.stringify(payload)})
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const loadingState = JSON.parse(output) as {
    activeStep: { label: string }
    activeStepIndex: number
    progressLabel: string
    steps: Array<{ label: string; isActive: boolean; isComplete: boolean }>
  }

  assert.equal(loadingState.activeStep.label, 'Drafting summary')
  assert.equal(loadingState.activeStepIndex, 2)
  assert.equal(loadingState.progressLabel, '3/3')
  assert.deepEqual(
    loadingState.steps.map(step => ({
      label: step.label,
      isActive: step.isActive,
      isComplete: step.isComplete,
    })),
    [
      {
        label: 'Reviewing evidence',
        isActive: false,
        isComplete: true,
      },
      {
        label: 'Linking citations',
        isActive: false,
        isComplete: true,
      },
      {
        label: 'Drafting summary',
        isActive: true,
        isComplete: false,
      },
    ]
  )
})
