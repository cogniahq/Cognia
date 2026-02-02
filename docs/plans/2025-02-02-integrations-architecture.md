# Integrations Architecture Design

> **Date:** 2025-02-02
> **Status:** In Progress
> **Scope:** Scalable plugin-based integration system for external services
> **Package:** `@cogniahq/integrations` (GitHub Packages)
> **Repo:** https://github.com/cogniahq/integrations

## Overview

A plugin-based architecture for connecting Cognia to external services (Google Drive, Slack, GitHub, Notion, CRMs, etc.) with support for:

- **Both personal and organization-level integrations**
- **Pull + webhook sync** (scheduled fetching with real-time updates where supported)
- **Admin-controlled registry** (enable/disable integrations, plan-based restrictions)
- **Configurable storage strategy** (metadata-only vs full content per integration)
- **Smart job queue** (rate-limit aware, priority-based, detailed error tracking)

---

## Core Abstractions

### Plugin Interface

Every integration implements a standard interface:

```typescript
interface IntegrationPlugin {
  // Metadata
  id: string;                    // 'google_drive', 'notion', 'slack'
  name: string;                  // 'Google Drive'
  description: string;
  icon: string;                  // URL or icon name
  category: IntegrationCategory;

  // Capabilities
  capabilities: {
    pullContent: boolean;
    webhooks: boolean;
    bidirectional: boolean;      // Future: push data back
  };

  // Rate limits (queue respects these)
  rateLimits: {
    requestsPerMinute: number;
    requestsPerDay?: number;
    concurrent: number;
  };

  // Auth
  authType: 'oauth2' | 'api_key' | 'basic';
  scopes?: string[];             // OAuth scopes required
  getAuthUrl(state: string, redirectUri: string): string;
  handleCallback(code: string, redirectUri: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;

  // Operations
  testConnection(tokens: TokenSet): Promise<boolean>;
  listResources(tokens: TokenSet, options: ListOptions): Promise<ResourcePage>;
  fetchResource(tokens: TokenSet, resourceId: string): Promise<ResourceContent>;

  // Webhooks (optional)
  registerWebhook?(tokens: TokenSet, callbackUrl: string): Promise<WebhookRegistration>;
  verifyWebhookSignature?(req: Request): Promise<boolean>;
  handleWebhookPayload?(payload: unknown): Promise<SyncEvent[]>;
  unregisterWebhook?(tokens: TokenSet, webhookId: string): Promise<void>;
}

type IntegrationCategory =
  | 'storage'        // Google Drive, Dropbox, OneDrive
  | 'productivity'   // Notion, Confluence, Coda
  | 'communication'  // Slack, Discord, Teams
  | 'development'    // GitHub, GitLab, Jira, Linear
  | 'crm'            // Salesforce, HubSpot
  | 'other';

interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

interface ListOptions {
  cursor?: string;
  limit?: number;
  filter?: {
    folder?: string;
    modifiedAfter?: Date;
    resourceTypes?: string[];
  };
}

interface ResourcePage {
  resources: Resource[];
  nextCursor?: string;
  hasMore: boolean;
}

interface Resource {
  id: string;
  externalId: string;
  type: string;                  // Provider-specific: 'file', 'message', 'page'
  name: string;
  mimeType?: string;
  modifiedAt: Date;
  parentId?: string;
}
```

### Normalized Resource Content

All plugins output a normalized format:

```typescript
interface ResourceContent {
  id: string;
  externalId: string;            // Original ID in source system
  type: 'file' | 'message' | 'page' | 'issue' | 'record';
  title: string;
  content: string;               // Extracted text content
  contentHash: string;           // For change detection
  mimeType?: string;
  url?: string;                  // Link back to original
  metadata: Record<string, any>; // Source-specific data preserved
  createdAt: Date;
  updatedAt: Date;
  author?: {
    id: string;
    name: string;
    email?: string;
  };
}
```

---

## Database Schema

### New Models

