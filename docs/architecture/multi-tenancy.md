# Multi-tenancy

Cognia is multi-tenant by default. Every memory, document, embedding, and search call is scoped to an `organization_id`. This page explains how isolation is enforced at every layer.

## Postgres

Every row carries `organization_id` (or `user_id` for personal scopes). All API queries include it as a `WHERE` filter. Foreign keys cascade: deleting an organization cascade-deletes its memberships, memories, documents, etc.

Indexes are **compound on `organization_id`** to keep per-tenant scans cheap:

```
@@index([organization_id])
@@index([organization_id, status])
@@index([organization_id, created_at(sort: Desc)])
```

## Qdrant

A single collection (`memory_embeddings`) with the `organization_id` payload field flagged `is_tenant: true`:

```ts
// src/lib/qdrant.lib.ts
const PAYLOAD_INDEXES = [
  { field: 'organization_id', schema: 'keyword', isTenant: true },
  // …
]
```

What this does in Qdrant: instead of one global HNSW graph that you post-filter, the index is **partitioned per tenant**. A search inside `org_X` walks only `org_X`'s subgraph. As tenants are added, search latency for any individual tenant stays roughly constant.

This is the recommended pattern for SaaS at >10 tenants. The alternative (one collection per tenant) doesn't scale to thousands of tenants without operational overhead.

## Search cache (Redis)

The `search-cache` keys all entries by `organization_id`:

```
search_cache:v1:<organizationId>:<userScope>:<queryHash>:<filterHash>
```

Cross-tenant cache poisoning is impossible — the org id is in the key.

Invalidation is targeted: when a memory is created / updated / deleted, only that organization's cache namespace is wiped.

## API keys

Each API key is bound to a user, who is bound to one or more organizations via `organization_members`. The middleware looks up the API key, sets `req.apiKey.organizationId`, and every downstream service trusts that field.

API keys with `*` scope can do anything **for their organization**. There is no super-user scope that crosses tenant boundaries — that's deliberate; cross-tenant operations are platform-level and go through a separate, more restricted auth path.

## MCP server

The `@cogniahq/mcp` server takes the API key in the env var, so the tenant scope is fixed at server startup. Calling tools with a different tenant is impossible without restarting with a different key.

## Personal vs organization scope

Some users (Chrome extension, mobile app) have **personal memories** with no `organization_id`. These are scoped purely by `user_id`. They don't appear in organization searches; organization searches don't see them.

The `unifiedSearchService` runs **two parallel queries** when a user is logged into both — one over the org and one over their personal extension data — and fuses the rankings via RRF. Each ranking respects its own scope filter; results from one scope can never leak into another.

## What a hostile actor cannot do

- Read another tenant's memories — every layer filters by org_id; there is no SQL injection vector in the code paths.
- Pollute another tenant's cache — keys include the org_id.
- See another tenant's mesh — the mesh snapshot is keyed by `(scope_type, scope_id)`.
- Bypass the rate limiter — it's keyed by API key id, not by IP.
- Use a stolen key indefinitely — keys are hashed (SHA-256), revocation is immediate, and audit logs include `apiKey.id` on every call.

## What's NOT yet hardened

- **Memory upload size limits per tenant.** Currently a global cap. A high-volume tenant can theoretically exhaust the embedding budget for the cluster. Per-tenant budgets land in 0.2.
- **Bring-your-own-key (BYOK) for the embedding model.** Some enterprise customers want their own OpenAI key for compliance reasons. Plumbed but not productized yet.
