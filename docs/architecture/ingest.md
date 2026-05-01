# Ingest pipeline

How a document becomes searchable. Async, batched, idempotent.

```
upload (PDF / DOCX / MD)
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 1. STORAGE                                              │
│    S3 / R2 / local filesystem                           │
│    Returns storage_path + Document row (status=PENDING) │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 2. ENQUEUE                                              │
│    BullMQ "process-document" job                        │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 3. EXTRACT TEXT (document-worker)                       │
│    pdf-parse / mammoth / plain                          │
│    Falls back to OCR (vision model) for scanned PDFs    │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 4. CHUNK                                                │
│    Target 500 tokens, max 1000, overlap 50              │
│    Sentence-boundary aware                              │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 5. PERSIST MEMORY ROWS                                  │
│    One Memory + structured page_metadata per chunk      │
│    All Postgres writes happen first; Qdrant comes next  │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 6. BATCHED EMBED + UPSERT                               │
│    Loop: 64 chunks per batch                            │
│      ├─ aiProvider.generateEmbeddingsBatch([texts])     │
│      │     (one OpenAI call per batch, not per chunk)   │
│      ├─ encodeSparse(text)        per chunk             │
│      └─ qdrantClient.upsert(...)  one batch call        │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 7. CHUNK ROWS                                           │
│    DocumentChunk rows linked to memory + document       │
│    Used for highlight rendering and page-number lookups │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 8. INVALIDATE CACHE                                     │
│    searchCache.invalidateOrganization(org_id)           │
│    Schedule nightly mesh recompute (idempotent)         │
└─────────────────────────────────────────────────────────┘
        │
        ▼
   status = COMPLETED
```

## Why batched embedding

Naïvely, you embed each chunk with one OpenAI call. For a 200-chunk PDF that's 200 round-trips and ~60s of network wait. The OpenAI Embeddings API accepts up to 2048 inputs per call — so we batch 64 at a time and pay one round-trip per batch:

```
200 chunks / 64 = 4 batches
4 batches × ~150ms = ~600ms for embedding
vs.
200 chunks × ~70ms = ~14s naïve
```

Batching also reduces our share of OpenAI's per-second TPM and RPM limits. And the OpenAI Batch API (24h SLA, 50% cheaper) is plumbed through the same code path for backfills.

## Sparse vector generation

For each chunk, we encode a BM25 sparse vector locally:

```ts
// src/lib/sparse-encoder.lib.ts
export function encodeSparse(text: string): SparseVector | null
```

The encoder:
1. Lowercases and tokenizes (stripping punctuation, preserving alphanumerics)
2. Drops stop-words and tokens shorter than 2 chars
3. Stems with a simple suffix-stripping rule (handles English doubling: `running` → `run`)
4. Hashes each token to a uint32 index (djb2)
5. Sums term frequencies into `{indices, values}`

Qdrant computes IDF and BM25 scoring server-side via `modifier: "idf"` on the sparse vector config — we don't have to ship a corpus statistics table.

## Failure modes

- **OpenAI 5xx mid-batch** — the batch fails; the worker retries with exponential backoff. After all retries, the job is marked FAILED and the memory rows remain (so they can be re-embedded by `npm run backfill:search`).
- **Qdrant unreachable** — Postgres writes have already succeeded; Qdrant upsert is queued (retried by the BullMQ stalled-job handler). Search will miss those memories until upsert succeeds.
- **OCR failure** — chunks for unreadable pages are skipped with a logged warning. The document completes with a partial chunk count.

## Backfill

To rebuild the entire index from scratch (e.g. after upgrading the embedding model or sparse encoder):

```sh
npm run backfill:search                  # all orgs
npm run backfill:search -- --org=<uuid>  # single org
npm run backfill:search -- --cursor=<id> # resume after a crash
```

The script is idempotent — existing Qdrant points for each memory are deleted before the new dense+sparse point is upserted.
