import { sanitizeText } from '@/utils/text'
import { removeSensitiveElements, cleanWebPageContent } from '@/utils/dom'

export function extractVisibleText(): string {
  try {
    if (!document.body || !document.body.textContent) {
      return sanitizeText(document.documentElement?.textContent || document.title || '')
    }
    const bodyClone = document.body.cloneNode(true) as HTMLElement
    removeSensitiveElements(bodyClone)
    cleanWebPageContent(bodyClone)
    const walker = document.createTreeWalker(bodyClone, NodeFilter.SHOW_TEXT, {
      acceptNode: node => {
        try {
          const parent = node.parentElement
          if (!parent) return NodeFilter.FILTER_REJECT
          if (parent.closest('input[type="password"], input[autocomplete*="password"]')) {
            return NodeFilter.FILTER_REJECT
          }
          if (parent.closest('[style*="display: none"], [style*="display:none"]')) {
            return NodeFilter.FILTER_REJECT
          }
          if (parent.closest('[style*="visibility: hidden"], [style*="visibility:hidden"]')) {
            return NodeFilter.FILTER_REJECT
          }
          return NodeFilter.FILTER_ACCEPT
        } catch (_error) {
          return NodeFilter.FILTER_ACCEPT
        }
      },
    })
    const textNodes: string[] = []
    let node
    while ((node = walker.nextNode())) {
      try {
        const text = node.textContent?.trim()
        if (text && text.length > 0) {
          textNodes.push(text)
        }
      } catch (_error) {
        continue
      }
    }
    return sanitizeText(textNodes.join(' '))
  } catch (_error) {
    try {
      const text =
        document.body?.textContent || document.documentElement?.textContent || document.title || ''
      return sanitizeText(text)
    } catch (_fallbackError) {
      return sanitizeText(document.title || window.location.href)
    }
  }
}

function cleanText(text: string): string {
  return (
    text
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/[—–]/g, '-')
      .replace(/\.{3,}/g, '...')
      .replace(/[!]{2,}/g, '!')
      .replace(/[?]{2,}/g, '?')
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([.,!?;:])\s{2,}/g, '$1 ')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .replace(/^\s+|\s+$/gm, '')
      .trim()
  )
}

function isBoilerplateText(text: string): boolean {
  const boilerplatePatterns = [
    /^(cookie|privacy|terms|subscribe|newsletter|follow us|share|like|comment)/i,
    /^(advertisement|sponsored|promo|banner)/i,
    /^(menu|navigation|home|about|contact|search)/i,
    /^(copyright|©|all rights reserved)/i,
    /^(loading|please wait|error|404|not found)/i,
    /^(login|sign in|register|sign up|logout)/i,
    /^(skip to|jump to|table of contents)/i,
    /^(read more|continue reading|show more|expand|view more)/i,
    /^(related|recommended|trending|popular)/i,
    /^(tags|categories|archive|older|newer)/i,
    /^(social media|connect with|follow|share on|tweet|like on|follow on)/i,
    /^(disclaimer|legal notice|terms of service)/i,
    /^(this website uses cookies|we use cookies|cookie consent|cookie policy)/i,
    /^(accept|decline|agree|disagree|accept all|reject all)/i,
    /^(subscribe to our|get updates|stay informed|sign up for|join our)/i,
    /^(share this|tell your friends|spread the word|share now)/i,
    /^(ad blocker|disable ad blocker)/i,
    /^(javascript|enable javascript)/i,
    /^(browser|upgrade|update)/i,
    /^(mobile|desktop|tablet)/i,
    /^(share button|share icon|social share|share via)/i,
    /^(cookie banner|cookie notice|cookie popup|cookie dialog)/i,
    /^(newsletter signup|email signup|subscribe form|signup form)/i,
    /^(read more link|continue reading link|show more button)/i,
    /^(facebook|twitter|linkedin|instagram|pinterest|reddit)\s+(?:share|like|follow|connect)/i,
    /^(click|tap)\s+(?:here|now)\s+(?:to|for)/i,
  ]
  const shortText = text.toLowerCase().trim()
  if (shortText.length < 20) return true
  return boilerplatePatterns.some(pattern => pattern.test(shortText))
}

