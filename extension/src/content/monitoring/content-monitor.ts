import { extractVisibleText } from '../extraction/text-extractor'

let lastUrl = location.href
let lastTitle = document.title
let lastContent = ''
let lastContentHash = ''

function calculateContentHash(content: string): string {
  let hash = 0
  if (content.length === 0) return hash.toString()
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString()
}

function calculateContentSimilarity(content1: string, content2: string): number {
  if (!content1 || !content2) return 0

  const words1 = content1
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
  const words2 = content2
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)

  if (words1.length === 0 || words2.length === 0) return 0

  const set1 = new Set(words1)
  const set2 = new Set(words2)

  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])

  return intersection.size / union.size
}

const CONTENT_CHANGE_THRESHOLD = 0.1

export function hasContentChanged(): boolean {
  const currentUrl = location.href
  const currentTitle = document.title
  const currentContent = extractVisibleText()
  const currentContentHash = calculateContentHash(currentContent)

  const urlChanged = currentUrl !== lastUrl
  const titleChanged = currentTitle !== lastTitle

  const contentHashChanged = currentContentHash !== lastContentHash

  const contentSimilarity = calculateContentSimilarity(currentContent, lastContent)
  const contentSignificantlyChanged = contentSimilarity < 1 - CONTENT_CHANGE_THRESHOLD

  const shouldCapture =
    urlChanged || titleChanged || contentHashChanged || contentSignificantlyChanged

  if (shouldCapture) {
    lastUrl = currentUrl
    lastTitle = currentTitle
    lastContent = currentContent
    lastContentHash = currentContentHash
  }

  return shouldCapture
}

export function updateLastContent() {
  lastUrl = location.href
  lastTitle = document.title
  lastContent = extractVisibleText()
  lastContentHash = calculateContentHash(lastContent)
}
