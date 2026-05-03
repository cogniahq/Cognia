/**
 * PDF auto-ingestion for the content script.
 *
 * Detects when the current document is a PDF (Chrome's built-in viewer or a
 * raw .pdf navigation), extracts its text via PDF.js running in fake-worker
 * mode (the worker module is imported for side effects so all parsing happens
 * on the main thread — Web Workers are awkward to load from content scripts),
 * and ships the result through the existing CAPTURE_CONTEXT pipeline so it
 * lands in memory mesh just like an HTML page.
 */

import { runtime } from '@/lib/browser'
import { MESSAGE_TYPES } from '@/utils/core/constants.util'
import { sanitizeText, sanitizeContextData } from '@/utils/text'
import { scanForSecretsClient } from '@/dlp'
import type { ContextData } from '@/types/content.types'

// 20MB cap — keeps us well clear of OOM territory on huge PDFs while still
// covering the vast majority of real-world documents users open in the tab.
const MAX_PDF_BYTES = 20 * 1024 * 1024

// Per-page extraction guard. PDF detection runs at content-script load and
// can be re-triggered by SPA-style navigation observers; we only ever want a
// single capture per (url, document-instance).
let pdfCaptureStarted = false

/**
 * Heuristic PDF detection. Returns true if the current document looks like a
 * PDF being rendered directly by the browser.
 */
export function isPdfDocument(): boolean {
  try {
    if (document.contentType === 'application/pdf') return true

    const pathname = window.location.pathname
    // Strip a possible query string is unnecessary — pathname excludes it —
    // but we still want to allow `.pdf` followed by a fragment-friendly check.
    if (/\.pdf$/i.test(pathname)) return true

    // Chrome's built-in PDF viewer: <embed type="application/pdf"> as the only
    // child of <body>. Firefox's pdf.js viewer also uses an <embed> in some
    // contexts. We treat any top-level PDF embed as a PDF page.
    const embeds = document.querySelectorAll('embed[type="application/pdf"]')
    if (embeds.length > 0) return true

    return false
  } catch {
    return false
  }
}

/**
 * Pulls the PDF bytes for the current URL. Returns null on any failure
 * (network, size cap, abort) so callers can bail silently.
 */
async function fetchPdfBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, { credentials: 'include' })
    if (!response.ok) return null

    const contentLength = response.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_PDF_BYTES) {
      return null
    }

    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_PDF_BYTES) {
      return null
    }
    return buffer
  } catch {
    return null
  }
}

/**
 * Derives a human-friendly title from the URL's filename when the PDF metadata
 * doesn't carry an explicit /Title entry.
 */
function deriveTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1] || parsed.hostname
    const decoded = decodeURIComponent(last).replace(/\.pdf$/i, '')
    return sanitizeText(decoded || parsed.hostname)
  } catch {
    return 'PDF document'
  }
}

interface PdfExtractionResult {
  text: string
  pageCount: number
  title: string
  author: string
}

/**
 * Loads the PDF with PDF.js and concatenates the text content of every page.
 * Returns null on any unrecoverable failure (encrypted, corrupt, etc.).
 */
async function extractPdfText(
  buffer: ArrayBuffer,
  url: string
): Promise<PdfExtractionResult | null> {
  try {
    // Lazy-load PDF.js so the (large) parser modules only land in memory when
    // we actually have a PDF to process. The worker module is imported for
    // its side effect: it sets globalThis.pdfjsWorker, which switches PDF.js
    // into fake-worker mode (no real Web Worker spawned). This sidesteps the
    // MV3 hassle of hosting a worker as a web_accessible_resource.
    const [pdfjsLib] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.mjs'),
    ])

    const loadingTask = pdfjsLib.getDocument({
      data: buffer,
      // Disable network features we don't need for in-memory parsing.
      disableAutoFetch: true,
      disableStream: true,
      // Silence verbose warnings about missing CMap/standard font URLs in the
      // extension context — text extraction does not require glyph rendering.
      verbosity: 0,
    })

    const pdf = await loadingTask.promise
    const pageCount = pdf.numPages

    const pageTexts: string[] = []
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const items = textContent.items as Array<{ str?: string; hasEOL?: boolean }>
        const pageText = items
          .map(item => {
            if (typeof item.str !== 'string') return ''
            return item.hasEOL ? item.str + '\n' : item.str
          })
          .join(' ')
        pageTexts.push(pageText)
        // Free per-page resources eagerly — large PDFs otherwise pile up.
        page.cleanup()
      } catch {
        // Skip unreadable pages but keep extracting the rest.
      }
    }

    let metadataTitle = ''
    let metadataAuthor = ''
    try {
      const meta = await pdf.getMetadata()
      const info = (meta?.info ?? {}) as { Title?: unknown; Author?: unknown }
      if (typeof info.Title === 'string') metadataTitle = info.Title
      if (typeof info.Author === 'string') metadataAuthor = info.Author
    } catch {
      // Metadata is optional; fall back to URL-derived title.
    }

    await pdf.destroy()

    const joinedText = pageTexts
      .join('\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim()
    if (!joinedText) return null

    return {
      text: joinedText,
      pageCount,
      title: sanitizeText(metadataTitle) || deriveTitleFromUrl(url),
      author: sanitizeText(metadataAuthor),
    }
  } catch {
    // Encrypted, corrupt, or unsupported PDFs end up here.
    return null
  }
}

