const HIGHLIGHT_SNIPPET_PARAM = "cognia_hl"
const HIGHLIGHT_QUERY_PARAM = "cognia_q"
const HIGHLIGHT_PAGE_PARAM = "cognia_p"
const HIGHLIGHT_TITLE_PARAM = "cognia_t"
const MAX_HIGHLIGHT_SNIPPET_LENGTH = 480

const QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "show",
  "that",
  "the",
  "this",
  "to",
  "what",
  "where",
  "which",
  "who",
  "why",
  "with",
])

function normalizeCompactText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function tokenizeQuery(query) {
  return Array.from(
    new Set(
      normalizeCompactText(query)
        .toLowerCase()
        .match(/[a-z0-9-]+/g)
        ?.filter(
          (token) => token.length >= 3 && !QUERY_STOP_WORDS.has(token)
        ) || []
    )
  )
}

function splitIntoSentences(text) {
  const normalizedText = normalizeCompactText(text)
  if (!normalizedText) {
    return []
  }

  return normalizedText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function truncateSnippet(snippet) {
  const normalizedSnippet = normalizeCompactText(snippet)
  if (normalizedSnippet.length <= MAX_HIGHLIGHT_SNIPPET_LENGTH) {
    return normalizedSnippet
  }

  return `${normalizedSnippet.slice(0, MAX_HIGHLIGHT_SNIPPET_LENGTH).trim()}...`
}

function scoreSentence(sentence, queryTokens) {
  const lowerSentence = sentence.toLowerCase()
  const tokenHits = queryTokens.reduce(
    (count, token) => count + (lowerSentence.includes(token) ? 1 : 0),
    0
  )

  return tokenHits * 100 + Math.min(sentence.length, 180)
}

export function getOrganizationSearchOpenSnippet(input) {
  const queryTokens = tokenizeQuery(input?.query)
  const highlightText = normalizeCompactText(input?.result?.highlightText)
  const contentText = normalizeCompactText(input?.result?.content)
  const previewText = normalizeCompactText(input?.result?.contentPreview)
  const candidateText = highlightText || contentText || previewText

  if (!candidateText) {
    return ""
  }

  const sentences = splitIntoSentences(candidateText)
  if (sentences.length === 0) {
    return truncateSnippet(candidateText)
  }

  if (queryTokens.length === 0) {
    return truncateSnippet(sentences[0])
  }

  const rankedSentences = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreSentence(sentence, queryTokens),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.index - right.index
    })

  return truncateSnippet(rankedSentences[0]?.sentence || sentences[0])
}

export function buildOrganizationSearchOpenUrl(input) {
  const rawUrl = typeof input?.url === "string" ? input.url.trim() : ""
  if (!rawUrl) {
    return ""
  }

  try {
    const parsedUrl = new URL(rawUrl)
    const highlightSnippet = getOrganizationSearchOpenSnippet(input)
    const query = normalizeCompactText(input?.query)
    const title = normalizeCompactText(
      input?.result?.documentName || input?.result?.title
    )
    const pageNumber = Number(input?.result?.pageNumber)

    if (highlightSnippet) {
      parsedUrl.searchParams.set(HIGHLIGHT_SNIPPET_PARAM, highlightSnippet)
    }

    if (query) {
      parsedUrl.searchParams.set(HIGHLIGHT_QUERY_PARAM, query)
    }

    if (Number.isFinite(pageNumber) && pageNumber > 0) {
      parsedUrl.searchParams.set(
        HIGHLIGHT_PAGE_PARAM,
        String(Math.floor(pageNumber))
      )
    }

    if (title) {
      parsedUrl.searchParams.set(HIGHLIGHT_TITLE_PARAM, title)
    }

    return parsedUrl.toString()
  } catch {
    return rawUrl
  }
}
