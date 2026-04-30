import { Router, Request, Response } from 'express'
import { PluginRegistry, type SyncEvent } from '@cogniahq/integrations'
import { logger } from '../utils/core/logger.util'
import { ingestWebhookEvent } from '../services/integration/webhook-ingest.service'
import { prisma } from '../lib/prisma.lib'

const router = Router()

const generateFallbackEventId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

/**
 * Build a stable provider event id for dedup. Plugins return SyncEvent rows
 * which don't carry a single canonical event id, so we derive one from the
 * resource + action + timestamp tuple. Falls back to a random id when fields
 * are missing.
 */
const deriveEventId = (ev: SyncEvent): string => {
  const parts = [
    ev.externalId ?? ev.resourceId ?? '',
    ev.action ?? '',
    ev.timestamp instanceof Date ? ev.timestamp.toISOString() : String(ev.timestamp ?? ''),
  ].filter(Boolean)
  if (parts.length === 0) return generateFallbackEventId()
  return parts.join(':')
}

/**
 * POST /api/webhooks/integrations/:provider
 * Central webhook receiver for all integration providers
 */
router.post('/integrations/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params

    // Check if provider exists
    if (!PluginRegistry.has(provider)) {
      logger.warn(`Webhook received for unknown provider: ${provider}`)
      return res.status(404).json({ error: 'Unknown provider' })
    }

    const plugin = PluginRegistry.get(provider)

    // Verify webhook signature if plugin supports it
    if (plugin.verifyWebhookSignature) {
      const isValid = await plugin.verifyWebhookSignature(req)
      if (!isValid) {
        logger.warn(`Invalid webhook signature for ${provider}`)
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    // Log webhook receipt
    logger.log(`Received webhook from ${provider}`, {
      headers: {
        'content-type': req.headers['content-type'],
        'x-goog-resource-state': req.headers['x-goog-resource-state'],
        'x-slack-signature': req.headers['x-slack-signature'] ? '[present]' : undefined,
      },
    })

    // Respond immediately (webhooks expect fast response)
    res.status(200).json({ received: true })

    // Process webhook asynchronously: enqueue events into the durable
    // webhook-delivery queue (idempotent, retried with exponential backoff,
    // dead-lettered on terminal failure).
    setImmediate(async () => {
      try {
        if (!plugin.handleWebhookPayload) return
        const events: SyncEvent[] = await plugin.handleWebhookPayload(
          req.body,
          req.headers as Record<string, string>
        )
        logger.log(`Processed ${events.length} events from ${provider} webhook`)

        for (const ev of events) {
          await ingestWebhookEvent({
            provider,
            eventId: deriveEventId(ev),
            payload: ev,
          }).catch(err => logger.error('[webhook] ingest failed', { provider, error: String(err) }))
        }
      } catch (error) {
        logger.error(`Error processing ${provider} webhook`, error)
      }
    })
  } catch (error) {
    logger.error('Webhook handler error', error)
    // Still return 200 to prevent retries for handling errors
    res.status(200).json({ received: true, error: 'Processing error' })
  }
})

/**
 * POST /api/webhooks/integrations/:provider/:integrationId
 * Per-integration webhook (for providers that support unique webhook URLs)
 */
router.post('/integrations/:provider/:integrationId', async (req: Request, res: Response) => {
  try {
    const { provider, integrationId } = req.params

    if (!PluginRegistry.has(provider)) {
      return res.status(404).json({ error: 'Unknown provider' })
    }

    const plugin = PluginRegistry.get(provider)

    if (plugin.verifyWebhookSignature) {
      const isValid = await plugin.verifyWebhookSignature(req)
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    logger.log(`Received webhook from ${provider} for integration ${integrationId}`)

    res.status(200).json({ received: true })

    // Resolve integration to capture org/user scope. We probe both
    // user_integrations and organization_integrations because the same
    // provider id is used across both tables.
    setImmediate(async () => {
      try {
        if (!plugin.handleWebhookPayload) return
        const events: SyncEvent[] = await plugin.handleWebhookPayload(
          req.body,
          req.headers as Record<string, string>
        )

        // Tag events with the integration ID
        for (const event of events) {
          event.integrationId = integrationId
        }

        logger.log(
          `Processed ${events.length} events from ${provider} webhook for ${integrationId}`
        )

        const [userInteg, orgInteg] = await Promise.all([
          prisma.userIntegration
            .findUnique({ where: { id: integrationId } })
            .catch((): null => null),
          prisma.organizationIntegration
            .findUnique({ where: { id: integrationId } })
            .catch((): null => null),
        ])

        const organizationId = orgInteg?.organization_id ?? null
        const userId = userInteg?.user_id ?? null

        for (const ev of events) {
          await ingestWebhookEvent({
            provider,
            eventId: deriveEventId(ev),
            payload: ev,
            organizationId,
            userId,
            integrationId,
          }).catch(err =>
            logger.error('[webhook] ingest failed', {
              provider,
              integrationId,
              error: String(err),
            })
          )
        }
      } catch (error) {
        logger.error(`Error processing ${provider} webhook for ${integrationId}`, error)
      }
    })
  } catch (error) {
    logger.error('Webhook handler error', error)
    res.status(200).json({ received: true, error: 'Processing error' })
  }
})

export default router
