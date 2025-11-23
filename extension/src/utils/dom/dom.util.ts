import { sanitizeText } from '@/utils/text'

const SENSITIVE_SELECTORS = [
  'input[type="password"]',
  'input[autocomplete*="password"]',
  'input[autocomplete*="credit-card"]',
  'input[autocomplete*="cc-"]',
  'input[name*="password" i]',
  'input[name*="passwd" i]',
  'input[name*="pwd" i]',
  'input[name*="credit" i]',
  'input[name*="card" i]',
  'input[name*="cvv" i]',
  'input[name*="cvc" i]',
  'input[name*="ssn" i]',
  'input[name*="social" i]',
  'input[name*="account" i]',
  'input[name*="routing" i]',
  'input[id*="password" i]',
  'input[id*="passwd" i]',
  'input[id*="pwd" i]',
  'input[id*="credit" i]',
  'input[id*="card" i]',
  'input[id*="cvv" i]',
  'input[id*="cvc" i]',
  'input[id*="ssn" i]',
  'input[id*="social" i]',
  'input[id*="account" i]',
  'input[id*="routing" i]',
  'textarea[name*="password" i]',
  'textarea[name*="passwd" i]',
  'textarea[id*="password" i]',
  'textarea[id*="passwd" i]',
]

const WEB_NOISE_SELECTORS = [
  'script[src*="analytics"]',
  'script[src*="gtag"]',
  'script[src*="gtm"]',
  'script[src*="facebook"]',
  'script[src*="tracking"]',
  'iframe[src*="facebook"]',
  'iframe[src*="twitter"]',
  'iframe[src*="instagram"]',
  'iframe[src*="youtube"]',
  'iframe[src*="analytics"]',
  '[class*="cookie"]',
  '[class*="gdpr"]',
  '[class*="privacy-notice"]',
  '[class*="newsletter"]',
  '[class*="subscribe"]',
  '[class*="social-share"]',
  '[class*="share-buttons"]',
  '[class*="related-articles"]',
  '[class*="trending"]',
  '[class*="recommended"]',
  '[id*="cookie"]',
  '[id*="gdpr"]',
  '[id*="privacy-notice"]',
  '[id*="newsletter"]',
  '[id*="subscribe"]',
  '[id*="social-share"]',
  '[id*="share-buttons"]',
  '[id*="related-articles"]',
  '[id*="trending"]',
  '[id*="recommended"]',
]

/**
 * Removes tracking scripts, pixels, and noise elements from the DOM.
 * WARNING: This function modifies the element in place. Only call on clones, never on the actual DOM.
 * @param element - Element or Document to clean (must be a clone, not the actual DOM)
 */
export function cleanWebPageContent(element: Element | Document): void {
  if (!element) return

  WEB_NOISE_SELECTORS.forEach(selector => {
    try {
      const noiseElements = element.querySelectorAll(selector)
      noiseElements.forEach(el => {
        el.remove()
      })
    } catch (_error) {}
  })

  const trackingScripts = element.querySelectorAll('script')
  trackingScripts.forEach(script => {
    const src = script.getAttribute('src') || ''
    const content = script.textContent || ''
    if (
      src.includes('analytics') ||
      src.includes('gtag') ||
      src.includes('gtm') ||
      src.includes('facebook') ||
      src.includes('tracking') ||
      content.includes('analytics') ||
      content.includes('gtag') ||
      content.includes('gtm') ||
      content.includes('facebook') ||
      content.includes('tracking')
    ) {
      script.remove()
    }
  })

  const trackingPixels = element.querySelectorAll(
    'img[src*="pixel"], img[src*="tracking"], img[src*="analytics"]'
  )
  trackingPixels.forEach(img => {
    img.remove()
  })
}

/**
 * Removes or redacts sensitive form elements (passwords, credit cards, etc.) from the DOM.
 * WARNING: This function modifies the element in place. Only call on clones, never on the actual DOM.
 * @param element - Element or Document to sanitize (must be a clone, not the actual DOM)
 */
export function removeSensitiveElements(element: Element | Document): void {
  if (!element) return

  SENSITIVE_SELECTORS.forEach(selector => {
    try {
      const sensitiveElements = element.querySelectorAll(selector)
      sensitiveElements.forEach(el => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.value = ''
          el.setAttribute('data-cognia-redacted', 'true')
        }
        if (el.parentElement) {
          const label = el.parentElement.querySelector('label')
          if (label) {
            label.textContent = label.textContent?.replace(/\S+/g, '[REDACTED]') || ''
          }
        }
      })
    } catch (_error) {}
  })
}

/**
 * Sanitizes element content by cloning it first, then removing sensitive data.
 * Safe to call on actual DOM elements as it works on a clone.
 * @param element - Element to sanitize (can be actual DOM, will be cloned internally)
 * @returns Sanitized text content
 */
export function sanitizeElementContent(element: Element): string {
  if (!element) return ''

  const clone = element.cloneNode(true) as Element
  removeSensitiveElements(clone)
  cleanWebPageContent(clone)

  let text = clone.textContent || ''
  text = sanitizeText(text)

  return text
}
