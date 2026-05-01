# Ingesting documents

Three paths to get content into Cognia. Pick whichever fits your stack.

## 1. Web upload (UI)

The simplest route. Drag a PDF, DOCX, or markdown file into the dashboard at `cognia.xyz/documents`. Cognia handles extraction, chunking, embedding, and indexing — the document becomes searchable in seconds.

## 2. REST API (programmatic)

For bulk imports or scripted ingestion, use the platform-API endpoints:

```sh
# Step 1: create an upload session
curl -X POST https://api.cognia.xyz/api/platform/v1/documents/upload-sessions \
  -H "Authorization: Bearer ck_live_…" \
  -H "Content-Type: application/json" \
  -d '{"filename": "ACME-MSA-2024.pdf", "mime_type": "application/pdf"}'

# → returns { session_id, upload_url }

# Step 2: stream the file content
curl -X POST "$upload_url" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@ACME-MSA-2024.pdf"

# Step 3: complete the session (kicks off processing)
curl -X POST "https://api.cognia.xyz/api/platform/v1/documents/upload-sessions/$session_id/complete" \
  -H "Authorization: Bearer ck_live_…"
```

Processing is async. Poll `GET /api/platform/v1/documents/$documentId` for `status: COMPLETED`.

## 3. Browser extension

The Chrome / Firefox extension auto-captures pages you read. Each page becomes a memory tagged with `source_type: EXTENSION`. Useful for personal knowledge bases — the extension's memories are scoped to **your user**, not your org, by default.

## Chunking & extraction

Internally, every ingest path runs the same pipeline:

| Stage | What |
|---|---|
| **Extraction** | `pdf-parse` (PDFs), `mammoth` (DOCX), markdown / plain text passthrough. Falls back to a vision model for scanned PDFs. |
| **Chunking**   | Target 500 tokens, max 1000, overlap 50. Sentence-boundary aware. |
| **Memory rows** | One Memory per chunk, with `page_metadata` carrying chunk_index and page_number. |
| **Embedding**  | Batched (64 chunks per OpenAI call) dense + sparse. |
| **Indexing**   | Single Qdrant upsert per batch. |

See [Architecture → Ingest pipeline](../architecture/ingest) for the full diagram.

## Speed expectations

| Document size | End-to-end time |
|---|---|
| 5 pages   | ~3-5 seconds |
| 50 pages  | ~15-30 seconds |
| 500 pages | ~2-5 minutes |
| 5000 pages | ~20-40 minutes (uses OpenAI Batch API for backfills) |

The bottleneck is OpenAI's embeddings API, not Cognia. Tenants on a higher OpenAI rate-limit tier ingest faster.

## Re-indexing after model upgrades

When the embedding model changes (e.g. switching from `text-embedding-3-small` to `text-embedding-3-large`), the whole index must be rebuilt. Cognia ships a backfill script:

```sh
npm run backfill:search                  # all tenants
npm run backfill:search -- --org=<uuid>  # one tenant
```

The script is idempotent and resumable — pass `--cursor=<lastMemoryId>` to pick up after a crash.

## What you cannot ingest yet

- Audio / video transcripts (planned: Whisper-based pipeline)
- Live streams (Slack, GitHub, Notion are integrated; arbitrary webhooks are not)
- Documents > 50MB per file (raise via support)
