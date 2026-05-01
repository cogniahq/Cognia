# Changelog

## v0.2 — Hybrid retrieval (2026-04-30)

The biggest single rewrite to date. Retrieval moves from "single dense ANN with org_id post-filter" to a true production-grade pipeline.

**New capabilities**

- **Hybrid search.** Dense embeddings + BM25 sparse vectors fused via Reciprocal Rank Fusion in a single Qdrant Query API call. ([architecture](./architecture/retrieval))
- **Cross-encoder reranking.** Cohere `rerank-v3.5` (default), Voyage `rerank-2`, Jina `v2`, or passthrough. Replaces the ad-hoc LLM-as-reranker. ([architecture](./architecture/reranking))
- **Per-tenant payload partitioning.** Qdrant `is_tenant: true` on `organization_id` — search inside one tenant only walks that tenant's HNSW subgraph.
- **Query result cache.** Redis 60s TTL keyed by `(org, query, filters)`. Targeted invalidation on writes.
- **Batched embedding ingest.** One OpenAI call per 64 chunks instead of one call per chunk.
- **Nightly mesh recompute.** Mesh moves to a BullMQ repeatable job; live endpoint serves cached snapshots.

**Fixed**

- The "ask Qdrant for the entire org" bug: first-stage `k` is now bounded at `SEARCH_FIRST_STAGE_K` (default 200), regardless of tenant size.
- Silent fallback embedding (deterministic hash of stop-words) is gone. Embedding failures throw `503 embedding_unavailable`.
- Dual title+content embeddings collapsed into one — title prepended to retrieval text. Halves the index size.
- O(N²) force-directed layout removed from the live mesh path.
- `on_disk_payload: true` so metadata doesn't pin everything in RAM.

**SDK & MCP**

- Released `@cogniahq/sdk` 0.1.0 — typed TypeScript client with retries, timeouts, and edge-runtime support.
- Released `@cogniahq/mcp` 0.1.0 — stdio MCP server for Claude Desktop, Cursor, Cline, Continue, Zed.
- Existing `/mcp/v1/jsonrpc` endpoint upgraded to call the new hybrid retrieval pipeline.

**Migration**

If you're upgrading a self-hosted deployment:

```sh
npm run db:deploy            # apply mesh_snapshots migration
npm run clean:qdrant         # rebuild collection with named vectors
npm run backfill:search      # re-embed existing memories
```

The collection schema changed (named vectors `dense_content` + sparse `sparse_bm25`), so the existing index must be rebuilt. The backfill script is idempotent and resumable.

## v0.1 — Initial release (earlier)

- Memory CRUD, document upload, basic search, OAuth integrations, BullMQ-based async pipeline, mesh visualization.
