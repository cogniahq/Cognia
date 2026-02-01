# Enterprise Workspace Setup - Design Document

## Overview

Transform the team workspace creation flow into a professional, enterprise-grade experience using progressive disclosure. Users create workspaces with essential details upfront, then complete additional sections over time via a guided setup checklist.

## Design Principles

- **Progressive disclosure**: Start simple, reveal complexity over time
- **Enterprise-ready**: Collect all details needed for compliance, billing, and team management
- **Non-blocking**: Users can start working immediately, complete setup at their pace
- **Guided experience**: Clear progress tracking and contextual prompts

---

## Part 1: Initial Creation Flow

### Current State
Simple dialog with workspace name and optional description.

### New Creation Dialog

**Required fields:**
- Workspace Name (text input)
- Industry (dropdown)
- Team Size (radio buttons)

**Industry Options:**
- Technology
- Healthcare & Life Sciences
- Financial Services
- Legal
- Education
- Manufacturing
- Retail & E-commerce
- Consulting & Professional Services
- Government & Public Sector
- Non-profit
- Media & Entertainment
- Real Estate
- Other

**Team Size Options:**
- 1-10 employees
- 11-50 employees
- 51-200 employees
- 200+ employees

### Behavior
After creation, user lands on dashboard with setup checklist card visible.

---

## Part 2: Setup Checklist Card

### Location
Top of organization dashboard, above the main tabs.

### States

**Expanded (default for first 14 days):**
- Full card showing all 5 setup steps
- Progress bar with percentage
- Each item clickable, shows estimated time
- Minimize button (collapses to banner)

**Minimized (after minimize or 14 days):**
- Single-line banner: "Setup 40% complete — Continue →"
- Click expands back to full view

**Completed (100%):**
- Success message shown once
- Card removed from dashboard permanently

### Setup Steps

1. **Create workspace** - Auto-completed on creation
2. **Organization Profile** - Logo, description, website, address, timezone
3. **Billing & Plan** - Legal name, billing address, VAT/tax ID, plan selection
4. **Security & Compliance** - Data residency, 2FA policy, session timeout, audit retention
5. **Invite Your Team** - Add members, set default role, create departments
6. **Connect Integrations** - Link external tools (future-ready, initially limited)

---

## Part 3: Organization Profile Panel

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Logo | Image upload | No | PNG/JPG, max 2MB, 256x256 recommended |
| Workspace Name | Text | Yes | Pre-filled, editable |
| Workspace Slug | Text | Yes | Auto-generated, editable, unique validation |
| Description | Textarea | No | Max 500 chars |
| Website | URL | No | Auto-prefixed with https:// |
| Street Address | Text | No | |
| City | Text | No | |
| State/Region | Text | No | |
| Postal Code | Text | No | |
| Country | Dropdown | No | ISO country list |
| Timezone | Dropdown | No | Defaults to browser timezone |

### Completion Criteria
Logo OR description must be provided.

---

## Part 4: Billing & Plan Panel

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Legal Company Name | Text | Yes | For invoices |
| Billing Email | Email | Yes | Defaults to admin email |
| Billing Address | Address fields | Yes | Street, City, State, Postal, Country |
| VAT/Tax ID | Text | No | For EU/applicable regions |
| Plan Selection | Radio cards | Yes | Free, Pro, Enterprise |

### Plan Options

**Free Plan:**
- Up to 5 team members
- 1GB document storage
- Basic AI features
- Community support

**Pro Plan ($15/user/month):**
- Unlimited team members
- 50GB document storage
- Advanced AI features
- Priority support
- Custom branding

**Enterprise Plan (Contact Sales):**
- Everything in Pro
- Unlimited storage
- SSO/SAML integration
- Dedicated support
- SLA guarantee
- Custom contracts

### Payment Method (Pro plan selected)
- Credit card form (Stripe Elements)
- Or "Invoice me" option for annual billing

### Completion Criteria
Legal name + billing email + plan selected. Payment method required only for Pro plan.

---

## Part 5: Security & Compliance Panel

### Fields

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| Data Residency | Dropdown | Auto-detect | US, EU, Asia-Pacific, or Auto |
| Require 2FA | Toggle | Off | Enforce for all members |
| Session Timeout | Dropdown | 7 days | 1 hour, 8 hours, 24 hours, 7 days, 30 days |
| Password Policy | Dropdown | Standard | Standard (8+ chars), Strong (12+ chars, mixed), Custom |
| Audit Log Retention | Dropdown | 90 days | 30, 90, 365 days, or Unlimited (Enterprise) |
| IP Allowlist | Textarea | Empty | One IP/CIDR per line (Enterprise only) |
| SSO/SAML | Config section | Disabled | Enterprise only |

