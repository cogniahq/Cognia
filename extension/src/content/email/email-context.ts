import { sanitizeText } from '@/utils/text'
import type { EmailDraftContext } from '@/types/email.types'
import { EMAIL_THREAD_CHAR_LIMIT } from '@/types/email.types'

function isElementVisible(element?: Element | null): element is HTMLElement {
  if (!element) return false
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return (
    rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  )
}

export function extractEmailContext(): EmailDraftContext | null {
  const host = window.location.hostname
  if (host.includes('mail.google')) {
    return extractGmailContext()
  }
  if (
    host.includes('outlook.') ||
    host.includes('office.com') ||
    host.includes('live.com') ||
    host.includes('microsoft.com')
  ) {
    return extractOutlookContext()
  }
  return null
}

function extractGmailContext(): EmailDraftContext | null {
  const subject = sanitizeText(
    document.querySelector('h2.hP')?.textContent?.trim() ||
      (
        document.querySelector('input[name="subjectbox"]') as HTMLInputElement | null
      )?.value?.trim() ||
      document.title ||
      'No subject'
  )

  const messageNodes = Array.from(document.querySelectorAll('div[data-message-id]'))
  const threadParts = messageNodes
    .map(node => {
      const sender = sanitizeText(
        node.querySelector('.gD')?.textContent?.trim() ||
          node.querySelector('.g2')?.textContent?.trim() ||
          ''
      )
      const timestamp = sanitizeText(node.querySelector('.g3')?.textContent?.trim() || '')
      const body = sanitizeText(
        node.querySelector('.a3s')?.textContent?.trim() ||
          node
            .querySelector('.a3s')
            ?.innerHTML?.replace(/<[^>]+>/g, ' ')
            .trim() ||
          ''
      )
      if (!body) {
        return ''
      }
      return `From: ${sender || 'Unknown'} ${timestamp}\n${body}`
    })
    .filter(Boolean)

  const threadText = sanitizeText(
    threadParts.join('\n\n---\n\n').substring(0, EMAIL_THREAD_CHAR_LIMIT)
  )
  if (!threadText) {
    return null
  }

  const composeElement = Array.from(
    document.querySelectorAll('div[aria-label="Message Body"], div[role="textbox"]')
  ).find(
    el => el.getAttribute('contenteditable') === 'true' && isElementVisible(el as HTMLElement)
  ) as HTMLElement | undefined

  const subjectElement = document.querySelector(
    'input[name="subjectbox"]'
  ) as HTMLInputElement | null

  const participantSet = new Set<string>()
  document.querySelectorAll('span.gD, span.g2, span.go').forEach(el => {
    const name = el.textContent?.trim()
    if (name) {
      participantSet.add(name)
    }
  })

  return {
    provider: 'gmail',
    subject,
    threadText,
    participants: Array.from(participantSet),
    composeElement,
    subjectElement: subjectElement || undefined,
    existingDraft: composeElement?.textContent?.trim(),
  }
}

function extractOutlookContext(): EmailDraftContext | null {
  const subject = sanitizeText(
    document.querySelector('div[role="heading"][aria-level="1"]')?.textContent?.trim() ||
      (
        document.querySelector('input[aria-label*="subject"]') as HTMLInputElement | null
      )?.value?.trim() ||
      document.title ||
      'No subject'
  )

  const messageNodes = Array.from(
    document.querySelectorAll('[data-testid="messageBodyContent"], div[aria-label="Message body"]')
  )

  const threadParts = messageNodes
    .filter(node => node.getAttribute('contenteditable') !== 'true')
    .map(node => sanitizeText(node.textContent?.trim() || ''))
    .filter(Boolean)

  const threadText = sanitizeText(
    threadParts.join('\n\n---\n\n').substring(0, EMAIL_THREAD_CHAR_LIMIT)
  )
  if (!threadText) {
    return null
  }

  const composeElement = Array.from(
    document.querySelectorAll('div[aria-label="Message body"]')
  ).find(
    el => el.getAttribute('contenteditable') === 'true' && isElementVisible(el as HTMLElement)
  ) as HTMLElement | undefined

  const subjectElement =
    (document.querySelector('input[aria-label*="subject"]') as HTMLInputElement | null) ||
    (document.querySelector('input[data-testid="subjectLine"]') as HTMLInputElement | null)

  const participantSet = new Set<string>()
  document
    .querySelectorAll('[data-testid="messageHeaderFrom"] span, span[role="presentation"]')
    .forEach(el => {
      const text = el.textContent?.trim()
      if (text) {
        participantSet.add(text)
      }
    })

  return {
    provider: 'outlook',
    subject,
    threadText,
    participants: Array.from(participantSet),
    composeElement,
    subjectElement: subjectElement || undefined,
    existingDraft: composeElement?.textContent?.trim(),
  }
}