```prisma
// User-level integrations (personal accounts)
model UserIntegration {
  id               String            @id @default(uuid())
  user_id          String
  provider         String            // 'google_drive', 'slack', etc.
  access_token     String            // Encrypted
  refresh_token    String?           // Encrypted
  token_expires_at DateTime?
  config           Json              // User-specific settings
  status           IntegrationStatus @default(ACTIVE)
  last_sync_at     DateTime?
  last_error       String?
  webhook_id       String?           // External webhook registration ID
  connected_at     DateTime          @default(now())
  updated_at       DateTime          @updatedAt

  user             User              @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, provider])
  @@index([user_id])
  @@index([status])
}

// Admin registry - controls what's available platform-wide
model IntegrationRegistry {
  id               String   @id @default(uuid())
  provider         String   @unique
  enabled          Boolean  @default(true)
  allowed_plans    String[] // ['free', 'pro', 'enterprise'] - empty = all
  default_config   Json     @default("{}")
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
}

// Sync job tracking for observability
model IntegrationSyncJob {
  id               String        @id @default(uuid())
  integration_id   String
  integration_type String        // 'user' | 'organization'
  provider         String
  mode             String        // 'full' | 'incremental' | 'webhook'
  status           SyncJobStatus @default(PENDING)
  started_at       DateTime      @default(now())
  completed_at     DateTime?
  resources_found  Int           @default(0)
  resources_synced Int           @default(0)
  resources_failed Int           @default(0)
  error_message    String?
  error_details    Json?

  @@index([integration_id, integration_type])
  @@index([status])
  @@index([started_at])
}

// Track synced resources to detect changes/deletions
model SyncedResource {
  id               String   @id @default(uuid())
  integration_id   String
  integration_type String   // 'user' | 'organization'
  external_id      String   // ID in the external system
  resource_type    String   // 'file', 'message', 'page', etc.
  content_hash     String   // For change detection
  memory_id        String?  // Link to created memory
  last_synced_at   DateTime

  @@unique([integration_id, integration_type, external_id])
  @@index([integration_id, integration_type])
}

enum IntegrationStatus {
  ACTIVE
  PAUSED
  ERROR
  RATE_LIMITED
  TOKEN_EXPIRED
  DISCONNECTED
}

enum SyncJobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

### Extend Existing OrganizationIntegration

```prisma
model OrganizationIntegration {
  id               String            @id @default(uuid())
  organization_id  String
  provider         String
  access_token     String            // Encrypted
  refresh_token    String?           // Encrypted
  token_expires_at DateTime?
  config           Json
  status           IntegrationStatus @default(ACTIVE)
  storage_strategy StorageStrategy   @default(FULL_CONTENT)
  sync_frequency   SyncFrequency     @default(HOURLY)
  last_sync_at     DateTime?
  last_error       String?
  webhook_id       String?
  connected_by     String
  connected_at     DateTime          @default(now())
  updated_at       DateTime          @updatedAt

  organization     Organization      @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  connected_user   User              @relation(fields: [connected_by], references: [id])

  @@unique([organization_id, provider])
  @@index([organization_id])
  @@index([status])
}

enum StorageStrategy {
  METADATA_ONLY   // Store reference + embeddings only
  FULL_CONTENT    // Download and store full content
}

enum SyncFrequency {
  REALTIME        // Webhooks only (if supported)
  FIFTEEN_MIN
  HOURLY
  DAILY
  MANUAL          // No automatic sync
}
```

---

## Job Queue Architecture

### Queue Structure

```typescript
// Three queues for different job types
const QUEUES = {
  'integration-sync': {
    // Scheduled and manual sync jobs
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  },
  'integration-webhook': {
    // Incoming webhook processing (high priority)
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 1000
    }
  },
  'integration-resource': {
    // Individual resource processing
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 500,
      removeOnFail: 500
    }
  }
};
```

### Job Types

```typescript
// Sync job - scheduled or manual
interface SyncJobData {
  integrationId: string;
  integrationType: 'user' | 'organization';
  provider: string;
  mode: 'full' | 'incremental';
  cursor?: string;               // Resume point for large syncs
  triggeredBy: 'schedule' | 'manual' | 'webhook';
}

