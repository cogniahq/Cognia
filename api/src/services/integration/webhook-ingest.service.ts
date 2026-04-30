import { prisma } from '../../lib/prisma.lib'
import { getWebhookQueue } from '../../queues/webhook.queue'
import { logger } from '../../utils/core/logger.util'

interface IngestInput {
  provider: string
  eventId: string
  payload: unknown
  organizationId?: string | null
  userId?: string | null
  integrationId?: string | null
}

/**
 * Persist a webhook event and enqueue processing. Idempotent on
 * (provider, event_id) — a duplicate ingest returns the existing delivery
 * id without re-queuing.
 */
export async function ingestWebhookEvent(
  input: IngestInput
): Promise<{ enqueued: boolean; deliveryId: string }> {
  const existing = await prisma.webhookDelivery.findUnique({
    where: { provider_event_id: { provider: input.provider, event_id: input.eventId } },
  })
  if (existing) {
    logger.log('[webhook-ingest] duplicate event', {
      provider: input.provider,
      eventId: input.eventId,
      existingStatus: existing.status,
    })
    return { enqueued: false, deliveryId: existing.id }
  }

  const delivery = await prisma.webhookDelivery.create({
    data: {
      provider: input.provider,
      event_id: input.eventId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: input.payload as any,
      organization_id: input.organizationId ?? null,
      user_id: input.userId ?? null,
      integration_id: input.integrationId ?? null,
      status: 'pending',
    },
  })

  const q = getWebhookQueue()
  await q.add(
    'process',
    { deliveryId: delivery.id },
    {
      attempts: 10,
      backoff: { type: 'exponential', delay: 1000 }, // 1s, 2s, 4s, ... ~17min @ attempt 10
      removeOnComplete: 1000,
      removeOnFail: 5000,
    }
  )

  return { enqueued: true, deliveryId: delivery.id }
}
