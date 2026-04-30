import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const importModule = (specifier: string) =>
  Function('modulePath', 'return import(modulePath)')(specifier) as Promise<unknown>

test('organization search open url carries a highlight payload for external sources', async () => {
  const modulePath = pathToFileURL(
    '/Users/art3mis/Developer/CogniaHQ/Cognia/client/src/components/organization/organization-search-opening.js'
  ).href
  const { buildOrganizationSearchOpenUrl } = (await importModule(modulePath)) as {
    buildOrganizationSearchOpenUrl: (input: {
      url: string
      query: string
      result: {
        content?: string
        contentPreview?: string
        documentName?: string
        title?: string
        pageNumber?: number
      }
    }) => string
  }

  const openedUrl = buildOrganizationSearchOpenUrl({
    url: 'https://docs.google.com/document/d/demo-doc/edit?usp=sharing',
    query: 'What is the breach notification timeline?',
    result: {
      documentName: 'Security Questionnaire',
      pageNumber: 8,
      content:
        'Aperture Cloud will notify Northstar Bank without undue delay and no later than twenty-four hours after confirmation of a security incident affecting customer data.',
      contentPreview: 'Security incident response and breach notification timeline.',
    },
  })

  const parsed = new URL(openedUrl)

  assert.equal(parsed.origin, 'https://docs.google.com')
  assert.equal(parsed.pathname, '/document/d/demo-doc/edit')
  assert.equal(parsed.searchParams.get('usp'), 'sharing')
  assert.match(
    parsed.searchParams.get('cognia_hl') || '',
    /twenty-four hours after confirmation of a security incident/i
  )
  assert.equal(parsed.searchParams.get('cognia_q'), 'What is the breach notification timeline?')
  assert.equal(parsed.searchParams.get('cognia_p'), '8')
  assert.equal(parsed.searchParams.get('cognia_t'), 'Security Questionnaire')
})

test('organization search open url prefers a verbatim highlight excerpt over retrieval text', async () => {
  const modulePath = pathToFileURL(
    '/Users/art3mis/Developer/CogniaHQ/Cognia/client/src/components/organization/organization-search-opening.js'
  ).href
  const { buildOrganizationSearchOpenUrl } = (await importModule(modulePath)) as {
    buildOrganizationSearchOpenUrl: (input: {
      url: string
      query: string
      result: {
        content?: string
        contentPreview?: string
        highlightText?: string
        documentName?: string
      }
    }) => string
  }

  const openedUrl = buildOrganizationSearchOpenUrl({
    url: 'https://www.notion.so/fil-pin-zoom-plugin-demo',
    query: 'What does the Fil-Pin Zoom Plugin say about data capture, transcripts, and storage?',
    result: {
      documentName: 'Fil-Pin Zoom Plugin',
      content:
        'Structured summary: the plugin captures meetings, provides searchable transcripts, and stores workspace artifacts for retrieval.',
      highlightText:
        'The plugin captures Zoom meetings, stores transcripts, and syncs the resulting notes into the workspace for later retrieval.',
      contentPreview: 'Plugin capture and transcript storage overview.',
    },
  })

  const parsed = new URL(openedUrl)

  assert.match(
    parsed.searchParams.get('cognia_hl') || '',
    /captures Zoom meetings, stores transcripts, and syncs the resulting notes/i
  )
  assert.doesNotMatch(parsed.searchParams.get('cognia_hl') || '', /Structured summary:/i)
})
