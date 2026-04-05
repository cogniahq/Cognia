const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "after",
  "are",
  "as",
  "at",
  "all",
  "any",
  "about",
  "be",
  "by",
  "document",
  "documents",
  "does",
  "do",
  "every",
  "everything",
  "find",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "mention",
  "mentions",
  "of",
  "on",
  "or",
  "reference",
  "references",
  "say",
  "says",
  "show",
  "source",
  "sources",
  "that",
  "the",
  "their",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "was",
  "with",
  "without",
])

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function getOrganizationSearchHighlightTerms(query) {
  if (typeof query !== "string") {
    return []
  }

  const tokens =
    query.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []
  const seen = new Set()
  const terms = []

  for (const token of tokens) {
    const normalized = token.toLowerCase()
    const isAcronym = /^[A-Z0-9]{2,}$/.test(token)
    const isLongEnough = normalized.length >= 3

    if (!isAcronym && !isLongEnough) {
      continue
    }

    if (STOP_WORDS.has(normalized) || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    terms.push(normalized)
  }

  return terms.sort((left, right) => right.length - left.length)
}

export function buildOrganizationSearchHighlights(text, query) {
  if (typeof text !== "string" || text.length === 0) {
    return []
  }

  const terms = getOrganizationSearchHighlightTerms(query)
  if (terms.length === 0) {
    return [{ text, isMatch: false }]
  }

  const pattern = terms
    .map(term => `\\b${escapeRegex(term)}\\b`)
    .join("|")
  const regex = new RegExp(pattern, "gi")
  const segments = []

  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index
    const matchedText = match[0]

    if (matchIndex > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, matchIndex),
        isMatch: false,
      })
    }

    segments.push({
      text: matchedText,
      isMatch: true,
    })

    lastIndex = matchIndex + matchedText.length
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isMatch: false,
    })
  }

  return segments.length > 0 ? segments : [{ text, isMatch: false }]
}
