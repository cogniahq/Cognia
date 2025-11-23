export type EmailDraftPayload = {
  subject?: string
  thread_text: string
  provider?: string
  existing_draft?: string
  participants?: string[]
  metadata?: Record<string, unknown>
  url?: string
  title?: string
}

export type EmailDraftResponse = {
  subject: string
  body: string
  summary?: string
}

export type EmailDraftContext = {
  provider: 'gmail' | 'outlook' | 'unknown'
  subject: string
  threadText: string
  participants: string[]
  composeElement?: HTMLElement
  subjectElement?: HTMLInputElement | HTMLTextAreaElement
  existingDraft?: string
}

export const EMAIL_THREAD_CHAR_LIMIT = 15000
