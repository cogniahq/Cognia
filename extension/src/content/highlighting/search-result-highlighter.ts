import {
  buildSearchHighlightCandidates,
  parseSearchHighlightRequest,
} from './search-highlight-payload.js'
import { createRangeForSearchHighlight } from './search-highlight-range'

const HIGHLIGHT_OVERLAY_ID = 'cognia-search-highlight-overlay'
const HIGHLIGHT_STYLE_ID = 'cognia-search-highlight-style'
const MAX_HIGHLIGHT_RECTS = 32

let activeCleanup: (() => void) | null = null
let activeAttemptTimeout: number | null = null

type HighlightRequest = NonNullable<ReturnType<typeof parseSearchHighlightRequest>>

function clearScheduledAttempt() {
  if (activeAttemptTimeout !== null) {
    window.clearTimeout(activeAttemptTimeout)
    activeAttemptTimeout = null
  }
}

function clearActiveHighlight() {
  clearScheduledAttempt()
  if (activeCleanup) {
    activeCleanup()
    activeCleanup = null
  }
}

function ensureHighlightStyles() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) {
    return
  }

  const style = document.createElement('style')
  style.id = HIGHLIGHT_STYLE_ID
  style.textContent = `
    @keyframes cognia-highlight-pulse {
      0% { opacity: 0.24; transform: scale(1); }
      50% { opacity: 0.42; transform: scale(1.015); }
      100% { opacity: 0.24; transform: scale(1); }
    }

    .cognia-search-highlight-rect {
      position: fixed;
      pointer-events: none;
      border-radius: 6px;
      background: rgba(245, 158, 11, 0.24);
      box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.55);
      animation: cognia-highlight-pulse 1.8s ease-in-out infinite;
    }

    .cognia-search-highlight-badge {
      position: fixed;
      pointer-events: none;
      max-width: min(24rem, calc(100vw - 2rem));
      border-radius: 999px;
      background: rgba(17, 24, 39, 0.96);
      color: #fff;
      font: 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      padding: 0.45rem 0.7rem;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);
      z-index: 2147483647;
    }
  `
  document.documentElement.appendChild(style)
}

function createOverlayRoot(): HTMLDivElement {
  let root = document.getElementById(HIGHLIGHT_OVERLAY_ID) as HTMLDivElement | null

  if (!root) {
    root = document.createElement('div')
    root.id = HIGHLIGHT_OVERLAY_ID
    root.style.position = 'fixed'
    root.style.inset = '0'
    root.style.pointerEvents = 'none'
    root.style.zIndex = '2147483646'
    document.documentElement.appendChild(root)
  }

  return root
}

function removeOverlayRoot() {
  document.getElementById(HIGHLIGHT_OVERLAY_ID)?.remove()
}

function getRetryDelays() {
  const host = window.location.hostname.toLowerCase()

  if (
    host.includes('docs.google.com') ||
    host.includes('drive.google.com') ||
    host.includes('notion.so')
  ) {
    return [250, 700, 1400, 2400, 4000, 6000, 9000, 12000, 16000]
  }

  return [150, 450, 900, 1600, 2600, 4200]
}

function getCandidateRangeWithWindowFind(candidate: string): Range | null {
  const selection = window.getSelection()
  selection?.removeAllRanges()

  const find = (
    window as typeof window & {
      find?: (
        text: string,
        caseSensitive?: boolean,
        backwards?: boolean,
        wrapAround?: boolean,
        wholeWord?: boolean,
        searchInFrames?: boolean,
        showDialog?: boolean
      ) => boolean
    }
  ).find

  if (typeof find !== 'function') {
    return null
  }

  try {
    const found = find.call(window, candidate, false, false, true, false, true, false)
    if (!found || !selection || selection.rangeCount === 0) {
      selection?.removeAllRanges()
      return null
    }

    const range = selection.getRangeAt(0).cloneRange()
    selection.removeAllRanges()
    return range
  } catch {
    selection?.removeAllRanges()
    return null
  }
}

