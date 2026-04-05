import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createLocalStorageSignedUrl,
  isValidLocalStorageSignedUrl,
} from './local-storage-url.util'
import { resolveLocalStoragePath } from './local-storage.provider'

test('creates a browser-safe signed URL for local storage files', () => {
  process.env.JWT_SECRET = 'test-secret'

  const url = createLocalStorageSignedUrl('documents/org-123/demo file.pdf', 300)
  const parsed = new URL(url, 'http://localhost:3000')

  assert.equal(parsed.pathname, '/api/storage/local')
  assert.equal(parsed.searchParams.get('key'), 'documents/org-123/demo file.pdf')
  assert.ok(parsed.searchParams.get('expires'))
  assert.ok(parsed.searchParams.get('sig'))
  assert.equal(isValidLocalStorageSignedUrl(parsed.searchParams), true)
  assert.equal(url.includes('/Users/'), false)
})

test('rejects expired signed URLs for local storage files', () => {
  process.env.JWT_SECRET = 'test-secret'

  const url = createLocalStorageSignedUrl('documents/org-123/demo.pdf', 300)
  const parsed = new URL(url, 'http://localhost:3000')
  parsed.searchParams.set('expires', String(Math.floor(Date.now() / 1000) - 1))

  assert.equal(isValidLocalStorageSignedUrl(parsed.searchParams), false)
})

test('rejects path traversal when resolving a local storage path', () => {
  assert.throws(() => resolveLocalStoragePath('../secrets.txt', '/tmp/cognia-uploads'))
})