// Webhook job - from external callbacks
interface WebhookJobData {
  provider: string;
  payload: unknown;
  headers: Record<string, string>;
  signature?: string;
  receivedAt: Date;
}

// Resource job - process single item
interface ResourceJobData {
  integrationId: string;
  integrationType: 'user' | 'organization';
  provider: string;
  resourceId: string;
  externalId: string;
  resourceType: string;
  action: 'sync' | 'delete';
  storageStrategy: StorageStrategy;
  userId?: string;               // For personal integrations
  organizationId?: string;       // For org integrations
}
```

### Queue Manager

```typescript
class IntegrationQueueManager {
  private syncQueue: Queue<SyncJobData>;
  private webhookQueue: Queue<WebhookJobData>;
  private resourceQueue: Queue<ResourceJobData>;

  constructor(connection: Redis) {
    this.syncQueue = new Queue('integration-sync', { connection });
    this.webhookQueue = new Queue('integration-webhook', { connection });
    this.resourceQueue = new Queue('integration-resource', { connection });

    // Set up rate limiters per provider
    this.setupRateLimiters();
  }

  async scheduleSyncJobs() {
    // Called by cron - schedules syncs based on frequency settings
    const integrations = await this.getIntegrationsDueForSync();

    for (const integration of integrations) {
      await this.addSyncJob({
        integrationId: integration.id,
        integrationType: integration.type,
        provider: integration.provider,
        mode: 'incremental',
        triggeredBy: 'schedule'
      });
    }
  }

  async addSyncJob(data: SyncJobData, options?: { priority?: number }) {
    const plugin = PluginRegistry.get(data.provider);

    return this.syncQueue.add(data.provider, data, {
      priority: options?.priority ?? 5,
      rateLimiterKey: data.provider,
      jobId: `sync-${data.integrationType}-${data.integrationId}-${Date.now()}`
    });
  }

  async addWebhookJob(data: WebhookJobData) {
    return this.webhookQueue.add(data.provider, data, {
      priority: 1,  // High priority for real-time
      jobId: `webhook-${data.provider}-${Date.now()}`
    });
  }

  async addResourceJob(data: ResourceJobData) {
    return this.resourceQueue.add(data.provider, data, {
      priority: 5,
      rateLimiterKey: data.provider,
      jobId: `resource-${data.integrationType}-${data.integrationId}-${data.externalId}`
    });
  }
}
```

---

## Webhook Handling

### Central Webhook Endpoint

```typescript
// POST /api/webhooks/integrations/:provider
// POST /api/webhooks/integrations/:provider/:integrationId (for per-integration webhooks)

