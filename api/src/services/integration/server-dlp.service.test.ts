import test from 'node:test'
import assert from 'node:assert/strict'
import { scanForSecrets, redactSecrets } from './server-dlp.service'

test('dlp: detects SSN', () => {
  const r = scanForSecrets('My SSN is 123-45-6789 sorry.')
  assert.equal(r.blocked, true)
  assert.ok(r.matches.includes('us_ssn'))
})

test('dlp: detects AWS access key', () => {
  const r = scanForSecrets('use AKIAIOSFODNN7EXAMPLE for testing')
  assert.equal(r.blocked, true)
  assert.ok(r.matches.includes('aws_access_key'))
})

test('dlp: detects private key header', () => {
  const r = scanForSecrets('-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...')
  assert.equal(r.blocked, true)
  assert.ok(r.matches.includes('private_key'))
})

test('dlp: detects github token', () => {
  const r = scanForSecrets('token=ghp_abcdefghijklmnopqrstuvwxyz0123456789')
  assert.equal(r.blocked, true)
  assert.ok(r.matches.includes('github_token'))
})

test('dlp: clean text passes', () => {
  const r = scanForSecrets('Just normal content here.')
  assert.equal(r.blocked, false)
  assert.equal(r.matches.length, 0)
})

test('dlp: empty / non-string input does not throw', () => {
  assert.equal(scanForSecrets('').blocked, false)
  assert.equal(scanForSecrets(undefined as unknown as string).blocked, false)
})

test('dlp: redact replaces secrets with placeholders', () => {
  const out = redactSecrets('SSN 123-45-6789 and more')
  assert.match(out, /\[REDACTED:us_ssn\]/)
  assert.doesNotMatch(out, /123-45-6789/)
})

test('dlp: scan returns stable results across repeated calls', () => {
  const text = 'My SSN is 123-45-6789'
  const a = scanForSecrets(text)
  const b = scanForSecrets(text)
  assert.deepEqual(a, b)
})