function buildPdfContextData(extraction: PdfExtractionResult, url: string): ContextData {
  const meaningfulContent = sanitizeText(extraction.text)
  const wordCount = meaningfulContent.split(/\s+/).filter(Boolean).length
  // Reading time matches the heuristic used elsewhere (~220wpm).
  const readingTime = Math.max(1, Math.ceil(wordCount / 220))

  const summarySource = meaningfulContent.slice(0, 800)
  const contentSummary = sanitizeText([extraction.title, summarySource].filter(Boolean).join(' | '))

  return {
    source: 'extension',
    url,
    title: extraction.title,
    content_snippet: meaningfulContent.substring(0, 500),
    timestamp: Date.now(),
    full_content: meaningfulContent,
    meaningful_content: meaningfulContent,
    content_summary: contentSummary,
    content_type: 'pdf',
    key_topics: [],
    reading_time: readingTime,
    page_metadata: {
      author: extraction.author,
      language: document.documentElement.lang || '',
      canonical_url: url,
      page_count: extraction.pageCount,
    },
    page_structure: {
      headings: extraction.title ? [extraction.title] : [],
      links: [],
      images: [],
      forms: [],
    },
    user_activity: {
      scroll_position: 0,
      window_size: { width: window.innerWidth || 0, height: window.innerHeight || 0 },
      focused_element: '',
      time_on_page: 0,
      interaction_count: 0,
    },
    content_quality: {
      word_count: wordCount,
      has_images: false,
      has_code: false,
      has_tables: false,
      readability_score: 0,
    },
  }
}

async function isExtensionEnabled(): Promise<boolean> {
  try {
    return await new Promise(resolve => {
      runtime.sendMessage(
        { type: MESSAGE_TYPES.GET_EXTENSION_ENABLED },
        (response: { success?: boolean; enabled?: boolean } | undefined) => {
          resolve(response?.success ? response.enabled !== false : true)
        }
      )
    })
  } catch {
    return true
  }
}

async function isWebsiteBlocked(url: string): Promise<boolean> {
  try {
    return await new Promise(resolve => {
      runtime.sendMessage(
        { type: MESSAGE_TYPES.CHECK_WEBSITE_BLOCKED, url },
        (response: { success?: boolean; blocked?: boolean } | undefined) => {
          resolve(response?.success ? response.blocked === true : false)
        }
      )
    })
  } catch {
    return false
  }
}

/**
 * Top-level entry point: detect → fetch → extract → ship through the existing
 * CAPTURE_CONTEXT message bus. Safe to call multiple times; subsequent calls
 * are no-ops once a capture has started for this page view.
 */
export async function capturePdfDocument(): Promise<void> {
  if (pdfCaptureStarted) return
  pdfCaptureStarted = true

  try {
    if (!runtime.id) return

    const url = window.location.href

    const enabled = await isExtensionEnabled()
    if (!enabled) return

    const blocked = await isWebsiteBlocked(url)
    if (blocked) return

    const buffer = await fetchPdfBytes(url)
    if (!buffer) return

    const extraction = await extractPdfText(buffer, url)
    if (!extraction) return

    const contextData = sanitizeContextData(buildPdfContextData(extraction, url)) as ContextData

    // Run the same client-side DLP scan as the HTML pipeline. PDFs are a
    // common vector for accidentally captured secrets (signed URLs, internal
    // tokens pasted into a draft, etc.).
    const dlp = scanForSecretsClient(contextData.content_snippet || '')
    if (dlp.blocked) {
      console.warn('Cognia: PDF capture blocked by client-side DLP', {
        url: window.location.hostname,
        matches: dlp.matches,
      })
      return
    }

    runtime.sendMessage({ type: MESSAGE_TYPES.CAPTURE_CONTEXT, data: contextData }, _response => {
      // Capture sent silently — same pattern as the HTML path.
    })
  } catch {
    // Never let a PDF failure surface to the host page.
  }
}
