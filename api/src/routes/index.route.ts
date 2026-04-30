import { Express } from 'express'
import memoryRouter from './memory.route'
import contentRouter from './content.route'
import searchRouter from './search.route'
import authRouter from './auth.route'
import profileRouter from './profile.route'
import exportImportRouter from './export-import.route'
import privacyRouter from './privacy.route'
import adminRouter from './admin.route'
import organizationRouter from './organization.route'
import documentRouter from './document.route'
import invitationRouter from './invitation.route'
import integrationsRouter from './integrations.route'
import orgIntegrationsRouter from './org-integrations.route'
import webhooksRouter from './webhooks.route'
import platformRouter from './platform.route'
import orgAdminRouter from './org-admin.route'
import oauthRouter from './oauth.route'
import ssoRouter from './sso.route'
import scimRouter from './scim.route'
import onboardingRouter from './onboarding.route'
import shareRouter from './share.route'
import commentRouter from './comment.route'
import workspaceRouter from './workspace.route'
import tagRouter from './tag.route'
import savedSearchRouter from './saved-search.route'
import billingRouter from './billing.route'
import apiKeysRouter from './api-keys.route'
import v1Router from './v1.route'
import mcpRouter from './mcp.route'
import openApiRouter from './openapi.route'
import gdprRouter from './gdpr.route'
import { LocalStorageController } from '../controller/storage/local-storage.controller'

export const routes = (app: Express) => {
  app.get('/api/storage/local', LocalStorageController.serveSignedFile)
  app.use('/api/memory', memoryRouter)
  app.use('/api/content', contentRouter)

  app.use('/api/search', searchRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/auth/oauth', oauthRouter)
  app.use('/api/sso', ssoRouter)
  app.use('/api/profile', profileRouter)
  app.use('/api/export', exportImportRouter)
  app.use('/api/privacy', privacyRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/org-admin', orgAdminRouter)
  app.use('/api/organizations', organizationRouter)
  app.use('/api/platform', platformRouter)
  // Document routes are mounted under /api/organizations/:slug/documents
  app.use('/api/organizations', documentRouter)
  // Organization integration routes (admin configurable sync settings)
  app.use('/api/organizations', orgIntegrationsRouter)
  // Public invitation routes (for accepting invitations)
  app.use('/api/invitations', invitationRouter)
  // Integration routes
  app.use('/api/integrations', integrationsRouter)
  // Webhook routes (external services call these)
  app.use('/api/webhooks', webhooksRouter)
  // SCIM 2.0 (mounted at bare /scim, not /api/, per Azure AD/Okta conventions)
  app.use('/scim', scimRouter)
  // Onboarding (sample-workspace dismissal, tour completion, state)
  app.use('/api/onboarding', onboardingRouter)
  // Memory sharing + threaded comments
  app.use('/api/shares', shareRouter)
  app.use('/api/comments', commentRouter)
  // Workspaces (org hierarchy), tags, and saved searches
  app.use('/api/organizations', workspaceRouter)
  app.use('/api/tags', tagRouter)
  app.use('/api/saved-searches', savedSearchRouter)
  // Billing (subscriptions, usage, invoices, custom pause/resume/cancel
  // endpoints). Razorpay webhook is mounted directly on the app in App.ts
  // (it needs the raw body before json()).
  app.use('/api/billing', billingRouter)
  // API keys (developer-issued bearer keys for the public /v1 API)
  app.use('/api/api-keys', apiKeysRouter)
  // Public versioned API (authenticated via API keys)
  app.use('/v1', v1Router)
  // Model Context Protocol (MCP) JSON-RPC server (authenticated via API keys)
  app.use('/mcp', mcpRouter)
  // OpenAPI 3 spec for the public API
  app.use('/', openApiRouter)
  // GDPR data rights (account deletion, consent, status)
  app.use('/api/gdpr', gdprRouter)
}