class WebhookController {
  async handleWebhook(req: Request, res: Response) {
    const { provider, integrationId } = req.params;

    // Check if provider exists
    if (!PluginRegistry.has(provider)) {
      return res.status(404).json({ error: 'Unknown provider' });
    }

    const plugin = PluginRegistry.get(provider);

    // Verify signature if plugin supports it
    if (plugin.verifyWebhookSignature) {
      const isValid = await plugin.verifyWebhookSignature(req);
      if (!isValid) {
        logger.warn(`Invalid webhook signature for ${provider}`);
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Queue for async processing
    await queueManager.addWebhookJob({
      provider,
      integrationId,
      payload: req.body,
      headers: req.headers as Record<string, string>,
      receivedAt: new Date()
    });

    // Respond immediately (webhooks expect <3s response)
    res.status(200).json({ received: true });
  }
}
```

### Webhook Worker

```typescript
class WebhookWorker {
  async process(job: Job<WebhookJobData>) {
    const { provider, payload, integrationId } = job.data;
    const plugin = PluginRegistry.get(provider);

    // Plugin parses its specific webhook format
    const events = await plugin.handleWebhookPayload(payload);

    for (const event of events) {
      // Find the integration this event belongs to
      const integration = integrationId
        ? await this.getIntegration(integrationId)
        : await this.findIntegrationByExternalId(provider, event.accountId);

      if (!integration) {
        logger.warn(`No integration found for webhook event`, { provider, event });
        continue;
      }

      // Queue resource processing
      await queueManager.addResourceJob({
        integrationId: integration.id,
        integrationType: integration.type,
        provider,
        resourceId: event.resourceId,
        externalId: event.externalId,
        resourceType: event.resourceType,
        action: event.action,
        storageStrategy: integration.storageStrategy,
        userId: integration.userId,
        organizationId: integration.organizationId
      });
    }
  }
}
```

---

## Plugin Registry

### Registry Implementation

```typescript
class PluginRegistry {
  private static plugins: Map<string, IntegrationPlugin> = new Map();
  private static dbRegistry: Map<string, IntegrationRegistry> = new Map();

  static async initialize() {
    // Auto-discover plugins
    const pluginModules = await this.discoverPlugins();

    for (const module of pluginModules) {
      const plugin = module.default as IntegrationPlugin;
      this.plugins.set(plugin.id, plugin);
      logger.log(`Loaded integration plugin: ${plugin.id}`);
    }

    // Sync with database (create missing registry entries)
    await this.syncWithDatabase();

    logger.log(`Integration registry initialized with ${this.plugins.size} plugins`);
  }

  private static async discoverPlugins() {
    const pluginDir = path.join(__dirname, 'plugins');
    const entries = await fs.readdir(pluginDir, { withFileTypes: true });

    const modules = [];
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'base.plugin.ts') {
        const indexPath = path.join(pluginDir, entry.name, 'index.ts');
        if (await fs.pathExists(indexPath)) {
          modules.push(await import(indexPath));
        }
      }
    }

    return modules;
  }

  static async syncWithDatabase() {
    const prisma = getPrisma();

    for (const [id, plugin] of this.plugins) {
      const existing = await prisma.integrationRegistry.findUnique({
        where: { provider: id }
      });

      if (!existing) {
        await prisma.integrationRegistry.create({
          data: {
            provider: id,
            enabled: true,
            allowed_plans: [],
            default_config: {}
          }
        });
      }

      this.dbRegistry.set(id, existing || { provider: id, enabled: true, allowed_plans: [] });
    }
  }

  static has(provider: string): boolean {
    return this.plugins.has(provider);
  }

  static get(provider: string): IntegrationPlugin {
    const plugin = this.plugins.get(provider);
    if (!plugin) throw new Error(`Unknown integration: ${provider}`);
    return plugin;
  }

  static isEnabled(provider: string): boolean {
    return this.dbRegistry.get(provider)?.enabled ?? false;
  }

  static isAvailableFor(provider: string, plan: string): boolean {
    const registry = this.dbRegistry.get(provider);
    if (!registry?.enabled) return false;
    if (registry.allowed_plans.length === 0) return true;
    return registry.allowed_plans.includes(plan);
  }

  static listAvailable(plan: string): IntegrationPlugin[] {
    return Array.from(this.plugins.values())
      .filter(p => this.isAvailableFor(p.id, plan));
  }

