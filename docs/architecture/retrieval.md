# Hybrid retrieval

Cognia's search engine is not a single cosine-similarity lookup. It's a five-stage pipeline designed to scale to millions of memories per tenant without sacrificing recall on exact-match queries.

## The five stages

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ENCODE                                                       │
│    query → dense embedding (OpenAI text-embedding-3-small)      │
│    query → sparse BM25 vector  (token freqs + Qdrant IDF)       │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CACHE                                                        │
│    Redis: (org, query_hash, filter_hash) → memory_ids[]  60s    │
│    Hit  → skip to stage 5.                                      │
│    Miss → proceed.                                              │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. HYBRID SEARCH (single Qdrant Query API call)                 │
│    prefetch:                                                    │
│      ├─ dense ANN, 200 candidates, filter: organization_id      │
│      └─ sparse BM25, 200 candidates, filter: organization_id    │
│    fusion: Reciprocal Rank Fusion (RRF, k=60)                   │
│    output: deduplicated top 200 hits                            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. RERANK (cross-encoder)                                       │
│    Top 50 candidates → Cohere rerank-v3.5                       │
│    (or Voyage rerank-2, Jina v2, or passthrough)                │
│    output: top N reordered by relevance                         │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. HYDRATE                                                      │
│    Postgres: SELECT memory + first document_chunk WHERE id IN…  │
│    Trim to top N, build snippets, return.                       │
└─────────────────────────────────────────────────────────────────┘
```

## Why hybrid?

Pure dense retrieval has a known weakness: it loses on **exact-token queries**. A user searching for `Issue #4421`, `§14.3`, or `RFC 7230` wants the document that contains those exact tokens. Dense embeddings smooth them away.

BM25 sparse retrieval is the inverse — strong on exact tokens, weak on paraphrasing. ("force majeure" matches a doc that says "force majeure" but misses one that says "act of god".)

Hybrid retrieval gets both. We use Qdrant's [Query API](https://qdrant.tech/documentation/concepts/hybrid-queries/) to run dense and sparse in a single round-trip, then fuse via [Reciprocal Rank Fusion](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf):

$$
\text{RRF}(d) = \sum_{r \in \text{rankings}} \frac{1}{k + \text{rank}_r(d)}
$$

with `k = 60` — a constant that flattens the head and gives middle-ranked-but-multi-list hits a fair shot.

## Scaling: per-tenant payload partitioning

Naïve "one collection, filter by org_id" suffers as the collection grows: HNSW has to walk a global graph and post-filter. Qdrant's `is_tenant: true` flag on the `organization_id` payload index changes this — the HNSW graph is **partitioned per tenant**, so a search inside one org only walks that tenant's subgraph.

```ts
// src/lib/qdrant.lib.ts
const PAYLOAD_INDEXES = [
  { field: 'organization_id', schema: 'keyword', isTenant: true },
  // …other indexes
]
```

Plus `on_disk_payload: true` so metadata doesn't pin the entire dataset in RAM as the index grows.

## What we do NOT do

- **No `limit = total memory count`.** First-stage `k` is bounded at 200 regardless of tenant size. The original implementation passed the full org count as the Qdrant limit — defeating ANN. That bug is fixed.
- **No silent fallback embedding.** When the embedding provider fails, the API returns `503 embedding_unavailable`. The legacy "deterministic hash of stop-words" fallback was producing meaningless vectors that quietly tanked recall.
- **No dual title+content vectors.** A single embedding per memory; the title is prepended to the retrieval text.
- **No LLM-as-reranker.** A purpose-built cross-encoder is faster and more accurate than asking GPT-4 to JSON-rank candidates.

## Tenant isolation

Every search filter is enforced server-side via Qdrant payload filters and Postgres `WHERE organization_id = …`. There is **no client-controlled bypass** — even an API key with `*` scope cannot read another org's data.

The Redis query cache is keyed by org_id, so cross-tenant cache poisoning is impossible.

## Observability

Each request emits:

```
[unified-search] completed
  organizationId: org_…
  durationMs:     228
  cacheHit:       false
  candidates:     200
  reranked:       50
  returned:       10
  rerankProvider: cohere
```

Filterable in the audit log via `event_category = "search"`.