export function extractMeaningfulContent(): string {
  try {
    if (!document.body || !document.body.innerHTML) {
      return extractVisibleText()
    }
    const boilerplateSelectors = [
      'nav',
      'header',
      'footer',
      '.nav',
      '.navigation',
      '.menu',
      '.sidebar',
      '.advertisement',
      '.ads',
      '.ad',
      '.promo',
      '.banner',
      '.cookie-notice',
      '.newsletter',
      '.subscribe',
      '.social-share',
      '.share-buttons',
      '.comments',
      '.comment',
      '.related',
      '.recommended',
      '.trending',
      '.breadcrumb',
      '.breadcrumbs',
      '.pagination',
      '.pager',
      '.search',
      '.search-box',
      '.search-form',
      '.filter',
      '.sort',
      '.modal',
      '.popup',
      '.overlay',
      '.tooltip',
      '.dropdown',
      '.cookie-banner',
      '.gdpr',
      '.privacy-notice',
      '.terms',
      '.author-bio',
      '.author-info',
      '.author-box',
      '.byline',
      '.tags',
      '.categories',
      '.meta',
      '.metadata',
      '.date',
      '.social-media',
      '.social-links',
      '.follow-us',
      '.connect',
      '.newsletter-signup',
      '.email-signup',
      '.subscription',
      '.sponsor',
      '.sponsored',
      '.affiliate',
      '.partner',
      '.disclaimer',
      '.legal',
      '.terms-of-service',
      '.privacy-policy',
    ]
    const tempDiv = document.createElement('div')
    try {
      tempDiv.innerHTML = document.body.innerHTML
    } catch (_error) {
      tempDiv.textContent = document.body.textContent || ''
    }
    removeSensitiveElements(tempDiv)
    cleanWebPageContent(tempDiv)
    boilerplateSelectors.forEach(selector => {
      try {
        const elements = tempDiv.querySelectorAll(selector)
        elements.forEach(el => el.remove())
      } catch (_error) {}
    })
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post',
      '.article',
      '.entry',
      '.story',
      '.blog-post',
      '.news-article',
      '.tutorial',
      '.documentation',
      '.guide',
      '.how-to',
      '.explanation',
      '.text',
      '.body',
      '.main-content',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.page-content',
      '.content-body',
    ]
    let meaningfulContent = ''
    for (const selector of contentSelectors) {
      try {
        const element = tempDiv.querySelector(selector)
        if (element) {
          const text = sanitizeText(element.textContent || '')
          if (text && text.length > 100) {
            meaningfulContent = text
            break
          }
        }
      } catch (_error) {
        continue
      }
    }
    if (!meaningfulContent) {
      try {
        const meaningfulElements = tempDiv.querySelectorAll(
          'p, h1, h2, h3, h4, h5, h6, li, blockquote, div'
        )
        const paragraphs = Array.from(meaningfulElements)
          .map(el => {
            try {
              return sanitizeText(el.textContent || '')
            } catch (_error) {
              return ''
            }
          })
          .filter(text => text && text.length > 30 && !isBoilerplateText(text))
          .join(' ')
        if (paragraphs.length > 200) {
          meaningfulContent = paragraphs
        }
      } catch (_error) {}
    }
    if (!meaningfulContent) {
      try {
        meaningfulContent = sanitizeText(tempDiv.textContent || '')
      } catch (_error) {
        meaningfulContent = extractVisibleText()
      }
    }
    return sanitizeText(cleanText(meaningfulContent).substring(0, 50000))
  } catch (_error) {
    return extractVisibleText()
  }
}

export function extractFullContent(): string {
  const fullText = extractVisibleText()
  const truncated = fullText.length > 5000 ? fullText.substring(0, 5000) + '...' : fullText
  return sanitizeText(truncated)
}
