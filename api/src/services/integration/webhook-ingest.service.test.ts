import 'dotenv/config'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { ingestWebhookEvent } from './webhook-ingest.service'
import { prisma } from '../../lib/prisma.lib'
import { getWebhookQueue } from '../../queues/webhook.queue'

after(async () => {
  try {
    await getWebhookQueue().close()
  } catch {
    // queue may not have been instantiated in some envs
  }
  await prisma.$disconnect()
})

test('webhook-ingest: idempotent on (provider, event_id)', async () => {
  const eventId = `evt-${randomUUID()}`
  const out1 = await ingestWebhookEvent({ provider: 'test', eventId, payload: { foo: 'bar' } })
  const out2 = await ingestWebhookEvent({ provider: 'test', eventId, payload: { foo: 'bar' } })
  assert.equal(out1.enqueued, true)
  assert.equal(out2.enqueued, false)
  assert.equal(out1.deliveryId, out2.deliveryId)
})

test('webhook-ingest: persists payload', async () => {
  const out = await ingestWebhookEvent({
    provider: 'test',
    eventId: `e-${randomUUID()}`,
    payload: { ping: 1 },
  })
  const row = await prisma.webhookDelivery.findUnique({ where: { id: out.deliveryId } })
  assert.equal((row?.payload as { ping?: number } | null)?.ping, 1)
})
