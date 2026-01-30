# Document Intelligence System ("Second Brain") Implementation Plan

## Overview

Add a company-wide document processing and retrieval system to Cognia, enabling organizations to upload, process, and semantically search PDFs, DOCX, images, and other files.

**Key Decisions:**
- Extend existing Memory system (documents create Memory entries for embeddings)
- Organization-based multi-tenancy with role-based access (Admin/Editor/Viewer)
- Pluggable storage (Local/S3/R2)
- Smart chunking (~500-1000 tokens) with semantic boundaries
- Unified search across documents + existing memories

---

## Phase 1: Organization Multi-Tenancy Foundation

**Goal:** Establish data model and access control for organizations.

### Database Schema Changes

**Modify:** `api/prisma/schema.prisma`

```prisma
enum OrgRole { ADMIN, EDITOR, VIEWER }
enum DocumentStatus { PENDING, PROCESSING, COMPLETED, FAILED }
enum SourceType { EXTENSION, DOCUMENT, API, INTEGRATION }

model Organization {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  slug      String   @unique
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
  members   OrganizationMember[]
  documents Document[]
  memories  Memory[]

  @@map("organizations")
}

model OrganizationMember {
  id              String @id @default(uuid()) @db.Uuid
  organization_id String @db.Uuid
  user_id         String @db.Uuid
  role            OrgRole @default(VIEWER)
  created_at      DateTime @default(now())
  organization    Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  user            User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([organization_id, user_id])
  @@index([organization_id])
  @@index([user_id])
  @@map("organization_members")
}

model Document {
  id              String @id @default(uuid()) @db.Uuid
  organization_id String @db.Uuid
  uploader_id     String @db.Uuid
  filename        String
  original_name   String
  mime_type       String
  file_size       Int
  storage_path    String
  storage_provider String @default("local")
  status          DocumentStatus @default(PENDING)
  error_message   String?
  page_count      Int?
  metadata        Json?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  organization    Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  uploader        User @relation(fields: [uploader_id], references: [id], onDelete: Cascade)
  chunks          DocumentChunk[]

  @@index([organization_id])
  @@index([uploader_id])
  @@index([status])
  @@index([organization_id, status])
  @@map("documents")
}

model DocumentChunk {
  id          String @id @default(uuid()) @db.Uuid
  document_id String @db.Uuid
  chunk_index Int
  content     String
  page_number Int?
  char_start  Int?
  char_end    Int?
  memory_id   String? @db.Uuid
  created_at  DateTime @default(now())
  document    Document @relation(fields: [document_id], references: [id], onDelete: Cascade)
  memory      Memory? @relation(fields: [memory_id], references: [id], onDelete: SetNull)

  @@unique([document_id, chunk_index])
  @@index([document_id])
  @@index([memory_id])
  @@map("document_chunks")
}
```

**Extend Memory model:**
```prisma
model Memory {
  // ... existing fields ...
  source_type       SourceType? @default(EXTENSION)
  document_chunk_id String? @db.Uuid
  organization_id   String? @db.Uuid
  document_chunks   DocumentChunk[]
  organization      Organization? @relation(fields: [organization_id], references: [id], onDelete: SetNull)

  @@index([organization_id])
  @@index([source_type])
}
```

**Extend User model:**
```prisma
model User {
  // ... existing fields ...
  organization_memberships OrganizationMember[]
  uploaded_documents       Document[]
}
```

### Files to Create

| File | Purpose |
|------|---------|
| `api/src/services/organization/organization.service.ts` | CRUD for orgs & members |
| `api/src/services/organization/organization-access.service.ts` | Permission checking |
| `api/src/middleware/organization.middleware.ts` | Org context & role enforcement |
| `api/src/routes/organization.route.ts` | REST endpoints |
| `api/src/controller/organization/organization.controller.ts` | Request handlers |
| `api/src/types/organization.types.ts` | TypeScript interfaces |

### API Endpoints

```
POST   /api/organizations              # Create org
GET    /api/organizations              # List user's orgs
GET    /api/organizations/:slug        # Get org details
PUT    /api/organizations/:slug        # Update org (admin)
DELETE /api/organizations/:slug        # Delete org (admin)
POST   /api/organizations/:slug/members     # Add member
GET    /api/organizations/:slug/members     # List members
PUT    /api/organizations/:slug/members/:id # Update role
DELETE /api/organizations/:slug/members/:id # Remove member
```

---

## Phase 2: Pluggable Storage System

**Goal:** Abstract storage layer with multiple backend support.

### Files to Create

| File | Purpose |
|------|---------|
| `api/src/services/storage/storage-provider.interface.ts` | Interface definition |
| `api/src/services/storage/providers/local-storage.provider.ts` | Filesystem storage |
| `api/src/services/storage/providers/s3-storage.provider.ts` | AWS S3 |
| `api/src/services/storage/providers/r2-storage.provider.ts` | Cloudflare R2 |
| `api/src/services/storage/storage.service.ts` | Factory + singleton |

### Interface

