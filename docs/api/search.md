# Search

## `POST /v1/search`

Hybrid retrieval (dense + BM25 sparse, RRF-fused, cross-encoder reranked).

**Required scope:** `search`

**Body:**

```json
{
  "query": "force majeure carve-outs",
  "limit": 10
}
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `query` | string | required | Natural-language query; <1500 chars |
| `limit` | int    | 10       | 1-50 |

**Response:**

```json
{
  "data": [
    {
      "id": "11ee6f8b-…",
      "title": "MSA — Acme Corp 2024",
      "snippet": "Auto-renews for 12 months…",
      "url": "https://cognia.xyz/memories/11ee6f8b",
      "score": 0.94,
      "document": {
        "id": "doc_…",
        "name": "ACME-MSA-2024.pdf",
        "page_number": 8
      }
    }
  ]
}
```

Hits are ordered by descending `score`. `score` is the cross-encoder relevance, normalized to `[0, 1]` — see [Reranking](../architecture/reranking) for the math.

## What runs server-side

```
query string
    │
    ├─► OpenAI text-embedding-3-small  (dense vector, 1536 dims)
    │
    └─► BM25 sparse encoder (token freqs + Qdrant IDF modifier)
                │
                ▼
        Qdrant Query API (single round-trip)
            ├─ prefetch 1: dense ANN, 200 candidates
            ├─ prefetch 2: sparse BM25, 200 candidates
            └─ fusion: Reciprocal Rank Fusion (RRF, k=60)
                │
                ▼
        Postgres hydrate top 50  →  full memory rows
                │
                ▼
        Cohere/Voyage/Jina cross-encoder rerank  →  top N
                │
                ▼
        Response (with score, document, snippet)
```

A 60-second per-tenant Redis cache keys on `(org, query, filters)` to short-circuit repeat calls. Cache is invalidated on memory ingest / update / delete.

See [Architecture → Hybrid retrieval](../architecture/retrieval) for the gory details.

## Latency

| Stage | p50 | p95 |
|---|---|---|
| Query embedding (OpenAI)            | 70ms  | 220ms |
| Qdrant Query API (cold cache)       | 25ms  | 90ms  |
| Postgres hydrate                    | 15ms  | 60ms  |
| Cross-encoder rerank (Cohere)       | 110ms | 320ms |
| **Total (cold cache)**              | **~220ms** | **~700ms** |
| **Total (warm cache)**              | **~5ms**   | **~25ms**  |

Numbers from a single-region production tenant with ~2M memories. Your mileage will vary based on tenant size and reranker provider.

## Errors

| Status | Code | Cause |
|---|---|---|
| `400` | `bad_request`         | Missing or empty `query` |
| `403` | `forbidden`           | Missing `search` scope |
| `422` | `query_too_long`      | Query exceeded 1500 chars |
| `503` | `embedding_unavailable` | OpenAI / Gemini / Ollama all failed (no silent fallback) |
