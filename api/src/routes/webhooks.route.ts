import { Router, Request, Response } from 'express';
import { PluginRegistry } from '@cogniahq/integrations';
import { logger } from '../utils/core/logger.util';

const router = Router();

/**
 * POST /api/webhooks/integrations/:provider
 * Central webhook receiver for all integration providers
 */
router.post('/integrations/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;

    // Check if provider exists
    if (!PluginRegistry.has(provider)) {
      logger.warn(`Webhook received for unknown provider: ${provider}`);
      return res.status(404).json({ error: 'Unknown provider' });
    }

    const plugin = PluginRegistry.get(provider);

    // Verify webhook signature if plugin supports it
    if (plugin.verifyWebhookSignature) {
      const isValid = await plugin.verifyWebhookSignature(req);
      if (!isValid) {
        logger.warn(`Invalid webhook signature for ${provider}`);
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Log webhook receipt
    logger.log(`Received webhook from ${provider}`, {
      headers: {
        'content-type': req.headers['content-type'],
        'x-goog-resource-state': req.headers['x-goog-resource-state'],
        'x-slack-signature': req.headers['x-slack-signature'] ? '[present]' : undefined,
      },
    });

    // Queue for async processing
    // Note: In a full implementation, this would be queued via the queue manager
    // For now, we'll process inline or acknowledge

    // Respond immediately (webhooks expect fast response)
    res.status(200).json({ received: true });

    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        if (plugin.handleWebhookPayload) {
          const events = await plugin.handleWebhookPayload(
            req.body,
            req.headers as Record<string, string>
          );
          logger.log(`Processed ${events.length} events from ${provider} webhook`);

          // TODO: Queue resource sync jobs for each event
        }
      } catch (error) {
        logger.error(`Error processing ${provider} webhook`, error);
      }
    });
  } catch (error: any) {
    logger.error('Webhook handler error', error);
    // Still return 200 to prevent retries for handling errors
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

/**
 * POST /api/webhooks/integrations/:provider/:integrationId
 * Per-integration webhook (for providers that support unique webhook URLs)
 */
router.post('/integrations/:provider/:integrationId', async (req: Request, res: Response) => {
  try {
    const { provider, integrationId } = req.params;

    if (!PluginRegistry.has(provider)) {
      return res.status(404).json({ error: 'Unknown provider' });
    }

    const plugin = PluginRegistry.get(provider);

    if (plugin.verifyWebhookSignature) {
      const isValid = await plugin.verifyWebhookSignature(req);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    logger.log(`Received webhook from ${provider} for integration ${integrationId}`);

    res.status(200).json({ received: true });

    // Process asynchronously
    setImmediate(async () => {
      try {
        if (plugin.handleWebhookPayload) {
          const events = await plugin.handleWebhookPayload(
            req.body,
            req.headers as Record<string, string>
          );

          // Tag events with the integration ID
          for (const event of events) {
            event.integrationId = integrationId;
          }

          logger.log(`Processed ${events.length} events from ${provider} webhook for ${integrationId}`);
        }
      } catch (error) {
        logger.error(`Error processing ${provider} webhook for ${integrationId}`, error);
      }
    });
  } catch (error: any) {
    logger.error('Webhook handler error', error);
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

export default router;
