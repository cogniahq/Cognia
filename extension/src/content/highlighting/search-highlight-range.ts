export type SearchHighlightTextMatch = {
  rawStart: number
  rawEnd: number
  matchedCandidate: string
  sentenceText: string
}

type SearchableTextNodeEntry = {
  node: Text
  start: number
  end: number
}

function normalizeCompactText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function shouldInsertSegmentBoundarySpace(rawText: string, nextSegment: string) {
  if (!rawText || !nextSegment) {
    return false
  }

  const previousCharacter = rawText[rawText.length - 1] || ''
  const nextCharacter = nextSegment[0] || ''

  return /[a-z0-9)]/i.test(previousCharacter) && /[(a-z0-9]/i.test(nextCharacter)
}

function appendSearchableTextSegment(rawText: string, nextSegment: string) {
  if (shouldInsertSegmentBoundarySpace(rawText, nextSegment)) {
    return `${rawText} ${nextSegment}`
  }

  return `${rawText}${nextSegment}`
}

function getSearchHighlightBlockContainer(element: Element | null) {
  let currentElement = element

  while (currentElement && currentElement !== document.body) {
    const computedStyle = window.getComputedStyle(currentElement)
    if (computedStyle.display !== 'inline' && computedStyle.display !== 'contents') {
      return currentElement
    }

    currentElement = currentElement.parentElement
  }

  return element
}

function buildNormalizedTextIndex(rawText: string) {
  let normalizedText = ''
  const normalizedToRaw: number[] = []
  let previousWasWhitespace = true

  for (let index = 0; index < rawText.length; index += 1) {
    const character = rawText[index] || ''
    if (/\s/.test(character)) {
      if (previousWasWhitespace || normalizedText.length === 0) {
        continue
      }

      normalizedText += ' '
      normalizedToRaw.push(index)
      previousWasWhitespace = true
      continue
    }

    normalizedText += character.toLowerCase()
    normalizedToRaw.push(index)
    previousWasWhitespace = false
  }

  if (normalizedText.endsWith(' ')) {
    normalizedText = normalizedText.slice(0, -1)
    normalizedToRaw.pop()
  }

  return {
    normalizedText,
    normalizedToRaw,
  }
}

function trimRange(rawText: string, start: number, end: number) {
  let trimmedStart = start
  let trimmedEnd = end

  while (trimmedStart < trimmedEnd && /\s/.test(rawText[trimmedStart] || '')) {
    trimmedStart += 1
  }

  while (trimmedEnd > trimmedStart && /\s/.test(rawText[trimmedEnd - 1] || '')) {
    trimmedEnd -= 1
  }

  return {
    start: trimmedStart,
    end: trimmedEnd,
  }
}

function expandRangeToSentence(rawText: string, start: number, end: number) {
  let sentenceStart = start
  let sentenceEnd = end

  while (sentenceStart > 0) {
    const previousCharacter = rawText[sentenceStart - 1] || ''
    if (
      /[.!?]/.test(previousCharacter) ||
      previousCharacter === '\n' ||
      previousCharacter === '\r'
    ) {
      break
    }
    sentenceStart -= 1
  }

  while (sentenceEnd < rawText.length) {
    const nextCharacter = rawText[sentenceEnd] || ''
    sentenceEnd += 1
    if (/[.!?]/.test(nextCharacter)) {
      break
    }
    if (nextCharacter === '\n' || nextCharacter === '\r') {
      sentenceEnd -= 1
      break
    }
  }

  return trimRange(rawText, sentenceStart, sentenceEnd)
}

function normalizeCandidate(candidate: string) {
  return normalizeCompactText(candidate).toLowerCase()
}

