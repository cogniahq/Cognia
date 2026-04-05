import { sanitizeContentForStorage } from '../../utils/text/text.util'

type MetadataRecord = Record<string, unknown>

export type StructuredMemoryEntities = {
  emails: string[]
  urls: string[]
  domains: string[]
  orderNumbers: string[]
  currencyAmounts: string[]
  dates: string[]
  phoneNumbers: string[]
  participants: string[]
}

export type StructuredMemoryCommerce = {
  merchant?: string
  orderNumbers: string[]
  currencyAmounts: string[]
}

export type StructuredMemoryData = {
  ingestionVersion: string
  contentType: string
  structuredSummary: string
  representativeExcerpt: string
  keyFacts: string[]
  topics: string[]
  categories: string[]
  searchableTerms: string[]
  extractedEntities: StructuredMemoryEntities
  retrievalText: string
  commerce?: StructuredMemoryCommerce
}

type StructuredMemoryInput = {
  title?: string | null
  url?: string | null
  content?: string | null
  source?: string | null
  metadata?: MetadataRecord | null
}

type RetrievalTextInput = {
  title?: string | null
  content?: string | null
  pageMetadata?: MetadataRecord | null
}

const INGESTION_VERSION = 'structured-memory-v1'
const MAX_SUMMARY_LENGTH = 320
const MAX_EXCERPT_LENGTH = 280
const MAX_RETRIEVAL_TEXT_LENGTH = 2200
const MAX_KEY_FACTS = 8
const MAX_SEARCHABLE_TERMS = 40
const MAX_TOPICS = 8

const TITLE_SPLITTER = /\s*[-|:]\s*/
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const URL_REGEX = /\bhttps?:\/\/[^\s)]+/gi
const PHONE_REGEX = /\b(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g
const MONEY_REGEX =
  /(?:USD|EUR|GBP|INR|CAD|AUD)\s?\d[\d,]*(?:\.\d{2})?|(?:\$|€|£|₹)\s?\d[\d,]*(?:\.\d{2})?|\d[\d,]*(?:\.\d{2})?\s?(?:USD|EUR|GBP|INR|CAD|AUD)/gi
const DATE_REGEX =
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+\d{1,2}(?:,\s*\d{4})?)?\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/gi
const ORDER_NUMBER_PATTERNS = [
  /(?:order|confirmation|invoice|receipt|tracking)(?:\s*(?:number|#|no\.?|id))?(?:\s*(?:is|was|=|:|#|-))?\s*([A-Z0-9-]{4,})/gi,
  /\b(?:order|confirmation|invoice|receipt|tracking)\s+#\s*([A-Z0-9-]{4,})\b/gi,
]

const UI_NOISE_PATTERNS = [
  /\b(?:reply|forward|archive|delete|spam|trash|inbox|sent|drafts)\b/gi,
  /\b(?:search mail|labels|print all|new window|google account|help|training)\b/gi,
  /\b(?:click here|sign in|sign up|subscribe|cookie|privacy|terms)\b/gi,
  /\b(?:menu|navigation|show more|view more|loading|try reloading)\b/gi,
]

const COMMERCE_HINTS = [
  'order',
  'invoice',
  'receipt',
  'tracking',
  'shipment',
  'delivered',
  'subtotal',
  'total',
  'payment',
]

const STOP_WORDS = new Set([
  'a',
  'about',
  'after',
  'all',
  'also',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'between',
  'both',
  'but',
  'by',
  'can',
  'did',
  'do',
  'does',
  'for',
  'from',
  'get',
  'got',
  'had',
  'has',
  'have',
  'he',
  'her',
  'here',
  'hers',
  'him',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'me',
  'more',
  'most',
  'my',
  'new',
  'no',
  'not',
  'of',
  'on',
  'or',
  'our',
  'out',
  'over',
  'please',
  'she',
  'so',
  'some',
  'that',
  'the',
  'their',
  'them',
  'there',
  'these',
  'they',
  'this',
  'to',
  'up',
  'us',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'you',
  'your',
])

function asRecord(value: unknown): MetadataRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as MetadataRecord
}

function uniqueStrings(values: Array<string | null | undefined>, limit?: number): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(trimmed)
    if (limit && normalized.length >= limit) {
      break
    }
  }

  return normalized
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value
  }
  return `${value.slice(0, limit - 1).trim()}…`
}

