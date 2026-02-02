import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { integrationService } from '../services/integration';
import { SyncFrequency, StorageStrategy } from '@prisma/client';

const router = Router();

/**
 * GET /api/integrations
 * List available integrations for the current user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const available = integrationService.listAvailable({
      userId: req.user!.userId,
      plan: 'free', // TODO: Get from user's plan
    });

    res.json({ success: true, data: available });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/integrations/connected
 * List user's connected integrations
 */
router.get('/connected', authenticateToken, async (req, res) => {
  try {
    const integrations = await integrationService.getUserIntegrations(req.user!.userId);
    res.json({ success: true, data: integrations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/integrations/:provider/connect
 * Start OAuth flow - returns authorization URL
 */
router.post('/:provider/connect', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.params;
    const { redirectUri } = req.body;

    if (!redirectUri) {
      return res.status(400).json({ success: false, error: 'redirectUri is required' });
    }

    // Generate state with user context
    const state = Buffer.from(
      JSON.stringify({
        userId: req.user!.userId,
        provider,
        timestamp: Date.now(),
      })
    ).toString('base64url');

    const authUrl = integrationService.getAuthUrl(provider, state, redirectUri);

    res.json({ success: true, data: { authUrl, state } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/integrations/:provider/callback
 * OAuth callback handler
 */
router.get('/:provider/callback', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ success: false, error: 'code and state are required' });
    }

    // Parse state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64url').toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid state' });
    }

    // Verify user
    if (stateData.userId !== req.user!.userId) {
      return res.status(403).json({ success: false, error: 'State mismatch' });
    }

    // Get redirect URI from frontend (should be passed or derived)
    const redirectUri = `${process.env.API_BASE_URL}/api/integrations/${provider}/callback`;

    const result = await integrationService.connectUserIntegration(
      { userId: req.user!.userId },
      {
        provider,
        code: code as string,
        redirectUri,
      }
    );

    // Redirect to frontend success page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/integrations?connected=${provider}`);
  } catch (error: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/integrations?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * GET /api/integrations/:provider
 * Get details of a connected integration
 */
router.get('/:provider', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.params;
    const integrations = await integrationService.getUserIntegrations(req.user!.userId);
    const integration = integrations.find((i) => i.provider === provider);

    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }

    res.json({ success: true, data: integration });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/integrations/:provider/config
 * Update integration settings
 */
router.put('/:provider/config', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.params;
    const { syncFrequency, storageStrategy, config } = req.body;

    const updated = await integrationService.updateUserIntegrationSettings(
      req.user!.userId,
      provider,
      {
        syncFrequency: syncFrequency as SyncFrequency,
        storageStrategy: storageStrategy as StorageStrategy,
        config,
      }
    );

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/integrations/:provider/sync
 * Trigger manual sync
 */
router.post('/:provider/sync', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.params;
    const { mode = 'incremental' } = req.body;

    const integrations = await integrationService.getUserIntegrations(req.user!.userId);
    const integration = integrations.find((i) => i.provider === provider);

    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }

    await integrationService.triggerSync(integration.id, 'user', mode);

    res.json({ success: true, message: 'Sync triggered' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/integrations/:provider
 * Disconnect integration
 */
router.delete('/:provider', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.params;

    await integrationService.disconnectUserIntegration(req.user!.userId, provider);

    res.json({ success: true, message: 'Integration disconnected' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
