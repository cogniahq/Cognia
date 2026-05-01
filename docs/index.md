---
layout: home

hero:
  name: Cognia
  text: Memory that thinks with you
  tagline: Production-grade hybrid retrieval, typed SDK, and MCP server. Drop your private knowledge into Claude, Cursor, or your own product in minutes.
  actions:
    - theme: brand
      text: Quickstart →
      link: /guides/quickstart
    - theme: alt
      text: SDK
      link: /sdk/
    - theme: alt
      text: MCP server
      link: /mcp/

features:
  - title: Hybrid retrieval
    details: Dense embeddings (OpenAI / Gemini) fused with BM25 sparse vectors via Reciprocal Rank Fusion in a single Qdrant query.
    link: /architecture/retrieval
  - title: Cross-encoder rerank
    details: Cohere / Voyage / Jina reranker on every query. Pluggable; falls back to passthrough when no key is configured.
    link: /architecture/reranking
  - title: Multi-tenant from day one
    details: Per-tenant payload partitioning in Qdrant (`is_tenant`), org-scoped query cache, and tenant-scoped invalidation on writes.
    link: /architecture/multi-tenancy
  - title: TypeScript SDK
    details: Strict types, automatic retries with backoff, pluggable fetch, AbortController support, ESM + CJS dual build.
    link: /sdk/
  - title: MCP server
    details: One npx command makes Cognia available to Claude Desktop, Cursor, Cline, Continue — any MCP-compatible client.
    link: /mcp/
  - title: Async ingest pipeline
    details: BullMQ-based document worker batches embeddings (one OpenAI call per N chunks), writes Postgres + Qdrant atomically, schedules nightly mesh recompute.
    link: /architecture/ingest
---