function normalizeSentence(sentence: string): string {
  return sanitizeContentForStorage(sentence).replace(/\s+/g, ' ').trim()
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9&@#.+/-]+/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 3 && token.length <= 32 && !STOP_WORDS.has(token))
}

function splitIntoSegments(text: string): string[] {
  const rawSegments = text
    .split(/\n{2,}|(?<=[.!?])\s+|(?<=:)\s+|(?<=;)\s+/)
    .map(segment => normalizeSentence(segment))
    .filter(Boolean)

  const meaningful = rawSegments.filter(segment => {
    if (segment.length < 24) return false
    if (segment.length > 420) return false
    return !UI_NOISE_PATTERNS.some(pattern => pattern.test(segment))
  })

  return meaningful.length > 0 ? meaningful : rawSegments.slice(0, 5)
}

function extractPatternMatches(text: string, pattern: RegExp): string[] {
  const matches = text.match(pattern) || []
  return uniqueStrings(matches)
}

function extractOrderNumbers(text: string): string[] {
  const values: string[] = []
  for (const pattern of ORDER_NUMBER_PATTERNS) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        values.push(match[1])
      }
    }
    pattern.lastIndex = 0
  }
  return uniqueStrings(values).filter(
    value => /\d/.test(value) && value.length >= 4 && value.length <= 32
  )
}

function extractDomains(urls: string[]): string[] {
  const domains = urls
    .map(url => {
      try {
        return new URL(url).hostname.replace(/^www\./i, '')
      } catch {
        return null
      }
    })
    .filter((value): value is string => Boolean(value))
  return uniqueStrings(domains)
}

function inferMerchant(
  title: string,
  domain: string | null,
  participants: string[]
): string | undefined {
  const cleanedTitle = title
    .split(TITLE_SPLITTER)[0]
    ?.replace(/\b(?:gmail|outlook|mail)\b/gi, '')
    .trim()

  if (cleanedTitle && cleanedTitle.length > 2 && !/^order confirmation$/i.test(cleanedTitle)) {
    return cleanedTitle
  }

  const participantHint = participants.find(name => name.length > 2 && !/@/.test(name))
  if (participantHint) {
    return participantHint
  }

  if (!domain) {
    return undefined
  }

  const root = domain.split('.').slice(0, -1).pop() || domain
  if (!root) {
    return undefined
  }

  return root.replace(/[-_]/g, ' ')
}

function inferContentType(input: {
  title: string
  content: string
  metadata: MetadataRecord
  domain: string | null
}): string {
  const metadataType =
    typeof input.metadata.content_type === 'string' ? input.metadata.content_type.trim() : ''
  const hintText = `${input.title} ${input.content}`.toLowerCase()
  const domain = input.domain || ''

  if (
    /email|thread|message/.test(metadataType.toLowerCase()) ||
    domain.includes('mail.google') ||
    domain.includes('outlook') ||
    /subject:|from:|to:/.test(hintText)
  ) {
    return 'email_thread'
  }

  if (/order|invoice|receipt|shipment|tracking/.test(hintText)) {
    return 'transactional_record'
  }

  if (/meeting|agenda|minutes|calendar|invite/.test(hintText)) {
    return 'meeting_note'
  }

  if (/flight|hotel|reservation|booking|itinerary/.test(hintText)) {
    return 'travel_record'
  }

  if (/github|pull request|issue|commit|repository/.test(hintText)) {
    return 'engineering_record'
  }

  if (metadataType) {
    return metadataType
  }

  return 'web_page'
}

