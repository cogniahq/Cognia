import { PrismaClient, IntegrationStatus, SyncFrequency, StorageStrategy } from '@prisma/client';
import {
  PluginRegistry,
  IntegrationQueueManager,
  createTokenEncryptor,
  type TokenSet,
  type IntegrationPlugin,
  type PluginInfo,
  type SyncJobData,
} from '@cogniahq/integrations';
import { getRedisConnection } from '../../config/redis.config';
import { logger } from '../../utils/logger.util';

const prisma = new PrismaClient();

// Token encryption key from environment
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || '';
const tokenEncryptor = ENCRYPTION_KEY ? createTokenEncryptor(ENCRYPTION_KEY) : null;

/**
 * Context for integration operations
 */
interface IntegrationContext {
  userId: string;
  organizationId?: string;
  plan?: string;
}

/**
 * Options for connecting an integration
 */
interface ConnectOptions {
  provider: string;
  code: string;
  redirectUri: string;
  config?: Record<string, unknown>;
  storageStrategy?: StorageStrategy;
  syncFrequency?: SyncFrequency;
}

/**
 * Integration service - orchestrates integration operations for Cognia
 */
export class IntegrationService {
  private queueManager: IntegrationQueueManager | null = null;
  private initialized = false;

  /**
   * Initialize the integration service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize plugin registry with configured plugins
    this.initializePlugins();

    // Initialize queue manager
    const redis = getRedisConnection();
    if (redis) {
      this.queueManager = new IntegrationQueueManager(redis);
    }

    // Sync registry with database
    await this.syncRegistryWithDatabase();

    this.initialized = true;
    logger.log('Integration service initialized');
  }

  /**
   * Initialize plugins from environment configuration
   */
  private initializePlugins(): void {
    // Google Drive
    if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
      const { GoogleDrivePlugin } = require('@cogniahq/integrations');
      PluginRegistry.register(GoogleDrivePlugin, {
        clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI || '',
      });
      logger.log('Registered Google Drive plugin');
    }

