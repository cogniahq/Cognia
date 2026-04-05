import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

test('organization search starts summary polling when fetched results include an answer job', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-answer-state.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const payload: {
    answerJobId: string
    answer: string | null
  } = {
    answerJobId: 'job-123',
    answer: null,
  }
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getOrganizationAnswerState }) => {
        const value = getOrganizationAnswerState(${JSON.stringify(payload)})
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const state = JSON.parse(output) as {
    shouldPoll: boolean
    renderableAnswer: string | null
  }

  assert.equal(state.shouldPoll, true)
  assert.equal(state.renderableAnswer, null)
})

test('organization search renders the completed summary and stops polling', () => {
  const modulePath = path.resolve(
    __dirname,
    '../../../../client/src/components/organization/organization-answer-state.js'
  )
  const moduleUrl = pathToFileURL(modulePath).href
  const payload: {
    answerJobId: string
    answer: string | null
  } = {
    answerJobId: 'job-123',
    answer: '  Summarized answer from the retrieved files.  ',
  }
  const output = execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(moduleUrl)}).then(({ getOrganizationAnswerState }) => {
        const value = getOrganizationAnswerState(${JSON.stringify(payload)})
        process.stdout.write(JSON.stringify(value))
      })`,
    ],
    { encoding: 'utf8' }
  )

  const state = JSON.parse(output) as {
    shouldPoll: boolean
    renderableAnswer: string | null
  }

  assert.equal(state.shouldPoll, false)
  assert.equal(state.renderableAnswer, 'Summarized answer from the retrieved files.')
})