  static async setEnabled(provider: string, enabled: boolean) {
    const prisma = getPrisma();
    await prisma.integrationRegistry.update({
      where: { provider },
      data: { enabled }
    });

    const registry = this.dbRegistry.get(provider);
    if (registry) registry.enabled = enabled;
  }
}
```

---

## Directory Structure

```
/api/src/services/integrations/
├── index.ts                      # Public exports
├── integration.service.ts        # Main orchestration service
├── plugin-registry.ts            # Plugin loading & management
├── queue-manager.ts              # BullMQ queue setup
├── scheduler.ts                  # Cron job scheduling
│
├── workers/
│   ├── index.ts                  # Worker initialization
│   ├── sync.worker.ts            # Scheduled sync processing
│   ├── webhook.worker.ts         # Webhook event processing
│   └── resource.worker.ts        # Individual resource processing
│
├── plugins/
│   ├── base.plugin.ts            # Abstract base with shared logic
│   │
│   ├── google-drive/
│   │   ├── index.ts              # Plugin export & metadata
│   │   ├── auth.ts               # OAuth flow
│   │   ├── client.ts             # Google Drive API client
│   │   ├── resources.ts          # List/fetch files
│   │   ├── webhooks.ts           # Push notifications
│   │   └── content-extractor.ts  # Extract text from Drive files
│   │
│   ├── slack/
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── client.ts
│   │   ├── resources.ts          # Channels, messages
│   │   └── webhooks.ts           # Events API
│   │
│   ├── notion/
│   │   └── ...
│   │
│   ├── github/
│   │   └── ...
│   │
│   └── [future-integrations]/
│
├── utils/
│   ├── token-encryption.ts       # Encrypt/decrypt OAuth tokens
│   ├── content-extractor.ts      # Generic text extraction
│   └── rate-limiter.ts           # Per-provider rate limiting
│
└── types/
    ├── plugin.types.ts           # Core plugin interfaces
    ├── job.types.ts              # Queue job types
    └── resource.types.ts         # Normalized resource types

/api/src/routes/
├── integrations.route.ts         # Personal integration endpoints
├── organization-integrations.route.ts
└── webhooks.route.ts             # Webhook receiver

/api/src/controllers/
├── integration.controller.ts     # Personal integrations
├── organization-integration.controller.ts
└── webhook.controller.ts

/client/src/
├── components/integrations/
│   ├── IntegrationCard.tsx
│   ├── IntegrationList.tsx
│   ├── IntegrationSettings.tsx
│   ├── ConnectModal.tsx
│   └── SyncStatus.tsx
│
├── pages/integrations/
│   └── IntegrationsPage.tsx
│
└── types/integration.types.ts

/admin/src/pages/integrations/
├── RegistryPage.tsx              # Enable/disable integrations
├── MonitorPage.tsx               # View sync jobs, errors
└── IntegrationDetailPage.tsx     # Per-integration stats
```

---

## API Endpoints

### Personal Integrations

```
GET    /api/integrations
       → List available integrations for current user/plan

GET    /api/integrations/connected
       → List user's connected integrations

POST   /api/integrations/:provider/connect
       → Get OAuth URL (returns { authUrl })

GET    /api/integrations/:provider/callback?code=...&state=...
       → OAuth callback, stores tokens, redirects to app

GET    /api/integrations/:provider
       → Get connected integration details

PUT    /api/integrations/:provider/config
       → Update integration settings

POST   /api/integrations/:provider/sync
       → Trigger manual sync

POST   /api/integrations/:provider/pause
       → Pause automatic syncing

POST   /api/integrations/:provider/resume
       → Resume automatic syncing

DELETE /api/integrations/:provider
       → Disconnect integration
```

### Organization Integrations

```
GET    /api/organizations/:slug/integrations
GET    /api/organizations/:slug/integrations/connected
POST   /api/organizations/:slug/integrations/:provider/connect
GET    /api/organizations/:slug/integrations/:provider/callback
GET    /api/organizations/:slug/integrations/:provider
PUT    /api/organizations/:slug/integrations/:provider/config
POST   /api/organizations/:slug/integrations/:provider/sync
DELETE /api/organizations/:slug/integrations/:provider
```

### Webhooks

```
POST   /api/webhooks/integrations/:provider
       → Central webhook receiver

POST   /api/webhooks/integrations/:provider/:integrationId
       → Per-integration webhook (if needed)
```

### Admin

```
GET    /api/admin/integrations/registry
       → List all plugins with enabled status

PUT    /api/admin/integrations/registry/:provider
       → Update plugin settings (enable/disable, allowed plans)

GET    /api/admin/integrations/sync-jobs
       → List recent sync jobs with status

GET    /api/admin/integrations/sync-jobs/:jobId
       → Get detailed job info

GET    /api/admin/integrations/stats
       → Aggregate stats (connected integrations, sync success rate, etc.)