```typescript
interface StorageProvider {
  readonly name: string

  // File operations
  upload(file: Buffer, key: string, contentType: string): Promise<StorageResult>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>

  // URL generation
  getSignedUrl(key: string, expiresIn?: number): Promise<string>
  getPublicUrl(key: string): string | null

  // Metadata
  getMetadata(key: string): Promise<StorageMetadata>
}

interface StorageResult {
  key: string
  url: string
  size: number
  contentType: string
}

interface StorageMetadata {
  size: number
  contentType: string
  lastModified: Date
  etag?: string
}
```

### Environment Variables

```env
# Storage Configuration
STORAGE_PROVIDER=local  # local | s3 | r2

# Local storage directory (for local provider)
LOCAL_STORAGE_PATH=./uploads

# S3 Configuration
S3_BUCKET=
S3_REGION=us-east-1
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_ENDPOINT=  # Optional, for S3-compatible services

# Cloudflare R2 Configuration
R2_BUCKET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
```

---

## Phase 3: Document Upload & Processing Pipeline

**Goal:** File uploads with text extraction, chunking, and embedding.

### Files to Create

| File | Purpose |
|------|---------|
| `api/src/routes/document.route.ts` | Document REST endpoints |
| `api/src/controller/document/document.controller.ts` | Request handlers |
| `api/src/lib/document-queue.lib.ts` | BullMQ queue setup |
| `api/src/workers/document-worker.ts` | Async processing worker |
| `api/src/services/document/document.service.ts` | Orchestration |
| `api/src/services/document/text-extraction.service.ts` | PDF/DOCX/image extraction |
| `api/src/services/document/text-chunking.service.ts` | Smart text chunking |
| `api/src/types/document.types.ts` | TypeScript interfaces |

### Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. UPLOAD                                                  │
│  POST /api/organizations/:slug/documents                    │
│  - Validate file type, size, user permissions               │
│  - Store file via StorageProvider (S3/local/etc)            │
│  - Create Document record (status: PENDING)                 │
│  - Queue processing job via BullMQ                          │
│  - Return 202 Accepted + document_id                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. EXTRACTION (document-worker.ts)                         │
│  - Fetch file from storage                                  │
│  - Route by mime_type:                                      │
│    • PDF → pdf-parse                                        │
│    • DOCX → mammoth                                         │
│    • Images → Gemini Vision API for OCR                     │
│    • TXT/MD → direct read                                   │
│  - Extract text content + metadata                          │
│  - Update Document (status: PROCESSING)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. CHUNKING                                                │
│  - Split text into semantic chunks (~500-1000 tokens each)  │
│  - Preserve paragraph/section boundaries                    │
│  - Track page numbers for PDFs                              │
│  - Create DocumentChunk records                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4. EMBEDDING (reuse existing infrastructure)               │
│  - For each chunk:                                          │
│    • Create Memory with source_type=DOCUMENT               │
│    • Generate embedding via embedding-provider.service      │
│    • Store in Qdrant with org metadata                      │
│  - Update Document (status: COMPLETED)                      │
└─────────────────────────────────────────────────────────────┘
```

### Text Extraction by Type

| MIME Type | Library |
|-----------|---------|
| `application/pdf` | pdf-parse |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | mammoth |
| `image/*` | Gemini Vision API (OCR) |
| `text/plain`, `text/markdown` | Direct read |

### API Endpoints

```
POST   /api/organizations/:slug/documents           # Upload
GET    /api/organizations/:slug/documents           # List
GET    /api/organizations/:slug/documents/:id       # Details
GET    /api/organizations/:slug/documents/:id/download  # Download
DELETE /api/organizations/:slug/documents/:id       # Delete
POST   /api/organizations/:slug/documents/:id/reprocess # Retry failed
```

### Dependencies to Add

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0",
    "multer": "^1.4.5-lts.1",
    "@aws-sdk/client-s3": "^3.500.0",
    "@aws-sdk/s3-request-presigner": "^3.500.0"
  },
  "devDependencies": {
    "@types/multer": "^1.4.11"
  }
}
```

---

## Phase 4: Extended Unified Search

**Goal:** Query across documents + memories with AI answers.

### Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `api/src/services/search/unified-search.service.ts` | Combined search |
| MODIFY | `api/src/lib/qdrant.lib.ts` | Add org/source indexes |
| MODIFY | `api/src/services/memory/memory-mesh.service.ts` | Include org context |
| MODIFY | `api/src/routes/search.route.ts` | Add org endpoints |
| MODIFY | `api/src/controller/search/search.controller.ts` | Add handlers |

### Search Features

- Filter by organization_id
- Filter by source_type (documents only, memories only, all)
- Group document chunks by parent document
- AI-generated answers with citations linking to source docs
- Return download URLs for document results

### New Qdrant Payload Fields

```typescript
{
  organization_id: string | null,
  source_type: 'extension' | 'document' | 'api' | 'integration',
  document_id: string | null
}
```

### Unified Search Flow

```
User Query → Query Processor
                │
                ├─► Filter by organization_id
                ├─► Include source_type filter (optional)
                │
                ▼
           Qdrant Search (hybrid: semantic + keyword)
                │
                ▼
           Result Ranking + Reranking
                │
                ├─► Group chunks by parent document
                ├─► Return top-k unique documents with best matching chunks
                │
                ▼
           AI Answer Generation (existing result-formatter.service)
                │
                ├─► Build context from relevant chunks
                ├─► Generate answer with citations [1], [2]
                ├─► Link citations to source documents
                │
                ▼
           Response with:
           - AI-generated answer
           - Source documents (with download links)
           - Relevant chunk previews
```

---

## Phase 5: Integration & Polish

**Goal:** Wire everything together.

### Files to Modify

| File | Change |
|------|--------|
| `api/src/routes/index.route.ts` | Register new routes |
| `api/.env.example` | Document new env vars |
| `api/docker-compose.yml` | Add uploads volume |

### Database Migration

Run `npx prisma migrate dev --name add_organizations_and_documents` to generate migration.

---

## Critical Files Reference

| File | Why Critical |
|------|--------------|
| `api/prisma/schema.prisma` | All data model changes |
| `api/src/workers/content-worker.ts` | Pattern for document-worker |
| `api/src/services/memory/memory-mesh.service.ts` | Embedding integration |
| `api/src/services/memory/memory-search.service.ts` | Search pattern |
| `api/src/middleware/auth.middleware.ts` | Middleware pattern |

---

## Role Permissions Matrix

| Action | Admin | Editor | Viewer |
|--------|-------|--------|--------|
| View documents | ✓ | ✓ | ✓ |
| Search/query | ✓ | ✓ | ✓ |
| Upload documents | ✓ | ✓ | ✗ |
| Delete documents | ✓ | ✗ | ✗ |
| Manage members | ✓ | ✗ | ✗ |
| Org settings | ✓ | ✗ | ✗ |

---

## Verification Plan

### Phase 1 Verification
1. Run `npx prisma migrate dev`
2. Create organization via API
3. Add members with different roles
4. Verify role-based access restrictions

### Phase 2 Verification
1. Configure storage provider via env
2. Upload file via service directly
3. Verify file stored and retrievable
4. Test signed URL generation

### Phase 3 Verification
1. Upload PDF via API endpoint
2. Check document status progression (PENDING → PROCESSING → COMPLETED)
3. Verify DocumentChunk records created
4. Verify Memory records created with source_type=DOCUMENT
5. Verify embeddings in Qdrant with correct payload

### Phase 4 Verification
1. Upload multiple documents to organization
2. Run search query within organization
3. Verify results include document chunks
4. Verify AI answer includes citations to documents
5. Test filtering by source_type

### End-to-End Test
```bash
# 1. Create org and add member
curl -X POST /api/organizations -d '{"name":"Acme","slug":"acme"}'
curl -X POST /api/organizations/acme/members -d '{"userId":"...","role":"EDITOR"}'

# 2. Upload document
curl -X POST /api/organizations/acme/documents -F "file=@test.pdf"

# 3. Wait for processing (poll status)
curl /api/organizations/acme/documents/{id}

# 4. Search
curl -X POST /api/search/organization/acme -d '{"query":"What is in the document?"}'
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    React Web Client                         │
│     (Documents UI, Org Management, Search Interface)        │
└────────────────────┬────────────────────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────────────────────┐
│              Express.js API Server                          │
│  ├─ Routes: /organizations, /documents, /search             │
│  ├─ Middleware: auth + organization (role-based)           │
│  └─ Controllers: organization, document, search             │
├──────────────────────────────────────────────────────────────┤
│           Services Layer                                     │
│  ├─ Organization: CRUD, membership, permissions             │
│  ├─ Storage: Pluggable providers (Local/S3/R2)              │
│  ├─ Document: Upload, processing, chunking                  │
│  ├─ Search: Unified cross-source search                     │
│  └─ Existing: AI, embeddings, memory mesh                   │
├──────────────────────────────────────────────────────────────┤
│        Background Workers (BullMQ + Redis)                  │
│  ├─ Content Worker: Existing memory processing              │
│  └─ Document Worker: PDF/DOCX/image → chunks → embeddings  │
├──────────────────────────────────────────────────────────────┤
│                 Data Layer                                   │
└────────────────┬──────────────────────────┬─────────────────┘
                 │                          │
    ┌────────────▼────────────┐  ┌──────────▼────────────┐
    │   PostgreSQL            │  │   Qdrant Vector DB    │
    │ + Organizations         │  │ + org_id filter       │
    │ + Documents             │  │ + source_type filter  │
    │ + DocumentChunks        │  │ + document_id filter  │
    └─────────────────────────┘  └───────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │    File Storage (Pluggable)                         │
    │    Local FS / AWS S3 / Cloudflare R2                │
    └─────────────────────────────────────────────────────┘
```

---

## Implementation Order Summary

1. **Phase 1** - Organizations & multi-tenancy (foundation)
2. **Phase 2** - Storage providers (required for uploads)
3. **Phase 3** - Document processing pipeline (core feature)
4. **Phase 4** - Unified search (ties everything together)
5. **Phase 5** - Integration & polish

Each phase delivers working functionality and can be tested independently.
