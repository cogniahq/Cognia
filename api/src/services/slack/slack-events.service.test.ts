import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanSlackPrompt,
  extractSupportedSlackBotEvent,
  isSlackUrlVerificationEnvelope,
} from './slack-events.service'

test('isSlackUrlVerificationEnvelope detects Slack URL verification payloads', () => {
  assert.equal(isSlackUrlVerificationEnvelope({ type: 'url_verification', challenge: 'abc' }), true)
  assert.equal(isSlackUrlVerificationEnvelope({ type: 'event_callback' }), false)
})

test('extractSupportedSlackBotEvent accepts app mentions and removes bot mentions', () => {
  const event = extractSupportedSlackBotEvent({
    type: 'event_callback',
    team_id: 'T123',
    event_id: 'Ev123',
    event: {
      type: 'app_mention',
      channel: 'C123',
      user: 'U123',
      text: '<@U999> what do we know about onboarding?',
      ts: '1710000000.000100',
    },
  })

  assert.deepEqual(event, {
    teamId: 'T123',
    eventId: 'Ev123',
    channelId: 'C123',
    userId: 'U123',
    text: 'what do we know about onboarding?',
    ts: '1710000000.000100',
    threadTs: undefined,
    channelType: undefined,
    trigger: 'app_mention',
  })
})

test('extractSupportedSlackBotEvent accepts direct messages', () => {
  const event = extractSupportedSlackBotEvent({
    type: 'event_callback',
    team_id: 'T123',
    event_id: 'Ev124',
    event: {
      type: 'message',
      channel_type: 'im',
      channel: 'D123',
      user: 'U123',
      text: 'summarize customer risks',
      ts: '1710000000.000200',
    },
  })

  assert.equal(event?.trigger, 'direct_message')
  assert.equal(event?.text, 'summarize customer risks')
})

test('extractSupportedSlackBotEvent ignores bot and regular channel messages', () => {
  assert.equal(
    extractSupportedSlackBotEvent({
      type: 'event_callback',
      team_id: 'T123',
      event_id: 'Ev125',
      event: {
        type: 'message',
        channel_type: 'channel',
        channel: 'C123',
        user: 'U123',
        text: 'not a mention',
        ts: '1710000000.000300',
      },
    }),
    null
  )

  assert.equal(
    extractSupportedSlackBotEvent({
      type: 'event_callback',
      team_id: 'T123',
      event_id: 'Ev126',
      event: {
        type: 'message',
        channel_type: 'im',
        channel: 'D123',
        user: 'U999',
        bot_id: 'B123',
        text: 'self',
        ts: '1710000000.000400',
      },
    }),
    null
  )
})

test('cleanSlackPrompt strips multiple mentions and normalizes whitespace', () => {
  assert.equal(cleanSlackPrompt('<@U1>   hello   <@U2>'), 'hello')
})