```

---

## Security Considerations

### Token Storage

- All OAuth tokens encrypted at rest using AES-256-GCM
- Encryption key from environment variable (rotatable)
- Refresh tokens stored separately, also encrypted

```typescript
// utils/token-encryption.ts
const ALGORITHM = 'aes-256-gcm';

export function encryptToken(token: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, data] = encrypted.split(':');
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Webhook Verification

Each plugin implements signature verification:

```typescript
// Google Drive - uses channel token
verifyWebhookSignature(req) {
  const channelToken = req.headers['x-goog-channel-token'];
  return channelToken === this.expectedToken;
}

// Slack - uses signing secret
verifyWebhookSignature(req) {
  const signature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];
  const body = req.rawBody;

  const baseString = `v0:${timestamp}:${body}`;
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET!)
    .update(baseString)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// GitHub - uses webhook secret
verifyWebhookSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!)
    .update(req.rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Access Control

- Personal integrations: only accessible by owning user
- Org integrations: accessible by org members based on role
- Admin endpoints: require admin role
- OAuth state parameter prevents CSRF

---

## Error Handling

### Integration Status Flow

```
ACTIVE → ERROR (after N failures)
       → RATE_LIMITED (hit rate limits)
       → TOKEN_EXPIRED (refresh failed)
       → PAUSED (user action)
       → DISCONNECTED (user action)

ERROR/RATE_LIMITED/TOKEN_EXPIRED → ACTIVE (after successful operation)
PAUSED → ACTIVE (user resumes)
```

### Automatic Recovery

```typescript
// In sync worker
async processSyncJob(job: Job<SyncJobData>) {
  const integration = await getIntegration(job.data);

  try {
    // Check if token needs refresh
    if (this.isTokenExpired(integration)) {
      await this.refreshIntegrationToken(integration);
    }

    // Perform sync...

    // Success - reset error state
    await this.updateIntegrationStatus(integration, 'ACTIVE', null);

  } catch (error) {
    if (this.isRateLimitError(error)) {
      await this.updateIntegrationStatus(integration, 'RATE_LIMITED', error.message);
      // Reschedule with delay
      throw new DelayedError(error.retryAfter || 60000);

    } else if (this.isAuthError(error)) {
      // Try refresh
      try {
        await this.refreshIntegrationToken(integration);
        throw new Error('Retry after token refresh');
      } catch {
        await this.updateIntegrationStatus(integration, 'TOKEN_EXPIRED', 'Token refresh failed');
      }

    } else {
      await this.incrementErrorCount(integration, error.message);
      throw error;  // Let BullMQ handle retry
    }
  }
}
```

---

## Environment Variables

```bash
# Token encryption
TOKEN_ENCRYPTION_KEY=<64-char-hex-string>

# Google Drive
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/integrations/google-drive/callback

# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_REDIRECT_URI=

# GitHub
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=

# Notion
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
NOTION_REDIRECT_URI=

# Add more as integrations are added...
```

---

## Implementation Order

1. **Core infrastructure**
   - Schema migrations
   - Plugin base class & registry
   - Queue manager & workers
   - Token encryption utilities

2. **API layer**
   - Integration routes (personal + org)
   - Webhook receiver
   - Admin endpoints

3. **First plugin: Google Drive**
   - OAuth flow
   - File listing & fetching
   - Content extraction
   - Webhook setup

4. **Frontend**
   - Integration list page
   - Connect flow
   - Settings & sync status

5. **Admin UI**
   - Registry management
   - Sync monitoring

6. **Additional plugins**
   - Slack, Notion, GitHub, etc.

---

## Success Criteria

- [ ] Can connect Google Drive from both personal account and organization
- [ ] Files sync automatically based on configured frequency
- [ ] Webhook updates reflected within seconds
- [ ] Admin can enable/disable integrations
- [ ] Rate limits respected, no API bans
- [ ] Token refresh works automatically
- [ ] Clear error states and recovery paths
- [ ] Sync history visible in UI