### SSO Configuration (Enterprise)
- Identity Provider: Okta, Azure AD, Google Workspace, Custom SAML
- SSO URL, Entity ID, Certificate upload
- Test connection button

### Completion Criteria
Any setting changed from default OR explicit "Keep defaults" confirmation.

---

## Part 6: Invite Your Team Panel

### Sections

**Quick Invite:**
```
┌─────────────────────────────────────────────────────────┐
│  Email addresses (comma-separated)                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ john@acme.com, jane@acme.com                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Role for new members                                   │
│  ○ Admin    ○ Editor (recommended)    ○ Viewer         │
│                                                         │
│  ┌──────────────────────────┐                          │
│  │   Send Invitations   →   │                          │
│  └──────────────────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

**Domain Allowlist (Enterprise):**
- Auto-approve signups from specific domains
- Example: @acme.com users auto-join as Viewer

**Departments/Groups (Future):**
- Create organizational groups
- Assign default permissions per group

### Invitation Flow
1. Enter emails, select role
2. System sends invitation emails
3. Invitees click link, create account (or login if exists)
4. Auto-added to workspace with assigned role

### Completion Criteria
At least 1 invitation sent OR "Skip for now" clicked.

---

## Part 7: Connect Integrations Panel

### Available Integrations

**Communication:**
- Slack - Notifications, workspace activity
- Microsoft Teams - Notifications (future)

**Storage:**
- Google Drive - Import documents
- Dropbox - Import documents
- OneDrive - Import documents (future)

**Development:**
- GitHub - Link repositories (future)
- Notion - Import pages (future)

### Integration Card Design
```
┌─────────────────────────────────────────┐
│  [Slack Logo]                           │
│  Slack                                  │
│  Get notifications in your channels     │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         Connect   →             │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Completion Criteria
Any integration connected OR "Skip for now" clicked.

---

## Part 8: Contextual Security Prompt

### Trigger
When user invites their first team member (from Team tab, not setup panel).

### Modal Design
```
┌─────────────────────────────────────────────────────────┐
│  🔒 Secure Your Workspace                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Before your team joins, consider setting up:           │
│                                                         │
│  • Two-factor authentication requirement                │
│  • Session timeout policies                             │
│  • Data residency preferences                           │
│                                                         │
│  ┌────────────────────┐  ┌────────────────────────┐    │
│  │   Set up later     │  │  Configure Security →  │    │
│  └────────────────────┘  └────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Behavior
- Shows only once per workspace
- "Configure Security" opens Security & Compliance panel
- "Set up later" dismisses, doesn't show again

---

## Part 9: Database Schema Changes

### New Columns on Organization Table

```prisma
model Organization {
  // Existing fields...

  // New fields for enterprise setup
  industry        String?
  teamSize        String?   // "1-10", "11-50", "51-200", "200+"
  logo            String?   // URL to uploaded logo
  website         String?
  streetAddress   String?
  city            String?
  stateRegion     String?
  postalCode      String?
  country         String?
  timezone        String?

  // Billing fields
  legalName       String?
  billingEmail    String?
  billingAddress  Json?     // Full address object
  vatTaxId        String?
  plan            String    @default("free") // "free", "pro", "enterprise"

  // Security fields
  dataResidency   String    @default("auto")
  require2FA      Boolean   @default(false)
  sessionTimeout  String    @default("7d")
  passwordPolicy  String    @default("standard")
  auditRetention  String    @default("90d")
  ipAllowlist     String[]  @default([])
  ssoEnabled      Boolean   @default(false)
  ssoConfig       Json?

  // Setup tracking
  setupCompletedSteps String[] @default([])
  setupStartedAt      DateTime?
  setupCompletedAt    DateTime?
  securityPromptShown Boolean  @default(false)
}
```

### New Table: OrganizationInvitation

```prisma
model OrganizationInvitation {
  id              String       @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  email           String
  role            OrgRole
  invitedBy       String       // User ID
  token           String       @unique
  expiresAt       DateTime
  acceptedAt      DateTime?
  createdAt       DateTime     @default(now())

  @@unique([organizationId, email])
  @@index([token])
  @@index([organizationId])
}
```

### New Table: OrganizationIntegration

```prisma
model OrganizationIntegration {
  id              String       @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  provider        String       // "slack", "google_drive", etc.
  accessToken     String       // Encrypted
  refreshToken    String?      // Encrypted
  config          Json?
  connectedBy     String       // User ID
  connectedAt     DateTime     @default(now())

  @@unique([organizationId, provider])
  @@index([organizationId])
}
```

---

## Part 10: API Endpoints

### New Endpoints

```
# Organization setup
PUT  /api/organizations/:slug/profile     - Update org profile (logo, description, etc.)
PUT  /api/organizations/:slug/billing     - Update billing info
PUT  /api/organizations/:slug/security    - Update security settings
GET  /api/organizations/:slug/setup       - Get setup progress
POST /api/organizations/:slug/setup/skip  - Skip a setup step

