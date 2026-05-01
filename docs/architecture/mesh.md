# Mesh & clusters

Cognia's "memory mesh" is a 3D visualization of the user's knowledge graph — UMAP-projected coordinates plus typed edges (semantic / topical / temporal). This page explains how it stays cheap to render even with 100k+ memories.

## On-request? No — on a snapshot

The naïve implementation recomputes the mesh every time a user opens it. UMAP on 5,000 vectors is several seconds; force-directed layouts are O(N²). Doing it inline pegs CPU and times out the request.

Cognia caches the mesh in a `MeshSnapshot` row keyed by `(scope_type, scope_id)`:

```sql
CREATE TABLE mesh_snapshots (
  id          UUID PRIMARY KEY,
  scope_type  TEXT,        -- 'user' | 'organization'
  scope_id    UUID,
  node_count  INTEGER,
  edge_count  INTEGER,
  payload     JSONB,       -- the full {nodes, edges} graph
  computed_at TIMESTAMP,
  UNIQUE (scope_type, scope_id)
);
```

The mesh endpoint serves this row directly when it's < 24 hours old:

```ts
GET /api/memory/mesh
  └─ snapshot fresh?  → return payload (1-2ms)
  └─ stale or absent? → schedule recompute, fall through to live
```

## Recompute job

A BullMQ repeatable job (`mesh-recompute`) runs **nightly per scope**. The cron is configurable:

```sh
MESH_RECOMPUTE_CRON='0 3 * * *'  # 03:00 UTC default
```

When it fires, the worker:

1. Pulls every memory + its dense vector for the scope (Qdrant `scroll` with `withVector: ['dense_content']`).
2. Runs UMAP to produce 3D coordinates (capped at 5,000 input nodes; nEpochs scales down with size).
3. Computes mutual-kNN edges with type-weighted scores (`semantic + 0.05`, `topical + 0.02`).
4. Prunes edges to enforce per-node max-degree.
5. Upserts the resulting `{nodes, edges}` blob into `mesh_snapshots`.

Time complexity: O(N log N) for UMAP, O(N · k) for kNN, O(N + E) for layout. **No O(N²) pass anywhere on the live request path or the recompute path.**

## Why no force-directed layout?

The pre-rewrite implementation ran a 150-iteration spring-and-repulse simulation after UMAP. At N=1,000 nodes that's 150 × 500,000 pair comparisons — about 75M ops per render. We dropped it.

UMAP coordinates are visually clean enough on their own; the front-end can apply a *tiny* force pass on the client (max 30 iterations, only between visible nodes) for aesthetic polish. That work scales with what the user sees, not what's in the database.

## Edge types

| Type | Source | Default weight |
|---|---|---|
| `semantic` | Qdrant ANN over the memory's dense vector | base + 0.05 |
| `topical`  | Postgres metadata overlap (`topics`, `categories`, `searchableTerms`) | base + 0.02 |
| `temporal` | Memories within the same hour / day / week / month | base + 0   |

Edges below a similarity threshold (default 0.3) are dropped before mutual-kNN pruning.

## Invalidation

Snapshots are recomputed nightly OR triggered explicitly:

- After a bulk ingest of >1000 memories
- When a user clicks **Refresh mesh** in the UI (sends `?fresh=true`)
- When `MESH_SNAPSHOT_MAX_AGE_MS` expires (default 24h)

Recomputes are deduped: enqueueing while one is already running is a no-op.