function extractTopics(title: string, content: string, metadata: MetadataRecord): string[] {
  const existingTopics = Array.isArray(metadata.topics)
    ? metadata.topics.filter((topic): topic is string => typeof topic === 'string')
    : []
  const keyTopics = Array.isArray(metadata.key_topics)
    ? metadata.key_topics.filter((topic): topic is string => typeof topic === 'string')
    : []

  const scores = new Map<string, number>()
  const addTokens = (text: string, weight: number) => {
    for (const token of tokenize(text)) {
      const current = scores.get(token) || 0
      scores.set(token, current + weight)
    }
  }

  addTokens(title, 3)
  addTokens(content, 1)
  addTokens(typeof metadata.content_summary === 'string' ? metadata.content_summary : '', 2)

  const extracted = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, MAX_TOPICS)

  return uniqueStrings([...existingTopics, ...keyTopics, ...extracted], MAX_TOPICS)
}

function extractCategories(input: {
  contentType: string
  entities: StructuredMemoryEntities
  title: string
  content: string
  source: string
  domain: string | null
}): string[] {
  const categories: string[] = [input.contentType]
  const hintText = `${input.title} ${input.content}`.toLowerCase()

  if (input.contentType === 'email_thread' || input.domain?.includes('mail')) {
    categories.push('email', 'communication')
  }

  if (
    input.entities.orderNumbers.length > 0 ||
    input.entities.currencyAmounts.length > 0 ||
    COMMERCE_HINTS.some(hint => hintText.includes(hint))
  ) {
    categories.push('commerce', 'transaction')
  }

  if (/meeting|agenda|minutes|calendar|invite/.test(hintText)) {
    categories.push('meeting')
  }

  if (/flight|hotel|reservation|booking|itinerary/.test(hintText)) {
    categories.push('travel')
  }

  if (input.source) {
    categories.push(input.source.toLowerCase())
  }

  return uniqueStrings(categories, 12)
}

function chooseRepresentativeExcerpt(input: {
  title: string
  content: string
  metadata: MetadataRecord
  entities: StructuredMemoryEntities
}): string {
  const metadataSummary =
    typeof input.metadata.content_summary === 'string'
      ? normalizeSentence(input.metadata.content_summary)
      : ''
  const segments = splitIntoSegments(input.content)
  const titleTokens = new Set(tokenize(input.title))

  let bestSegment = metadataSummary
  let bestScore = metadataSummary ? 1 : 0

  for (const segment of segments) {
    let score = 0
    const tokens = tokenize(segment)

    for (const token of tokens) {
      if (titleTokens.has(token)) {
        score += 1.2
      }
    }

    if (input.entities.orderNumbers.some(value => segment.includes(value))) {
      score += 3
    }
    if (input.entities.currencyAmounts.some(value => segment.includes(value))) {
      score += 2
    }
    if (input.entities.dates.some(value => segment.includes(value))) {
      score += 1.5
    }
    if (COMMERCE_HINTS.some(hint => segment.toLowerCase().includes(hint))) {
      score += 1.25
    }

    score += Math.min(segment.length / 140, 1.5)

    if (score > bestScore) {
      bestScore = score
      bestSegment = segment
    }
  }

  const fallback = bestSegment || input.title || input.content
  return truncate(fallback, MAX_EXCERPT_LENGTH)
}

function buildKeyFacts(input: {
  title: string
  entities: StructuredMemoryEntities
  excerpt: string
  merchant?: string
  contentType: string
}): string[] {
  const facts: string[] = []

  if (input.merchant) {
    facts.push(`Merchant: ${input.merchant}`)
  }
  if (input.entities.orderNumbers.length > 0) {
    facts.push(`Order number: ${input.entities.orderNumbers.join(', ')}`)
  }
  if (input.entities.currencyAmounts.length > 0) {
    facts.push(`Amount: ${input.entities.currencyAmounts.join(', ')}`)
  }
  if (input.entities.dates.length > 0) {
    facts.push(`Dates: ${input.entities.dates.slice(0, 3).join(', ')}`)
  }
  if (input.entities.emails.length > 0) {
    facts.push(`Emails: ${input.entities.emails.slice(0, 3).join(', ')}`)
  }
  if (input.entities.participants.length > 0) {
    facts.push(`Participants: ${input.entities.participants.slice(0, 4).join(', ')}`)
  }
  if (input.contentType === 'email_thread' && input.title) {
    facts.push(`Subject: ${input.title}`)
  }
  if (input.excerpt) {
    facts.push(input.excerpt)
  }

  return uniqueStrings(facts, MAX_KEY_FACTS)
}

