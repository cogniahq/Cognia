import { Queue } from 'bullmq'
import { getRedisConnection } from '../utils/core/env.util'

const QUEUE_NAME = 'webhook-delivery'

let queueInstance: Queue | null = null

export function getWebhookQueue(): Queue {
  if (queueInstance) return queueInstance
  queueInstance = new Queue(QUEUE_NAME, { connection: getRedisConnection(true) })
  return queueInstance
}

export const WEBHOOK_QUEUE_NAME = QUEUE_NAME

export interface WebhookJobData {
  deliveryId: string
}