# Invitations
POST /api/organizations/:slug/invitations       - Create invitation(s)
GET  /api/organizations/:slug/invitations       - List pending invitations
DELETE /api/organizations/:slug/invitations/:id - Revoke invitation
POST /api/invitations/:token/accept             - Accept invitation (public)

# Integrations
GET  /api/organizations/:slug/integrations           - List integrations
POST /api/organizations/:slug/integrations/:provider - Connect integration
DELETE /api/organizations/:slug/integrations/:provider - Disconnect

# Logo upload
POST /api/organizations/:slug/logo - Upload logo (multipart)
```

### Modified Endpoints

```
# Update create organization to accept new fields
POST /api/organizations
Body: { name, industry, teamSize }
```

---

## Part 11: Frontend Components

### New Components

```
client/src/components/organization/
├── setup/
│   ├── SetupChecklist.tsx        - Main checklist card
│   ├── SetupProgress.tsx         - Progress bar component
│   ├── SetupDrawer.tsx           - Slide-out drawer wrapper
│   ├── OrganizationProfileForm.tsx
│   ├── BillingPlanForm.tsx
│   ├── SecurityComplianceForm.tsx
│   ├── TeamInviteForm.tsx
│   ├── IntegrationsGrid.tsx
│   └── SecurityPromptModal.tsx
├── CreateOrganizationDialog.tsx  - Updated with industry/team size
└── ...existing components
```

### Updated Components

- `CreateOrganizationDialog.tsx` - Add industry dropdown, team size radio
- `organization.page.tsx` - Add SetupChecklist above tabs
- `MemberManagement.tsx` - Trigger security prompt on first invite

---

## Part 12: Implementation Phases

### Phase 1: Database & API Foundation
1. Add new columns to Organization table
2. Create OrganizationInvitation table
3. Create OrganizationIntegration table
4. Run migrations
5. Update organization service with new methods
6. Add new API endpoints

### Phase 2: Enhanced Creation Flow
1. Update CreateOrganizationDialog with new fields
2. Update API to handle industry/teamSize
3. Initialize setupCompletedSteps with "create"

### Phase 3: Setup Checklist UI
1. Create SetupChecklist component
2. Create SetupDrawer wrapper
3. Add to organization page
4. Implement progress tracking

### Phase 4: Setup Panels
1. Organization Profile form + API
2. Billing & Plan form (UI only, payment integration later)
3. Security & Compliance form + API
4. Team Invite form + invitation system
5. Integrations grid (UI only, integrations later)

### Phase 5: Polish & Prompts
1. Security prompt modal on first invite
2. Auto-minimize after 14 days
3. Completion celebration
4. Settings page indicators for incomplete sections

---

## Part 13: File Changes Summary

### API Changes
- `prisma/schema.prisma` - New columns and tables
- `src/services/organization/organization.service.ts` - New methods
- `src/controller/organization/organization.controller.ts` - New endpoints
- `src/routes/organization.route.ts` - New routes
- `src/services/organization/invitation.service.ts` - New service
- `src/controller/organization/invitation.controller.ts` - New controller

### Client Changes
- `src/components/organization/CreateOrganizationDialog.tsx` - Enhanced
- `src/components/organization/setup/*` - All new components
- `src/pages/organization.page.tsx` - Add checklist
- `src/services/organization/organization.service.ts` - New API calls
- `src/contexts/organization.context.tsx` - Setup state management

---

## Success Metrics

- 80%+ of new workspaces complete profile section within 7 days
- 50%+ complete billing section within 14 days
- Reduced support tickets about "how to set up workspace"
- Increased team invitations (clearer flow)