export function findSearchHighlightTextMatch(
  rawText: string,
  candidates: string[]
): SearchHighlightTextMatch | null {
  const indexedText = buildNormalizedTextIndex(rawText)
  if (!indexedText.normalizedText) {
    return null
  }

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeCandidate(candidate)
    if (!normalizedCandidate) {
      continue
    }

    const matchIndex = indexedText.normalizedText.indexOf(normalizedCandidate)
    if (matchIndex === -1) {
      continue
    }

    const rawStart = indexedText.normalizedToRaw[matchIndex]
    const rawEnd =
      (indexedText.normalizedToRaw[matchIndex + normalizedCandidate.length - 1] ?? rawStart) + 1

    const sentenceRange = expandRangeToSentence(rawText, rawStart, rawEnd)

    return {
      rawStart: sentenceRange.start,
      rawEnd: sentenceRange.end,
      matchedCandidate: candidate,
      sentenceText: normalizeCompactText(rawText.slice(sentenceRange.start, sentenceRange.end)),
    }
  }

  return null
}

export function findSearchHighlightTextMatchFromSegments(segments: string[], candidates: string[]) {
  const rawText = segments.reduce(
    (combinedText, segment) => appendSearchableTextSegment(combinedText, segment),
    ''
  )

  return findSearchHighlightTextMatch(rawText, candidates)
}

function shouldSkipTextNode(node: Text) {
  const parentElement = node.parentElement
  if (!parentElement) {
    return true
  }

  const tagName = parentElement.tagName.toLowerCase()
  if (['script', 'style', 'noscript', 'iframe', 'svg', 'canvas'].includes(tagName)) {
    return true
  }

  if (parentElement.closest('[aria-hidden="true"], [hidden]')) {
    return true
  }

  const computedStyle = window.getComputedStyle(parentElement)
  if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
    return true
  }

  return !node.textContent?.trim()
}

function collectSearchableTextNodes(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const entries: SearchableTextNodeEntry[] = []
  let rawText = ''
  let previousBlockContainer: Element | null = null

  while (walker.nextNode()) {
    const textNode = walker.currentNode
    if (!(textNode instanceof Text) || shouldSkipTextNode(textNode)) {
      continue
    }

    const textValue = textNode.textContent || ''
    const currentBlockContainer = getSearchHighlightBlockContainer(textNode.parentElement)
    const nextRawText =
      previousBlockContainer &&
      currentBlockContainer &&
      previousBlockContainer !== currentBlockContainer
        ? `${rawText}\n`
        : shouldInsertSegmentBoundarySpace(rawText, textValue)
          ? `${rawText} `
          : rawText
    const start = nextRawText.length
    rawText = `${nextRawText}${textValue}`
    entries.push({
      node: textNode,
      start,
      end: rawText.length,
    })
    previousBlockContainer = currentBlockContainer
  }

  return {
    entries,
    rawText,
  }
}

function locateRangeStart(entries: SearchableTextNodeEntry[], rawIndex: number) {
  for (const entry of entries) {
    if (rawIndex < entry.end) {
      return {
        node: entry.node,
        offset: Math.max(rawIndex - entry.start, 0),
      }
    }
  }

  return null
}

function locateRangeEnd(entries: SearchableTextNodeEntry[], rawIndex: number) {
  for (const entry of entries) {
    if (rawIndex <= entry.end) {
      return {
        node: entry.node,
        offset: Math.min(Math.max(rawIndex - entry.start, 0), entry.end - entry.start),
      }
    }
  }

  const lastEntry = entries.at(-1)
  if (!lastEntry) {
    return null
  }

  return {
    node: lastEntry.node,
    offset: lastEntry.end - lastEntry.start,
  }
}

export function createRangeForSearchHighlight(
  root: ParentNode,
  candidates: string[]
): Range | null {
  const { entries, rawText } = collectSearchableTextNodes(root)
  if (entries.length === 0 || !rawText) {
    return null
  }

  const match = findSearchHighlightTextMatch(rawText, candidates)
  if (!match) {
    return null
  }

  const start = locateRangeStart(entries, match.rawStart)
  const end = locateRangeEnd(entries, match.rawEnd)
  if (!start || !end) {
    return null
  }

  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  return range
}
