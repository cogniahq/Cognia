# Admin Portal Design

## Overview

A separate admin website for super administrators to control and monitor the entire Cognia platform. Only users with `role: ADMIN` (UserRole enum) can access this portal.

## Architecture

### Separate Application
- New directory: `/admin` at project root
- Separate Vite + React application
- Shares design system with main client (tailwind config)
- Runs on different port (5174 default)
- Uses same API backend with admin-specific endpoints

### Authentication
- Uses same JWT authentication as main app
- Middleware checks `user.role === 'ADMIN'`
- Redirects non-admins to 403 page

## Pages & Features

### 1. Dashboard (Home)
- System health overview (API, Database, Redis, Qdrant)
- Key metrics cards: Total Users, Total Orgs, Total Memories, Total Documents
- 24h activity sparklines
- Token usage and cost tracking
- Quick action buttons

### 2. Users Management
- Paginated user table with search
- Columns: Email, Role, Account Type, Memories, Created, Last Active
- User detail drawer: view profile, memories, organizations
- Actions: Change role, disable account, impersonate, delete

### 3. Organizations Management
- Paginated org table with search
- Columns: Name, Plan, Members, Documents, Memories, Created
- Org detail drawer: members list, documents, settings
- Actions: Change plan, add/remove members, delete

### 4. Analytics
- Time-series charts for: New users, New memories, Searches, Token usage
- Memory type distribution pie chart
- Top users by activity
- Memory source breakdown
- Cost projections

### 5. Documents
- All documents across all organizations
- Filter by org, status, uploader
- Reprocess failed documents
- View document details and chunks

### 6. System
- Service health status (API, DB, Redis, Qdrant)
- Queue status and management
- Configuration viewer
- Audit logs viewer

## API Endpoints (New)

All under `/api/admin/*`:

```
GET  /admin/dashboard        - Dashboard stats
GET  /admin/users            - List all users (paginated)
GET  /admin/users/:id        - User details
PUT  /admin/users/:id/role   - Change user role
DEL  /admin/users/:id        - Delete user
GET  /admin/organizations    - List all orgs (paginated)
GET  /admin/organizations/:id - Org details
PUT  /admin/organizations/:id/plan - Change plan
DEL  /admin/organizations/:id - Delete org
GET  /admin/documents        - List all documents
POST /admin/documents/:id/reprocess - Reprocess document
GET  /admin/analytics/timeseries - Time series data
GET  /admin/analytics/breakdown  - Breakdown stats
GET  /admin/system/health    - System health
GET  /admin/system/queues    - Queue status
GET  /admin/audit-logs       - Audit logs
```

## Design System

Same brutalist/minimal design as main app:
- No rounded corners
- Monospace fonts (font-mono) for labels and data
- Uppercase tracking-wider section headers
- Bracket notation [SECTION NAME]
- Sharp borders (border, border-gray-200)
- Gray color palette (gray-50, gray-100, gray-200, gray-900)
- No shadows
- Dense, data-rich tables

## Tech Stack

- React 18 + TypeScript
- Vite
- TailwindCSS (shared config)
- React Router
- Axios for API calls
- Recharts for charts
- Same component library patterns

## File Structure

```
/admin
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js (extends ../client/tailwind.config.js)
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AdminLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── ui/
│   │   │   ├── DataTable.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── Chart.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Drawer.tsx
│   │   ├── users/
│   │   ├── organizations/
│   │   ├── documents/
│   │   └── analytics/
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Users.tsx
│   │   ├── Organizations.tsx
│   │   ├── Documents.tsx
│   │   ├── Analytics.tsx
│   │   ├── System.tsx
│   │   └── Login.tsx
│   ├── services/
│   │   └── api.ts
│   ├── contexts/
│   │   └── auth.context.tsx
│   ├── hooks/
│   │   └── useAdminData.ts
│   └── types/
│       └── admin.types.ts
```