function buildStructuredSummary(input: {
  title: string
  excerpt: string
  keyFacts: string[]
  contentType: string
  merchant?: string
}): string {
  const parts: string[] = []

  if (input.title) {
    parts.push(input.title)
  }

  if (input.contentType === 'transactional_record' && input.merchant) {
    parts.push(`Transactional record involving ${input.merchant}`)
  }

  if (input.excerpt && !parts.some(part => part.toLowerCase() === input.excerpt.toLowerCase())) {
    parts.push(input.excerpt)
  }

  for (const fact of input.keyFacts.slice(0, 2)) {
    if (!parts.some(part => part.toLowerCase() === fact.toLowerCase())) {
      parts.push(fact)
    }
  }

  const summary = truncate(uniqueStrings(parts).join('. '), MAX_SUMMARY_LENGTH)
  return summary || input.excerpt || input.title
}

function buildSearchableTerms(input: {
  title: string
  topics: string[]
  categories: string[]
  entities: StructuredMemoryEntities
  merchant?: string
  domain: string | null
}): string[] {
  const titleTerms = tokenize(input.title)
  const entityTerms = [
    ...input.entities.orderNumbers,
    ...input.entities.currencyAmounts,
    ...input.entities.emails,
    ...input.entities.participants,
    ...input.entities.dates,
    ...input.entities.phoneNumbers,
  ]

  const domainTerms = input.domain ? input.domain.split(/[.-]/g) : []

  return uniqueStrings(
    [
      ...titleTerms,
      ...input.topics,
      ...input.categories,
      ...entityTerms.map(term => term.toLowerCase()),
      ...domainTerms.map(term => term.toLowerCase()),
      input.merchant?.toLowerCase(),
      input.domain?.toLowerCase(),
    ],
    MAX_SEARCHABLE_TERMS
  )
}

