/**
 * Server-side Data Loss Prevention (DLP) scanner.
 *
 * Detects high-confidence secret patterns in user-submitted content before
 * persisting to memory storage. Returns a list of pattern names matched and
 * a `blocked` boolean indicating whether the content should be rejected.
 *
 * The patterns are intentionally conservative — favoring precision over
 * recall — because false positives would block legitimate captures.
 */

const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'us_ssn', regex: /\b\d{3}-?\d{2}-?\d{4}\b/g },
  { name: 'credit_card', regex: /\b(?:\d[ -]?){13,19}\b/g },
  { name: 'private_key', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'aws_access_key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'github_token', regex: /\bghp_[A-Za-z0-9]{36}\b/g },
  { name: 'openai_key', regex: /\bsk-[A-Za-z0-9]{48,}\b/g },
  { name: 'google_api_key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'jwt', regex: /\bey[A-Za-z0-9_-]{10,}\.ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g },
]

export interface DlpResult {
  blocked: boolean
  matches: string[] // pattern names that matched
}

export function scanForSecrets(text: string): DlpResult {
  if (!text || typeof text !== 'string') return { blocked: false, matches: [] }
  const matches: string[] = []
  for (const p of PATTERNS) {
    p.regex.lastIndex = 0
    if (p.regex.test(text)) matches.push(p.name)
    p.regex.lastIndex = 0 // reset since regexes have /g and may be reused
  }
  return { blocked: matches.length > 0, matches }
}

export function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return text
  let out = text
  for (const p of PATTERNS) {
    p.regex.lastIndex = 0
    out = out.replace(p.regex, `[REDACTED:${p.name}]`)
  }
  return out
}
