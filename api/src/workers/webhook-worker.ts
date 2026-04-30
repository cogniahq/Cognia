import { Worker } from 'bullmq'
import { prisma } from '../lib/prisma.lib'
import { getRedisConnection } from '../utils/core/env.util'
import { logger } from '../utils/core/logger.util'
import { WEBHOOK_QUEUE_NAME } from '../queues/webhook.queue'

let worker: Worker | null = null

export function startWebhookWorker(): void {
  if (worker) return

  worker = new Worker(
    WEBHOOK_QUEUE_NAME,
    async job => {
      const deliveryId = (job.data as { deliveryId: string }).deliveryId
      const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } })
      if (!delivery) throw new Error(`Delivery ${deliveryId} not found`)
      if (delivery.status === 'processed' || delivery.status === 'dead') return

      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { attempts: delivery.attempts + 1 },
      })

      try {
        // Real handlers would dispatch by provider. For now, log + mark processed.
        // The integrations package's plugin.handleWebhookPayload should be invoked here
        // once provider-specific dispatch is wired.
        logger.log('[webhook-worker] processed delivery', {
          deliveryId,
          provider: delivery.provider,
        })
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: { status: 'processed', processed_at: new Date(), last_error: null },
        })
      } catch (err) {
        const message = (err as Error).message ?? String(err)
        logger.warn('[webhook-worker] delivery failed', {
          deliveryId,
          attempt: job.attemptsMade,
          error: message,
        })
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: { status: 'failed', last_error: message },
        })
        throw err // BullMQ will retry per attempts/backoff
      }
    },
    { connection: getRedisConnection(true) }
  )

  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      // Final failure → DLQ
      const deliveryId = (job.data as { deliveryId?: string })?.deliveryId
      if (deliveryId) {
        await prisma.webhookDelivery
          .update({
            where: { id: deliveryId },
            data: { status: 'dead', last_error: String(err.message) },
          })
          .catch(() => {})
      }
      logger.error('[webhook-worker] dead-lettered', { deliveryId, error: err.message })
    }
  })
}
