import { runtime } from '@/lib/browser'
import { MESSAGE_TYPES } from '@/utils/core/constants.util'
import { sanitizeText } from '@/utils/text'
import type { EmailDraftContext, EmailDraftPayload, EmailDraftResponse } from '@/types/email.types'
import { extractEmailContext } from './email-context'

let draftToastTimeout: ReturnType<typeof setTimeout> | null = null
let draftToastElement: HTMLDivElement | null = null
let draftPillElement: HTMLDivElement | null = null
let draftPillObserver: MutationObserver | null = null
let isDrafting = false

function isElementVisible(element?: Element | null): element is HTMLElement {
  if (!element) return false
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return (
    rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  )
}

function injectEmailDraft(
  context: EmailDraftContext,
  draft: EmailDraftResponse
): { bodyApplied: boolean; subjectApplied: boolean } {
  let subjectApplied = false
  if (context.subjectElement && draft.subject) {
    subjectApplied = setSubjectValue(context.subjectElement, draft.subject)
  }

  let bodyApplied = false
  if (context.composeElement) {
    bodyApplied = setComposeBody(context.composeElement, draft.body)
  }

  return { bodyApplied, subjectApplied }
}

function setSubjectValue(
  element: HTMLInputElement | HTMLTextAreaElement | undefined,
  value: string
): boolean {
  if (!element) {
    return false
  }
  try {
    element.focus()
    element.value = value
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  } catch (_error) {
    return false
  }
}

function setComposeBody(element: HTMLElement, body: string): boolean {
  try {
    element.focus()
    const html = convertPlainTextToHtml(body)
    element.innerHTML = html
    const inputEvent = new Event('input', { bubbles: true })
    element.dispatchEvent(inputEvent)
    const changeEvent = new Event('change', { bubbles: true })
    element.dispatchEvent(changeEvent)
    return true
  } catch (_error) {
    return false
  }
}

function convertPlainTextToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => {
      if (!line.trim()) {
        return '<div><br></div>'
      }
      return `<div>${escapeHtml(line)}</div>`
    })
    .join('')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function showDraftToast(message: string, variant: 'info' | 'success' | 'error' = 'info'): void {
  if (draftToastTimeout && draftToastElement) {
    draftToastElement.remove()
    draftToastElement = null
  }

  const toast = document.createElement('div')
  const colors: Record<typeof variant, { bg: string; text: string; border: string }> = {
    info: { bg: 'rgba(59,130,246,0.95)', text: '#ffffff', border: 'rgba(59,130,246,0.4)' },
    success: { bg: 'rgba(16,185,129,0.95)', text: '#ffffff', border: 'rgba(16,185,129,0.4)' },
    error: { bg: 'rgba(239,68,68,0.95)', text: '#ffffff', border: 'rgba(239,68,68,0.4)' },
  }
  const palette = colors[variant]
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    padding: 12px 16px;
    border-radius: 10px;
    background: ${palette.bg};
    color: ${palette.text};
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    border: 1px solid ${palette.border};
    max-width: 320px;
  `
  toast.textContent = message
  document.body.appendChild(toast)
  draftToastElement = toast

  draftToastTimeout = setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast)
    }
    draftToastElement = null
  }, 5000)
}

function requestDraftFromBackground(payload: EmailDraftPayload): Promise<EmailDraftResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout - background script did not respond'))
    }, 6000000)

    runtime.sendMessage({ type: MESSAGE_TYPES.DRAFT_EMAIL_REPLY, payload }, response => {
      clearTimeout(timeout)

      if (chrome.runtime.lastError) {
        reject(new Error(`Extension error: ${chrome.runtime.lastError.message}`))
        return
      }

      if (!response) {
        reject(new Error('No response from background script.'))
        return
      }

      if (response.success && response.data) {
        resolve(response.data as EmailDraftResponse)
      } else {
        reject(new Error(response.error || 'Draft request failed.'))
      }
    })
  })
}

function ensureDraftPill(composeElement: HTMLElement, _context: EmailDraftContext): void {
  if (draftPillElement && document.body.contains(draftPillElement)) {
    const existingCompose = (draftPillElement as any)._composeElement
    if (existingCompose === composeElement) {
      return
    }
    removeDraftPill()
  }

  const pill = document.createElement('div')
  pill.className = 'cognia-draft-pill'

  pill.style.cssText = `
    position: fixed;
    z-index: 10000;
    background: #f0f0f0;
    border: 1px solid #e0e0e0;
    border-radius: 16px;
    padding: 6px 12px;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #1a1a1a;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    user-select: none;
    pointer-events: auto;
    white-space: nowrap;
    line-height: 1.2;
    height: 28px;
  `

  const icon = document.createElement('img')
  icon.src = chrome.runtime.getURL('black-transparent.svg')
  icon.style.cssText = `
    width: 16px;
    height: 16px;
    display: inline-block;
    margin-top: -1px;
    transition: transform 0.3s ease;
  `

  const text = document.createElement('span')
  text.textContent = 'Draft'
  text.style.cssText = `
    display: inline-flex;
    align-items: center;
    font-size: 13px;
  `

  pill.appendChild(icon)
  pill.appendChild(text)

  pill.addEventListener('mouseenter', () => {
    pill.style.background = '#e8e8e8'
    pill.style.borderColor = '#d0d0d0'
    pill.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.12)'
  })
  pill.addEventListener('mouseleave', () => {
    pill.style.background = '#f0f0f0'
    pill.style.borderColor = '#e0e0e0'
    pill.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
  })

  pill.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()

    if (isDrafting) {
      return
    }

    isDrafting = true
    pill.style.opacity = '0.9'
    pill.style.cursor = 'wait'

    icon.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
      duration: 1000,
      iterations: Infinity,
      easing: 'linear',
    })

    text.textContent = 'Drafting...'

    try {
      const currentContext = extractEmailContext()
      if (!currentContext) {
        text.textContent = 'Draft'
        showDraftToast('No email thread detected.', 'error')
        return
      }

      const payload: EmailDraftPayload = {
        thread_text: sanitizeText(currentContext.threadText),
        subject: sanitizeText(currentContext.subject),
        provider: currentContext.provider,
        participants: currentContext.participants.map(p => sanitizeText(p)),
        existing_draft: currentContext.existingDraft
          ? sanitizeText(currentContext.existingDraft)
          : undefined,
        url: window.location.href,
        title: sanitizeText(document.title),
      }

      const draft = await requestDraftFromBackground(payload)
      const injection = injectEmailDraft(currentContext, draft)

      if (!injection.bodyApplied) {
        showDraftToast('Unable to insert draft automatically.', 'error')
        return
      }

      const subjectMessage = injection.subjectApplied ? ' and subject updated' : ''
      showDraftToast(`Draft inserted${subjectMessage}`, 'success')

      text.textContent = '✓'
      pill.style.background = '#e8f5e9'
      pill.style.borderColor = '#c8e6c9'
      pill.style.color = '#2e7d32'

      setTimeout(() => {
        removeDraftPill()
      }, 2000)
    } catch (error) {
      text.textContent = 'Draft'
      showDraftToast('Failed to draft reply.', 'error')
      console.error('[Cognia] Draft error:', error)
    } finally {
      isDrafting = false
      if (text.textContent !== '✓') {
        icon.getAnimations().forEach(anim => anim.cancel())

        pill.style.opacity = '1'
        pill.style.cursor = 'pointer'
        pill.style.background = '#f0f0f0'
        pill.style.borderColor = '#e0e0e0'
        pill.style.color = '#1a1a1a'
      }
    }
  })

  const composeContainer =
    composeElement.closest('[role="dialog"], .aYF, .ms-ComposeHeader, .ms-ComposeBody') ||
    composeElement.parentElement

  const positionPill = () => {
    if (!composeElement || !isElementVisible(composeElement)) {
      removeDraftPill()
      return
    }

    if (
      composeContainer &&
      composeContainer !== document.body &&
      composeContainer instanceof HTMLElement
    ) {
      pill.style.position = 'absolute'
      pill.style.bottom = '12px'
      pill.style.right = '12px'
      pill.style.top = 'auto'
      pill.style.left = 'auto'
      return
    }

    const rect = composeElement.getBoundingClientRect()

    pill.style.position = 'fixed'

    const offsetX = 12
    const offsetY = 8

    pill.style.top = `${rect.bottom - offsetY - 24}px`
    pill.style.left = `${rect.right - offsetX - 70}px`

    const pillRect = pill.getBoundingClientRect()
    if (pillRect.right > window.innerWidth - 10) {
      pill.style.left = `${window.innerWidth - pillRect.width - 10}px`
    }
    if (pillRect.left < 10) {
      pill.style.left = '10px'
    }
    if (pillRect.bottom > window.innerHeight - 10) {
      pill.style.top = `${window.innerHeight - pillRect.height - 10}px`
    }
    if (pillRect.top < 10) {
      pill.style.top = `${rect.top + 10}px`
    }
  }

  if (
    composeContainer &&
    composeContainer !== document.body &&
    composeContainer instanceof HTMLElement
  ) {
    const containerStyle = window.getComputedStyle(composeContainer)
    if (containerStyle.position === 'static') {
      composeContainer.style.position = 'relative'
    }
    composeContainer.appendChild(pill)
  } else {
    document.body.appendChild(pill)
  }

  positionPill()

  draftPillElement = pill

  const repositionHandler = () => {
    if (isElementVisible(composeElement)) {
      positionPill()
    } else {
      removeDraftPill()
    }
  }
  window.addEventListener('scroll', repositionHandler, true)
  window.addEventListener('resize', repositionHandler)
  ;(pill as any)._repositionHandler = repositionHandler
  ;(pill as any)._composeElement = composeElement
}

export function removeDraftPill(): void {
  if (draftPillElement) {
    const handler = (draftPillElement as any)._repositionHandler
    if (handler) {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
    draftPillElement.remove()
    draftPillElement = null
  }
}

export function initEmailDraftPill(): void {
  const host = window.location.hostname
  const isEmailSite =
    host.includes('mail.google') ||
    host.includes('outlook.') ||
    host.includes('office.com') ||
    host.includes('live.com') ||
    host.includes('microsoft.com')

  if (!isEmailSite) {
    return
  }

  const checkForComposeField = () => {
    const context = extractEmailContext()
    if (context?.composeElement && isElementVisible(context.composeElement)) {
      ensureDraftPill(context.composeElement, context)
    } else {
      removeDraftPill()
    }
  }

  document.addEventListener(
    'focusin',
    e => {
      const target = e.target as HTMLElement
      if (
        target &&
        (target.contentEditable === 'true' || target.closest('[contenteditable="true"]'))
      ) {
        setTimeout(checkForComposeField, 100)
      }
    },
    true
  )

  document.addEventListener(
    'input',
    e => {
      const target = e.target as HTMLElement
      if (target && target.contentEditable === 'true') {
        setTimeout(checkForComposeField, 100)
      }
    },
    true
  )

  if (!draftPillObserver) {
    draftPillObserver = new MutationObserver(() => {
      checkForComposeField()
    })
    draftPillObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    })
  }

  setTimeout(checkForComposeField, 500)
}
