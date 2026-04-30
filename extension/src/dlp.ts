/**
 * Client-side DLP scanner for the Cognia browser extension.
 *
 * Mirrors the server-side scanner in
 * `api/src/services/integration/server-dlp.service.ts` so a capture is dropped
 * in the browser before any network round-trip. The server still runs its own
 * scan as defence-in-depth — the client check is a UX optimisation that also
 * reduces accidental exfiltration of secrets in flight.
 */

const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'us_ssn', regex: /\b\d{3}-?\d{2}-?\d{4}\b/g },
  { name: 'credit_card', regex: /\b(?:\d[ -]?){13,19}\b/g },
  { name: 'private_key', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'aws_access_key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'github_token', regex: /\bghp_[A-Za-z0-9]{36}\b/g },
  { name: 'openai_key', regex: /\bsk-[A-Za-z0-9]{48,}\b/g },
]

export interface ClientDlpResult {
  blocked: boolean
  matches: string[]
}

export function scanForSecretsClient(text: string): ClientDlpResult {
  if (!text || typeof text !== 'string') return { blocked: false, matches: [] }
  const matches: string[] = []
  for (const p of PATTERNS) {
    p.regex.lastIndex = 0
    if (p.regex.test(text)) matches.push(p.name)
    p.regex.lastIndex = 0
  }
  return { blocked: matches.length > 0, matches }
}