function scrollRangeIntoView(range: Range) {
  const firstRect = Array.from(range.getClientRects()).find(
    rect => rect.width > 0 && rect.height > 0
  )

  if (!firstRect) {
    return
  }

  const targetTop = Math.max(window.scrollY + firstRect.top - window.innerHeight * 0.28, 0)
  window.scrollTo({
    top: targetTop,
    behavior: 'smooth',
  })
}

function renderHighlight(range: Range, request: HighlightRequest) {
  ensureHighlightStyles()
  const root = createOverlayRoot()

  const draw = () => {
    root.replaceChildren()

    const rects = Array.from(range.getClientRects())
      .filter(rect => rect.width > 0 && rect.height > 0)
      .slice(0, MAX_HIGHLIGHT_RECTS)

    const fallbackRect = range.getBoundingClientRect()
    const effectiveRects =
      rects.length > 0
        ? rects
        : fallbackRect.width > 0 && fallbackRect.height > 0
          ? [fallbackRect]
          : []

    if (effectiveRects.length === 0) {
      return
    }

    effectiveRects.forEach(rect => {
      const overlayRect = document.createElement('div')
      overlayRect.className = 'cognia-search-highlight-rect'
      overlayRect.style.left = `${Math.max(rect.left - 3, 0)}px`
      overlayRect.style.top = `${Math.max(rect.top - 2, 0)}px`
      overlayRect.style.width = `${rect.width + 6}px`
      overlayRect.style.height = `${rect.height + 4}px`
      root.appendChild(overlayRect)
    })

    const firstRect = effectiveRects[0]
    if (firstRect) {
      const badge = document.createElement('div')
      badge.className = 'cognia-search-highlight-badge'
      badge.textContent = request.title ? `Cognia match · ${request.title}` : 'Cognia match'
      badge.style.left = `${Math.max(Math.min(firstRect.left, window.innerWidth - 260), 12)}px`
      badge.style.top = `${Math.max(firstRect.top - 42, 12)}px`
      root.appendChild(badge)
    }
  }

  draw()

  let rafId: number | null = null
  const requestDraw = () => {
    if (rafId !== null) {
      return
    }

    rafId = window.requestAnimationFrame(() => {
      rafId = null
      draw()
    })
  }

  window.addEventListener('scroll', requestDraw, true)
  window.addEventListener('resize', requestDraw)

  return () => {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId)
    }
    window.removeEventListener('scroll', requestDraw, true)
    window.removeEventListener('resize', requestDraw)
    removeOverlayRoot()
  }
}

function tryHighlightRequest(request: HighlightRequest): boolean {
  const candidates = buildSearchHighlightCandidates(request)
  const exactRange = document.body ? createRangeForSearchHighlight(document.body, candidates) : null

  if (exactRange) {
    scrollRangeIntoView(exactRange)
    activeCleanup = renderHighlight(exactRange, request)
    return true
  }

  for (const candidate of candidates) {
    const range = getCandidateRangeWithWindowFind(candidate)

    if (!range) {
      continue
    }

    scrollRangeIntoView(range)
    activeCleanup = renderHighlight(range, request)
    return true
  }

  return false
}

export function startSearchResultHighlighting() {
  const request = parseSearchHighlightRequest(window.location.href)
  if (!request) {
    return
  }

  if (request.cleanUrl !== window.location.href) {
    window.history.replaceState(window.history.state, document.title, request.cleanUrl)
  }

  clearActiveHighlight()

  const retryDelays = getRetryDelays()

  const runAttempt = (attemptIndex: number) => {
    if (tryHighlightRequest(request)) {
      return
    }

    if (attemptIndex >= retryDelays.length) {
      return
    }

    activeAttemptTimeout = window.setTimeout(() => {
      runAttempt(attemptIndex + 1)
    }, retryDelays[attemptIndex])
  }

  runAttempt(0)
}