    // Add more plugins here as they're implemented
    // Slack, Notion, GitHub, etc.
  }

  /**
   * Sync plugin registry with database
   */
  private async syncRegistryWithDatabase(): Promise<void> {
    const plugins = PluginRegistry.list();

    for (const plugin of plugins) {
      const existing = await prisma.integrationRegistry.findUnique({
        where: { provider: plugin.id },
      });

      if (!existing) {
        await prisma.integrationRegistry.create({
          data: {
            provider: plugin.id,
            enabled: true,
            allowed_plans: [],
            default_config: {},
          },
        });
      }
    }

    // Load database settings into registry
    const dbEntries = await prisma.integrationRegistry.findMany();
    PluginRegistry.syncFromDatabase(
      dbEntries.map((e) => ({
        provider: e.provider,
        enabled: e.enabled,
        allowedPlans: e.allowed_plans,
        defaultConfig: e.default_config as Record<string, unknown>,
      }))
    );
  }

  /**
   * List available integrations for a context
   */
  listAvailable(context: IntegrationContext): PluginInfo[] {
    return PluginRegistry.listAvailable({ plan: context.plan });
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(provider: string, state: string, redirectUri: string): string {
    const plugin = PluginRegistry.get(provider);
    return plugin.getAuthUrl(state, redirectUri);
  }

  /**
   * Connect a user integration
   */
  async connectUserIntegration(
    context: IntegrationContext,
    options: ConnectOptions
  ): Promise<{ id: string }> {
    const plugin = PluginRegistry.get(options.provider);

    // Exchange code for tokens
    const tokens = await plugin.handleCallback(options.code, options.redirectUri);

    // Test the connection
    const isValid = await plugin.testConnection(tokens);
    if (!isValid) {
      throw new Error('Failed to verify integration connection');
    }

    // Encrypt tokens
    const encryptedAccessToken = this.encryptToken(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? this.encryptToken(tokens.refreshToken)
      : null;

    // Create or update integration
    const integration = await prisma.userIntegration.upsert({
      where: {
        user_id_provider: {
          user_id: context.userId,
          provider: options.provider,
        },
      },
      create: {
        user_id: context.userId,
        provider: options.provider,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: tokens.expiresAt,
        config: options.config || {},
        status: IntegrationStatus.ACTIVE,
        storage_strategy: options.storageStrategy || StorageStrategy.FULL_CONTENT,
        sync_frequency: options.syncFrequency || SyncFrequency.HOURLY,
      },
      update: {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: tokens.expiresAt,
        config: options.config || {},
        status: IntegrationStatus.ACTIVE,
      },
    });

    // Register webhook if supported
    if (plugin.capabilities.webhooks && plugin.registerWebhook) {
      try {
        const webhookUrl = `${process.env.API_BASE_URL}/api/webhooks/integrations/${options.provider}`;
        const registration = await plugin.registerWebhook(tokens, webhookUrl);

        await prisma.userIntegration.update({
          where: { id: integration.id },
          data: { webhook_id: registration.webhookId },
        });
      } catch (error) {
        logger.error('Failed to register webhook', error);
        // Don't fail the connection, webhooks are optional
      }
    }

    // Trigger initial sync
    if (this.queueManager) {
      await this.queueManager.addSyncJob({
        integrationId: integration.id,
        integrationType: 'user',
        provider: options.provider,
        mode: 'full',
        triggeredBy: 'initial',
        userId: context.userId,
      });
    }

    logger.log(`Connected ${options.provider} for user ${context.userId}`);

    return { id: integration.id };
  }

  /**
   * Connect an organization integration
   */
  async connectOrgIntegration(
    context: IntegrationContext,
    options: ConnectOptions
  ): Promise<{ id: string }> {
    if (!context.organizationId) {
      throw new Error('Organization ID required');
    }

    const plugin = PluginRegistry.get(options.provider);

    // Exchange code for tokens
    const tokens = await plugin.handleCallback(options.code, options.redirectUri);

    // Test the connection
    const isValid = await plugin.testConnection(tokens);
    if (!isValid) {
      throw new Error('Failed to verify integration connection');
    }

    // Encrypt tokens
    const encryptedAccessToken = this.encryptToken(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? this.encryptToken(tokens.refreshToken)
      : null;

    // Create or update integration
    const integration = await prisma.organizationIntegration.upsert({
      where: {
        organization_id_provider: {
          organization_id: context.organizationId,
          provider: options.provider,
        },
      },
      create: {
        organization_id: context.organizationId,
        provider: options.provider,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: tokens.expiresAt,
        config: options.config || {},
        status: IntegrationStatus.ACTIVE,
        storage_strategy: options.storageStrategy || StorageStrategy.FULL_CONTENT,
        sync_frequency: options.syncFrequency || SyncFrequency.HOURLY,
        connected_by: context.userId,
      },
      update: {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: tokens.expiresAt,
        config: options.config || {},
        status: IntegrationStatus.ACTIVE,
        connected_by: context.userId,
      },
    });

    // Register webhook if supported
    if (plugin.capabilities.webhooks && plugin.registerWebhook) {
      try {
        const webhookUrl = `${process.env.API_BASE_URL}/api/webhooks/integrations/${options.provider}`;
        const registration = await plugin.registerWebhook(tokens, webhookUrl);

        await prisma.organizationIntegration.update({
          where: { id: integration.id },
          data: { webhook_id: registration.webhookId },
        });
      } catch (error) {
        logger.error('Failed to register webhook', error);
      }
    }

    // Trigger initial sync
    if (this.queueManager) {
      await this.queueManager.addSyncJob({
        integrationId: integration.id,
        integrationType: 'organization',
        provider: options.provider,
        mode: 'full',
        triggeredBy: 'initial',
        organizationId: context.organizationId,
      });
    }

    logger.log(`Connected ${options.provider} for org ${context.organizationId}`);

    return { id: integration.id };
  }

  /**
   * Get user's connected integrations
   */
  async getUserIntegrations(userId: string) {
    return prisma.userIntegration.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        provider: true,
        status: true,
        storage_strategy: true,
        sync_frequency: true,
        last_sync_at: true,
        last_error: true,
        connected_at: true,
        config: true,
      },
    });
  }

  /**
   * Get organization's connected integrations
   */
  async getOrgIntegrations(organizationId: string) {
    return prisma.organizationIntegration.findMany({
      where: { organization_id: organizationId },
      select: {
        id: true,
        provider: true,
        status: true,
        storage_strategy: true,
        sync_frequency: true,
        last_sync_at: true,
        last_error: true,
        connected_at: true,
        connected_by: true,
        config: true,
      },
    });
  }

  /**
   * Disconnect a user integration
   */
  async disconnectUserIntegration(userId: string, provider: string): Promise<void> {
    const integration = await prisma.userIntegration.findUnique({
      where: {
        user_id_provider: { user_id: userId, provider },
      },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    // Unregister webhook if exists
    if (integration.webhook_id) {
      try {
        const plugin = PluginRegistry.get(provider);
        const tokens = this.getDecryptedTokens(integration);
        if (plugin.unregisterWebhook) {
          await plugin.unregisterWebhook(tokens, integration.webhook_id);
        }
      } catch (error) {
        logger.error('Failed to unregister webhook', error);
      }
    }

    // Delete integration
    await prisma.userIntegration.delete({
      where: { id: integration.id },
    });

    // Delete synced resources
    await prisma.syncedResource.deleteMany({
      where: {
        integration_id: integration.id,
        integration_type: 'user',
      },
    });

    logger.log(`Disconnected ${provider} for user ${userId}`);
  }

  /**
   * Disconnect an organization integration
   */
  async disconnectOrgIntegration(organizationId: string, provider: string): Promise<void> {
    const integration = await prisma.organizationIntegration.findUnique({
      where: {
        organization_id_provider: { organization_id: organizationId, provider },
      },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    // Unregister webhook if exists
    if (integration.webhook_id) {
      try {
        const plugin = PluginRegistry.get(provider);
        const tokens = this.getDecryptedTokens(integration);
        if (plugin.unregisterWebhook) {
          await plugin.unregisterWebhook(tokens, integration.webhook_id);
        }
      } catch (error) {
        logger.error('Failed to unregister webhook', error);
      }
    }

    // Delete integration
    await prisma.organizationIntegration.delete({
      where: { id: integration.id },
    });

    // Delete synced resources
    await prisma.syncedResource.deleteMany({
      where: {
        integration_id: integration.id,
        integration_type: 'organization',
      },
    });

    logger.log(`Disconnected ${provider} for org ${organizationId}`);
  }

  /**
   * Trigger a manual sync
   */
  async triggerSync(
    integrationId: string,
    integrationType: 'user' | 'organization',
    mode: 'full' | 'incremental' = 'incremental'
  ): Promise<void> {
    if (!this.queueManager) {
      throw new Error('Queue manager not initialized');
    }

    const integration =
      integrationType === 'user'
        ? await prisma.userIntegration.findUnique({ where: { id: integrationId } })
        : await prisma.organizationIntegration.findUnique({ where: { id: integrationId } });

    if (!integration) {
      throw new Error('Integration not found');
    }

    await this.queueManager.addSyncJob({
      integrationId,
      integrationType,
      provider: integration.provider,
      mode,
      triggeredBy: 'manual',
      userId: integrationType === 'user' ? (integration as any).user_id : undefined,
      organizationId:
        integrationType === 'organization' ? (integration as any).organization_id : undefined,
    });
  }

  /**
   * Update integration settings
   */
  async updateUserIntegrationSettings(
    userId: string,
    provider: string,
    settings: {
      syncFrequency?: SyncFrequency;
      storageStrategy?: StorageStrategy;
      config?: Record<string, unknown>;
    }
  ) {
    return prisma.userIntegration.update({
      where: {
        user_id_provider: { user_id: userId, provider },
      },
      data: {
        sync_frequency: settings.syncFrequency,
        storage_strategy: settings.storageStrategy,
        config: settings.config,
      },
    });
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics() {
    if (!this.queueManager) {
      return null;
    }
    return this.queueManager.getAllQueueMetrics();
  }

  // ============ Private helpers ============

  private encryptToken(token: string): string {
    if (!tokenEncryptor) {
      logger.warn('Token encryption key not configured - storing tokens unencrypted');
      return token;
    }
    return tokenEncryptor.encrypt(token);
  }

  private decryptToken(encrypted: string): string {
    if (!tokenEncryptor) {
      return encrypted;
    }
    return tokenEncryptor.decrypt(encrypted);
  }

  private getDecryptedTokens(integration: {
    access_token: string;
    refresh_token: string | null;
    token_expires_at: Date | null;
  }): TokenSet {
    return {
      accessToken: this.decryptToken(integration.access_token),
      refreshToken: integration.refresh_token
        ? this.decryptToken(integration.refresh_token)
        : undefined,
      expiresAt: integration.token_expires_at || undefined,
    };
  }
}

// Export singleton instance
export const integrationService = new IntegrationService();