function buildRetrievalTextFromParts(input: {
  title: string
  structuredSummary: string
  keyFacts: string[]
  searchableTerms: string[]
  excerpt: string
  content: string
}): string {
  return truncate(
    [
      input.title ? `Title: ${input.title}` : '',
      input.structuredSummary ? `Summary: ${input.structuredSummary}` : '',
      input.keyFacts.length > 0 ? `Key facts: ${input.keyFacts.join(' | ')}` : '',
      input.searchableTerms.length > 0 ? `Search terms: ${input.searchableTerms.join(', ')}` : '',
      input.excerpt ? `Excerpt: ${input.excerpt}` : '',
      input.content ? `Content: ${truncate(input.content, 1200)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    MAX_RETRIEVAL_TEXT_LENGTH
  )
}

export function normalizePageMetadata(value: unknown): MetadataRecord {
  return asRecord(value)
}

export function extractStructuredMemoryData(input: StructuredMemoryInput): StructuredMemoryData {
  const metadata = asRecord(input.metadata)
  const flattenedMetadata = {
    ...asRecord(metadata.page_metadata),
    ...metadata,
  }
  delete flattenedMetadata.page_metadata

  const title = sanitizeContentForStorage(input.title || '')
  const content = sanitizeContentForStorage(input.content || '')
  const source = typeof input.source === 'string' ? input.source : ''
  const url =
    typeof input.url === 'string' && input.url.trim() !== ''
      ? input.url.trim()
      : typeof flattenedMetadata.url === 'string'
        ? flattenedMetadata.url
        : ''

  const urls = uniqueStrings([
    url,
    ...extractPatternMatches(content, URL_REGEX),
    ...extractPatternMatches(
      typeof flattenedMetadata.content_summary === 'string'
        ? flattenedMetadata.content_summary
        : '',
      URL_REGEX
    ),
  ])
  const domains = extractDomains(urls)
  const participants = Array.isArray(flattenedMetadata.participants)
    ? flattenedMetadata.participants.filter(
        (participant): participant is string => typeof participant === 'string'
      )
    : []
  const entities: StructuredMemoryEntities = {
    emails: extractPatternMatches(content, EMAIL_REGEX),
    urls,
    domains,
    orderNumbers: extractOrderNumbers(content),
    currencyAmounts: extractPatternMatches(content, MONEY_REGEX),
    dates: extractPatternMatches(content, DATE_REGEX),
    phoneNumbers: extractPatternMatches(content, PHONE_REGEX),
    participants: uniqueStrings(participants),
  }

  const domain = domains[0] || null
  const contentType = inferContentType({
    title,
    content,
    metadata: flattenedMetadata,
    domain,
  })
  const merchant = inferMerchant(title, domain, entities.participants)
  const excerpt = chooseRepresentativeExcerpt({
    title,
    content,
    metadata: flattenedMetadata,
    entities,
  })
  const topics = extractTopics(title, content, flattenedMetadata)
  const categories = extractCategories({
    contentType,
    entities,
    title,
    content,
    source,
    domain,
  })
  const keyFacts = buildKeyFacts({
    title,
    entities,
    excerpt,
    merchant,
    contentType,
  })
  const structuredSummary = buildStructuredSummary({
    title,
    excerpt,
    keyFacts,
    contentType,
    merchant,
  })
  const searchableTerms = buildSearchableTerms({
    title,
    topics,
    categories,
    entities,
    merchant,
    domain,
  })
  const retrievalText = buildRetrievalTextFromParts({
    title,
    structuredSummary,
    keyFacts,
    searchableTerms,
    excerpt,
    content,
  })

  const structured: StructuredMemoryData = {
    ingestionVersion: INGESTION_VERSION,
    contentType,
    structuredSummary,
    representativeExcerpt: excerpt,
    keyFacts,
    topics,
    categories,
    searchableTerms,
    extractedEntities: entities,
    retrievalText,
  }

  if (merchant || entities.orderNumbers.length > 0 || entities.currencyAmounts.length > 0) {
    structured.commerce = {
      merchant,
      orderNumbers: entities.orderNumbers,
      currencyAmounts: entities.currencyAmounts,
    }
  }

  return structured
}

export function buildMemoryRetrievalText(input: RetrievalTextInput): string {
  const metadata = normalizePageMetadata(input.pageMetadata)
  const structuredSummary =
    typeof metadata.structuredSummary === 'string' ? metadata.structuredSummary : ''
  const representativeExcerpt =
    typeof metadata.representativeExcerpt === 'string' ? metadata.representativeExcerpt : ''
  const keyFacts = Array.isArray(metadata.keyFacts)
    ? metadata.keyFacts.filter((fact): fact is string => typeof fact === 'string')
    : []
  const searchableTerms = Array.isArray(metadata.searchableTerms)
    ? metadata.searchableTerms.filter((term): term is string => typeof term === 'string')
    : []
  const retrievalText = typeof metadata.retrievalText === 'string' ? metadata.retrievalText : ''

  if (retrievalText) {
    return retrievalText
  }

  return buildRetrievalTextFromParts({
    title: sanitizeContentForStorage(input.title || ''),
    structuredSummary,
    keyFacts,
    searchableTerms,
    excerpt: representativeExcerpt,
    content: sanitizeContentForStorage(input.content || ''),
  })
}

export function buildMemoryPreviewText(input: RetrievalTextInput): string {
  const metadata = normalizePageMetadata(input.pageMetadata)
  const previewCandidates = [
    typeof metadata.structuredSummary === 'string' ? metadata.structuredSummary : '',
    typeof metadata.representativeExcerpt === 'string' ? metadata.representativeExcerpt : '',
    typeof metadata.content_summary === 'string' ? metadata.content_summary : '',
    input.content || '',
    input.title || '',
  ]

  const preview = uniqueStrings(previewCandidates, 1)[0] || ''
  return truncate(preview, 400)
}

export class MemoryStructureService {
  extract(input: StructuredMemoryInput): StructuredMemoryData {
    return extractStructuredMemoryData(input)
  }

  buildRetrievalText(input: RetrievalTextInput): string {
    return buildMemoryRetrievalText(input)
  }

  buildPreviewText(input: RetrievalTextInput): string {
    return buildMemoryPreviewText(input)
  }
}

export const memoryStructureService = new MemoryStructureService()
