import { Router, Request, Response } from 'express'
import { logger } from '../utils/core/logger.util'
import { verifySlackRequestSignature } from '../services/slack/slack-signature.service'
import {
  extractSupportedSlackBotEvent,
  isSlackUrlVerificationEnvelope,
} from '../services/slack/slack-events.service'
import { slackAgentService } from '../services/slack/slack-agent.service'

const router = Router()

function rawBody(req: Request): string {
  const withRawBody = req as Request & { rawBody?: string }
  return typeof withRawBody.rawBody === 'string' ? withRawBody.rawBody : JSON.stringify(req.body)
}

function verifyRequest(req: Request): boolean {
  return verifySlackRequestSignature({
    rawBody: rawBody(req),
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    signature: req.get('x-slack-signature') ?? undefined,
    timestamp: req.get('x-slack-request-timestamp') ?? undefined,
  })
}

router.post('/events', async (req: Request, res: Response) => {
  if (!process.env.SLACK_SIGNING_SECRET) {
    return res.status(503).json({ error: 'Slack signing secret is not configured' })
  }
  if (!verifyRequest(req)) {
    return res.status(401).json({ error: 'Invalid Slack signature' })
  }

  const payload = req.body
  if (isSlackUrlVerificationEnvelope(payload)) {
    return res.status(200).send(payload.challenge ?? '')
  }

  const event = extractSupportedSlackBotEvent(payload)
  res.status(200).json({ ok: true })

  if (!event) return

  setImmediate(() => {
    slackAgentService.handleEvent(event).catch(error => {
      logger.error('[slack-bot] async event processing failed', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.eventId,
      })
    })
  })
})

router.post('/interactions', async (req: Request, res: Response) => {
  if (!process.env.SLACK_SIGNING_SECRET) {
    return res.status(503).json({ error: 'Slack signing secret is not configured' })
  }
  if (!verifyRequest(req)) {
    return res.status(401).json({ error: 'Invalid Slack signature' })
  }

  let payload: unknown
  try {
    payload = typeof req.body?.payload === 'string' ? JSON.parse(req.body.payload) : req.body
  } catch {
    return res.status(400).json({ error: 'Invalid Slack interaction payload' })
  }

  res.status(200).json({ ok: true })

  setImmediate(() => {
    slackAgentService.handleInteraction(payload).catch(error => {
      logger.error('[slack-bot] async interaction processing failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    })
  })
})

export default router
