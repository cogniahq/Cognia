const SENSITIVE_PATTERNS = {
  creditCard: /(?:\d[ -]*?){13,19}/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  bankAccount: /\b\d{8,17}\b/g,
  cvv: /\b\d{3,4}\b(?=.*(?:cvv|cvc|security|code))/gi,
  apiKey:
    /\b(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
  emailPassword: /password\s*[:=]\s*['"]?([^\s'"]+)['"]?/gi,
}

const TRACKING_PATTERNS = {
  googleAnalytics:
    /\b(?:ga|gtag|gtm|analytics|_ga|_gid|_gat)[-_]?[a-z0-9_]*[:=]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi,
  facebookPixel:
    /\b(?:fb|facebook)[-_]?(?:pixel|track|event)[-_]?[a-z0-9_]*[:=]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi,
  trackingId: /\b(?:tracking|track)[-_]?(?:id|code|token|key)[:=]\s*['"]?[a-zA-Z0-9_-]{10,}['"]?/gi,
  sessionId: /\b(?:session|sess)[-_]?(?:id|token)[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi,
  utmParams:
    /[?&](?:utm_[a-z]+|ref|source|campaign|medium|term|content|gclid|fbclid|_hsenc|_hsmi)=[^&\s]*/gi,
  marketingTags:
    /\b(?:marketing|promo|affiliate)[-_]?(?:id|code|tag)[:=]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi,
}

const UI_NOISE_PATTERNS = [
  /\b(?:click|tap)\s+(?:here|now|to)\s+(?:continue|proceed|learn more|read more|see more)/gi,
  /\b(?:subscribe|sign up|register)\s+(?:now|today|free|for|to)/gi,
  /\b(?:cookie|privacy|terms)\s+(?:notice|banner|popup|dialog)/gi,
  /\b(?:accept|decline|agree|disagree)\s+(?:all|all cookies|cookies)/gi,
  /\b(?:skip|jump)\s+to\s+(?:content|main|navigation)/gi,
  /\b(?:menu|navigation|nav)\s+(?:toggle|button|icon)/gi,
  /\b(?:close|×|✕)\s*(?:menu|dialog|popup|modal)/gi,
  /\b(?:loading|please wait|processing)/gi,
  /\b(?:error|404|not found|page not found)/gi,
]

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return text
  }

  let sanitized = text

  sanitized = decodeHtmlEntities(sanitized)

  sanitized = sanitized.replace(SENSITIVE_PATTERNS.creditCard, '[REDACTED: Credit Card]')
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.ssn, '[REDACTED: SSN]')
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.apiKey, '[REDACTED: API Key]')
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.emailPassword, '[REDACTED: Password]')

  const bankAccountMatches = sanitized.match(SENSITIVE_PATTERNS.bankAccount)
  if (bankAccountMatches) {
    bankAccountMatches.forEach(match => {
      if (match.length >= 8 && match.length <= 17) {
        const context = sanitized
          .substring(
            Math.max(0, sanitized.indexOf(match) - 20),
            Math.min(sanitized.length, sanitized.indexOf(match) + match.length + 20)
          )
          .toLowerCase()
        if (
          context.includes('account') ||
          context.includes('routing') ||
          context.includes('bank') ||
          context.includes('checking') ||
          context.includes('saving')
        ) {
          sanitized = sanitized.replace(match, '[REDACTED: Bank Account]')
        }
      }
    })
  }

  sanitized = sanitized.replace(TRACKING_PATTERNS.googleAnalytics, '')
  sanitized = sanitized.replace(TRACKING_PATTERNS.facebookPixel, '')
  sanitized = sanitized.replace(TRACKING_PATTERNS.trackingId, '')
  sanitized = sanitized.replace(TRACKING_PATTERNS.sessionId, '')
  sanitized = sanitized.replace(TRACKING_PATTERNS.utmParams, '')
  sanitized = sanitized.replace(TRACKING_PATTERNS.marketingTags, '')

  UI_NOISE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '')
  })

  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  return sanitized
}

export function sanitizeContextData(data: {
  content_snippet?: string
  full_content?: string
  meaningful_content?: string
  content_summary?: string
  page_structure?: {
    forms?: string[]
    [key: string]: unknown
  }
  [key: string]: unknown
}): typeof data {
  const sanitized = { ...data }

  if (sanitized.content_snippet) {
    sanitized.content_snippet = sanitizeText(sanitized.content_snippet)
  }
  if (sanitized.full_content) {
    sanitized.full_content = sanitizeText(sanitized.full_content)
  }
  if (sanitized.meaningful_content) {
    sanitized.meaningful_content = sanitizeText(sanitized.meaningful_content)
  }
  if (sanitized.content_summary) {
    sanitized.content_summary = sanitizeText(sanitized.content_summary)
  }

  if (sanitized.page_structure && Array.isArray(sanitized.page_structure.forms)) {
    sanitized.page_structure.forms = sanitized.page_structure.forms.map((form: string) =>
      sanitizeText(form)
    )
  }

  return sanitized
}
