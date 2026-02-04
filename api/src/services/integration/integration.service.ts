import { IntegrationStatus, SyncFrequency, StorageStrategy, SourceType } from '@prisma/client';
import {
  PluginRegistry,
  IntegrationQueueManager,
  createTokenEncryptor,
  type TokenSet,
  type PluginInfo,
  type ResourceContent,
} from '@cogniahq/integrations';
import Redis from 'ioredis';
import { logger } from '../../utils/core/logger.util';
import { prisma } from '../../lib/prisma.lib';
import { addContentJob } from '../../lib/queue.lib';
import { memoryIngestionService } from '../memory/memory-ingestion.service';
import { memoryMeshService } from '../memory/memory-mesh.service';
import { getRedisConnection } from '../../utils/core/env.util';

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

    // Initialize queue manager with BullMQ-compatible Redis connection
    try {
      const connection = getRedisConnection(true); // true = BullMQ compatible (maxRetriesPerRequest: null)

      let redis: Redis;
      if ('url' in connection) {
        redis = new Redis(connection.url, connection);
      } else {
        redis = new Redis(connection);
      }

      this.queueManager = new IntegrationQueueManager(redis);
      logger.log('Integration queue manager initialized');
    } catch (error: any) {
      logger.warn('Redis not available, queue manager disabled:', error?.message || error);
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

    // Notion
    if (process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET) {
      const { NotionPlugin } = require('@cogniahq/integrations');
      PluginRegistry.register(NotionPlugin, {
        clientId: process.env.NOTION_CLIENT_ID,
        clientSecret: process.env.NOTION_CLIENT_SECRET,
        redirectUri: process.env.NOTION_REDIRECT_URI || '',
      });
      logger.log('Registered Notion plugin');
    }

    // Slack
    if (process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET) {
      const { SlackPlugin } = require('@cogniahq/integrations');
      PluginRegistry.register(SlackPlugin, {
        clientId: process.env.SLACK_CLIENT_ID,
        clientSecret: process.env.SLACK_CLIENT_SECRET,
        redirectUri: process.env.SLACK_REDIRECT_URI || '',
        signingSecret: process.env.SLACK_SIGNING_SECRET,
      });
      logger.log('Registered Slack plugin');
    }

    // Box
    if (process.env.BOX_CLIENT_ID && process.env.BOX_CLIENT_SECRET) {
      const { BoxPlugin } = require('@cogniahq/integrations');
      PluginRegistry.register(BoxPlugin, {
        clientId: process.env.BOX_CLIENT_ID,
        clientSecret: process.env.BOX_CLIENT_SECRET,
        redirectUri: process.env.BOX_REDIRECT_URI || '',
        primaryWebhookKey: process.env.BOX_PRIMARY_WEBHOOK_KEY,
        secondaryWebhookKey: process.env.BOX_SECONDARY_WEBHOOK_KEY,
      });
      logger.log('Registered Box plugin');
    }

    // Add more plugins here as they're implemented
    // GitHub, etc.
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
        config: (options.config || {}) as any,
        status: IntegrationStatus.ACTIVE,
        storage_strategy: options.storageStrategy || StorageStrategy.FULL_CONTENT,
        sync_frequency: options.syncFrequency || SyncFrequency.HOURLY,
      },
      update: {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: tokens.expiresAt,
        config: (options.config || {}) as any,
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
        config: (options.config || {}) as any,
        status: IntegrationStatus.ACTIVE,
        storage_strategy: options.storageStrategy || StorageStrategy.FULL_CONTENT,
        sync_frequency: options.syncFrequency || SyncFrequency.HOURLY,
        connected_by: context.userId,
      },
      update: {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: tokens.expiresAt,
        config: (options.config || {}) as any,
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
   * @param direct - If true, sync immediately instead of queueing (useful for manual triggers)
   */
  async triggerSync(
    integrationId: string,
    integrationType: 'user' | 'organization',
    mode: 'full' | 'incremental' = 'incremental',
    direct: boolean = true // Default to direct sync for manual triggers
  ): Promise<void> {
    const integration =
      integrationType === 'user'
        ? await prisma.userIntegration.findUnique({ where: { id: integrationId } })
        : await prisma.organizationIntegration.findUnique({ where: { id: integrationId } });

    if (!integration) {
      throw new Error('Integration not found');
    }

    // For manual syncs, use direct mode for immediate feedback
    // Queue mode is better for scheduled/automatic syncs
    if (!direct && this.queueManager) {
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
      logger.log(`Sync job queued for ${integration.provider}`);
      return;
    }

    // Direct sync - process immediately
    logger.log(`Direct sync for ${integration.provider}`);
    await this.performDirectSync(integration, integrationType, mode);
  }

  /**
   * Perform sync directly without queue (fallback for when Redis is unavailable)
   */
  private async performDirectSync(
    integration: any,
    integrationType: 'user' | 'organization',
    _mode: 'full' | 'incremental'
  ): Promise<void> {
    const plugin = PluginRegistry.get(integration.provider);
    const tokens = this.getDecryptedTokens(integration);
    const userId = integrationType === 'user' ? integration.user_id : integration.connected_by;

    // For organization integrations, use the integration's organization_id
    // For user integrations, check if user belongs to an organization
    let organizationId: string | null = null;
    if (integrationType === 'organization') {
      organizationId = integration.organization_id;
    } else if (userId) {
      // Check if user has an organization membership
      const membership = await prisma.organizationMember.findFirst({
        where: { user_id: userId },
        select: { organization_id: true },
      });
      organizationId = membership?.organization_id || null;
    }

    try {
      // List resources from the integration
      const page = await plugin.listResources(tokens, {
        limit: 50, // Process in smaller batches
      });

      logger.log(`Found ${page.resources.length} resources from ${integration.provider}`);

      let synced = 0;
      let skipped = 0;
      let errors = 0;

      // Process each resource
      for (const resource of page.resources) {
        // Skip folders
        if (resource.type === 'folder') {
          logger.log(`  [skip] ${resource.name} (folder)`);
          skipped++;
          continue;
        }

        try {
          // Check if already synced
          const existingSynced = await prisma.syncedResource.findUnique({
            where: {
              integration_id_integration_type_external_id: {
                integration_id: integration.id,
                integration_type: integrationType,
                external_id: resource.externalId,
              },
            },
          });

          // Skip if excluded from resync
          if (existingSynced?.excluded) {
            logger.log(`  [skip] ${resource.name} (excluded from resync)`);
            skipped++;
            continue;
          }

          // Skip if already synced and not modified
          if (existingSynced && existingSynced.last_synced_at >= resource.modifiedAt) {
            logger.log(`  [skip] ${resource.name} (unchanged)`);
            skipped++;
            continue;
          }

          // Fetch full content
          logger.log(`  [fetch] ${resource.name}...`);
          const content = await plugin.fetchResource(tokens, resource.externalId);

          // Skip if no usable content
          if (!content.content || content.content.startsWith('[Unsupported') || content.content.startsWith('[Binary')) {
            logger.log(`  [skip] ${resource.name} (unsupported type)`);
            skipped++;
            continue;
          }

          // Create or update memory
          await this.createMemoryFromContent(content, {
            userId,
            organizationId,
            integrationId: integration.id,
            integrationType,
            provider: integration.provider,
          });

          // Track synced resource
          await prisma.syncedResource.upsert({
            where: {
              integration_id_integration_type_external_id: {
                integration_id: integration.id,
                integration_type: integrationType,
                external_id: resource.externalId,
              },
            },
            create: {
              integration_id: integration.id,
              integration_type: integrationType,
              external_id: resource.externalId,
              resource_type: resource.type,
              content_hash: content.contentHash,
              last_synced_at: new Date(),
            },
            update: {
              content_hash: content.contentHash,
              last_synced_at: new Date(),
            },
          });

          logger.log(`  [synced] ${resource.name}`);
          synced++;

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          logger.error(`  [error] ${resource.name}: ${err.message}`);
          errors++;
        }
      }

      logger.log(`Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);

      // Update last sync time
      const updateData: { last_sync_at: Date; last_error: string | null } = {
        last_sync_at: new Date(),
        last_error: errors > 0 ? `${errors} resources failed to sync` : null,
      };

      if (integrationType === 'user') {
        await prisma.userIntegration.update({
          where: { id: integration.id },
          data: updateData,
        });
      } else {
        await prisma.organizationIntegration.update({
          where: { id: integration.id },
          data: updateData,
        });
      }
    } catch (error: any) {
      logger.error(`Sync failed for ${integration.provider}:`, error);

      // Update error status
      const errorData = {
        last_error: error.message,
        status: IntegrationStatus.ERROR,
      };

      if (integrationType === 'user') {
        await prisma.userIntegration.update({
          where: { id: integration.id },
          data: errorData,
        });
      } else {
        await prisma.organizationIntegration.update({
          where: { id: integration.id },
          data: errorData,
        });
      }

      throw error;
    }
  }

  /**
   * Create a memory from integration content
   */
  private async createMemoryFromContent(
    content: ResourceContent,
    context: {
      userId: string;
      organizationId?: string | null;
      integrationId: string;
      integrationType: 'user' | 'organization';
      provider: string;
    }
  ): Promise<void> {
    const { userId, organizationId, provider } = context;

    // Canonicalize content for deduplication
    const { canonicalText, canonicalHash } = memoryIngestionService.canonicalizeContent(
      content.content,
      content.url
    );

    // Check for duplicates
    const duplicate = await memoryIngestionService.findDuplicateMemory({
      userId,
      canonicalHash,
      canonicalText,
      url: content.url,
    });

    if (duplicate) {
      logger.log(`    (duplicate of ${duplicate.memory.id})`);
      return;
    }

    // Try to add to content queue for full processing (embeddings, etc.)
    try {
      await addContentJob({
        user_id: userId,
        raw_text: content.content,
        metadata: {
          url: content.url,
          title: content.title,
          source: provider,
          source_type: 'INTEGRATION',
          organization_id: organizationId || undefined,
          timestamp: content.updatedAt?.getTime() || Date.now(),
        },
      });
      logger.log(`    (queued for processing)`);
    } catch {
      // Queue not available, create memory directly with embeddings
      const memory = await prisma.memory.create({
        data: {
          user_id: userId,
          organization_id: organizationId || undefined,
          source: provider,
          source_type: SourceType.INTEGRATION,
          url: content.url,
          title: content.title,
          content: content.content,
          canonical_text: canonicalText,
          canonical_hash: canonicalHash,
          timestamp: BigInt(content.updatedAt?.getTime() || Date.now()),
          page_metadata: {
            integration_provider: provider,
            external_id: content.externalId,
            mime_type: content.mimeType,
            author: content.author,
          } as any,
        },
      });

      // Generate embeddings in background (non-blocking)
      setImmediate(async () => {
        try {
          await memoryMeshService.generateEmbeddingsForMemory(memory.id);
          await memoryMeshService.createMemoryRelations(memory.id, userId);
        } catch (err) {
          logger.error(`Error generating embeddings for ${memory.id}:`, err);
        }
      });

      logger.log(`    (created with embeddings)`);
    }
  }

  /**
   * Update user integration settings
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
        config: settings.config as any,
      },
    });
  }

  /**
   * Update organization integration settings
   */
  async updateOrgIntegrationSettings(
    organizationId: string,
    provider: string,
    settings: {
      syncFrequency?: SyncFrequency;
      storageStrategy?: StorageStrategy;
      config?: Record<string, unknown>;
    }
  ) {
    return prisma.organizationIntegration.update({
      where: {
        organization_id_provider: { organization_id: organizationId, provider },
      },
      data: {
        sync_frequency: settings.syncFrequency,
        storage_strategy: settings.storageStrategy,
        config: settings.config as any,
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
