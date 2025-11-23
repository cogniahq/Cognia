import { sanitizeText } from '@/utils/text'

export function extractPageStructure() {
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .map(h => sanitizeText(h.textContent?.trim() || ''))
    .filter(text => text && text.length > 0)
    .slice(0, 20)
  const links = Array.from(document.querySelectorAll('a[href]'))
    .map(a => {
      const href = (a as HTMLAnchorElement).href
      const text = sanitizeText(a.textContent?.trim() || '')
      return text ? `${text} (${href})` : href
    })
    .filter(link => link.length > 0)
    .slice(0, 30)
  const images = Array.from(document.querySelectorAll('img[src]'))
    .map(img => {
      const src = (img as HTMLImageElement).src
      const alt = sanitizeText((img as HTMLImageElement).alt || '')
      return alt ? `${alt} (${src})` : src
    })
    .filter(img => img.length > 0)
    .slice(0, 20)
  const forms = Array.from(document.querySelectorAll('form'))
    .map(form => {
      const inputs = Array.from(form.querySelectorAll('input, textarea, select'))
        .map(input => {
          const inputEl = input as HTMLInputElement
          if (
            inputEl.type === 'password' ||
            inputEl.autocomplete?.includes('password') ||
            inputEl.name?.toLowerCase().includes('password') ||
            inputEl.id?.toLowerCase().includes('password')
          ) {
            return '[REDACTED: Password Field]'
          }
          if (
            inputEl.autocomplete?.includes('credit-card') ||
            inputEl.name?.toLowerCase().includes('card') ||
            inputEl.name?.toLowerCase().includes('credit') ||
            inputEl.id?.toLowerCase().includes('card') ||
            inputEl.id?.toLowerCase().includes('credit')
          ) {
            return '[REDACTED: Credit Card Field]'
          }
          return inputEl.name || inputEl.type || 'input'
        })
        .join(', ')
      return inputs ? sanitizeText(`Form with: ${inputs}`) : 'Form'
    })
    .slice(0, 10)
  const codeBlocks = Array.from(document.querySelectorAll('pre, code'))
    .map(code => sanitizeText(code.textContent?.trim() || ''))
    .filter(code => code && code.length > 10)
    .slice(0, 10)
  const tables = Array.from(document.querySelectorAll('table'))
    .map(table => {
      const headers = Array.from(table.querySelectorAll('th'))
        .map(th => sanitizeText(th.textContent?.trim() || ''))
        .filter(text => text && text.length > 0)
      return headers.length > 0
        ? sanitizeText(`Table with columns: ${headers.join(', ')}`)
        : 'Table'
    })
    .slice(0, 5)
  return { headings, links, images, forms, code_blocks: codeBlocks, tables }
}

import { extractMeaningfulContent } from './text-extractor'

export function extractContentQuality() {
  const content = extractMeaningfulContent()
  const wordCount = content.split(/\s+/).length
  const hasImages = document.querySelectorAll('img').length > 0
  const hasCode = document.querySelectorAll('pre, code').length > 0
  const hasTables = document.querySelectorAll('table').length > 0
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const avgWordsPerSentence = sentences.length > 0 ? wordCount / sentences.length : 0
  const readabilityScore = Math.max(0, Math.min(100, 100 - (avgWordsPerSentence - 10) * 2))
  return {
    word_count: wordCount,
    has_images: hasImages,
    has_code: hasCode,
    has_tables: hasTables,
    readability_score: Math.round(readabilityScore),
  }
}

export function extractUserActivity() {
  return {
    scroll_position: window.pageYOffset || document.documentElement.scrollTop,
    window_size: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    focused_element: document.activeElement?.tagName || '',
    time_on_page: Date.now() - (window as any).pageLoadTime || 0,
    interaction_count: (window as any).interactionCount || 0,
  }
}
