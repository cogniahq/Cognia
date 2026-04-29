import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'

// Set fake creds BEFORE importing the service so that the env-driven
// `getOAuthProvider` returns a populated config.
process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-google-client'
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-google-secret'

import { buildAuthorizeUrl, generateCodeVerifier } from './oauth-providers.service'
import { deriveCodeChallenge } from '../../utils/auth/pkce.util'

test('oauth: buildAuthorizeUrl includes required params', () => {
  const verifier = generateCodeVerifier()
  const state = 'test-state'
  const url = new URL(buildAuthorizeUrl('google', state, verifier))
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('client_id'), 'test-google-client')
  assert.equal(url.searchParams.get('state'), state)
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('code_challenge'), deriveCodeChallenge(verifier))
  assert.match(url.searchParams.get('scope') ?? '', /openid/)
})

test('oauth: PKCE challenge matches S256 algorithm', () => {
  const verifier = generateCodeVerifier()
  const challenge = deriveCodeChallenge(verifier)
  // base64url-encoded SHA-256 (32 bytes) is always 43 chars without padding.
  assert.equal(challenge.length, 43)
  assert.match(challenge, /^[A-Za-z0-9_-]+$/)
})

test('oauth: throws when provider not configured', () => {
  const orig = process.env.MICROSOFT_OAUTH_CLIENT_ID
  delete process.env.MICROSOFT_OAUTH_CLIENT_ID
  try {
    assert.throws(() => buildAuthorizeUrl('microsoft', 's', 'v'), /not configured/i)
  } finally {
    if (orig !== undefined) process.env.MICROSOFT_OAUTH_CLIENT_ID = orig
  }
})
