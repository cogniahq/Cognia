export interface SlackUrlVerificationEnvelope {
  type: 'url_verification'
  challenge?: string
}

export interface SlackEventEnvelope {
  type: 'event_callback'
  team_id: string
  event_id: string
  event_time?: number
  event: SlackMessageEvent | SlackAppMentionEvent | Record<string, unknown>
  authorizations?: Array<{
    team_id?: string
    user_id?: string
    is_bot?: boolean
  }>
}

export interface SlackMessageEvent {
  type: 'message'
  channel: string
  user?: string
  text?: string
  ts: string
  thread_ts?: string
  channel_type?: string
  subtype?: string
  bot_id?: string
}

export interface SlackAppMentionEvent {
  type: 'app_mention'
  channel: string
  user?: string
  text?: string
  ts: string
  thread_ts?: string
  subtype?: string
  bot_id?: string
}

export interface SupportedSlackBotEvent {
  teamId: string
  eventId: string
  channelId: string
  userId: string
  text: string
  ts: string
  threadTs?: string
  channelType?: string
  trigger: 'app_mention' | 'direct_message'
}

interface SlackBotEventCandidate {
  type?: string
  channel?: string
  user?: string
  text?: string
  ts?: string
  thread_ts?: string
  channel_type?: string
  subtype?: string
  bot_id?: string
}

export function isSlackUrlVerificationEnvelope(
  payload: unknown
): payload is SlackUrlVerificationEnvelope {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      (payload as { type?: unknown }).type === 'url_verification'
  )
}

export function extractSupportedSlackBotEvent(payload: unknown): SupportedSlackBotEvent | null {
  if (!payload || typeof payload !== 'object') return null
  const envelope = payload as Partial<SlackEventEnvelope>
  if (envelope.type !== 'event_callback' || !envelope.team_id || !envelope.event_id) {
    return null
  }

  const event = envelope.event as SlackBotEventCandidate | undefined
  if (!event || typeof event !== 'object') return null
  if (!event.channel || !event.ts || !event.user) return null
  if (event.bot_id || event.subtype === 'bot_message') return null
  if (event.subtype && event.subtype !== 'file_share') return null

  if (event.type === 'app_mention') {
    return {
      teamId: envelope.team_id,
      eventId: envelope.event_id,
      channelId: event.channel,
      userId: event.user,
      text: cleanSlackPrompt(event.text ?? ''),
      ts: event.ts,
      threadTs: event.thread_ts,
      channelType: event.channel_type,
      trigger: 'app_mention',
    }
  }

  if (event.type === 'message' && event.channel_type === 'im') {
    return {
      teamId: envelope.team_id,
      eventId: envelope.event_id,
      channelId: event.channel,
      userId: event.user,
      text: cleanSlackPrompt(event.text ?? ''),
      ts: event.ts,
      threadTs: event.thread_ts,
      channelType: event.channel_type,
      trigger: 'direct_message',
    }
  }

  return null
}

export function cleanSlackPrompt(text: string): string {
  return text
    .replace(/<@[A-Z0-9]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
