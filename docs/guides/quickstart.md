# Quickstart

Get a working Cognia integration — search across memories from your code or AI assistant — in under five minutes.

## 1. Get an API key

1. Sign in at [cognia.xyz](https://cognia.xyz).
2. Navigate to **Settings → API keys → Create key**.
3. Pick scopes:
   - `search` — required for hybrid retrieval
   - `memories.read` — required to read memory content
   - `memories.write` — only if you'll be updating/deleting memories
4. Copy the key (starts with `ck_live_…`). It's shown once.

## 2. Pick your integration

::: code-group

```ts [SDK (Node / Deno / Bun)]
// npm install @cogniahq/sdk
import { CogniaClient } from '@cogniahq/sdk'

const cognia = new CogniaClient({ apiKey: process.env.COGNIA_API_KEY! })

const hits = await cognia.search.query({
  query: 'force majeure clauses we negotiated last year',
  limit: 10,
})
console.log(hits)
```

```jsonc [Claude Desktop (MCP)]
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "cognia": {
      "command": "npx",
      "args": ["-y", "@cogniahq/mcp"],
      "env": { "COGNIA_API_KEY": "ck_live_…" }
    }
  }
}
```

```bash [REST (curl)]
curl -X POST https://api.cognia.xyz/v1/search \
  -H "Authorization: Bearer ck_live_…" \
  -H "Content-Type: application/json" \
  -d '{"query": "force majeure clauses", "limit": 10}'
```

:::

## 3. What you get back

```json
{
  "data": [
    {
      "id": "11ee6f8b-…",
      "title": "MSA — Acme Corp 2024",
      "snippet": "Force majeure carve-out modified in §14.3 to exclude…",
      "url": "https://cognia.xyz/memories/11ee6f8b",
      "score": 0.94,
      "document": {
        "id": "doc_…",
        "name": "ACME-MSA-2024.pdf",
        "page_number": 12
      }
    }
  ]
}
```

The `score` is post-rerank — higher is more relevant. Memories are ordered by descending score.

## 4. What's actually happening

Each search runs through a five-stage pipeline:

1. **Embed** the query (OpenAI `text-embedding-3-small`) and tokenize it (BM25 sparse vector).
2. **Hybrid search** — Qdrant runs dense ANN and sparse BM25 in a single Query API call, fused via Reciprocal Rank Fusion.
3. **Cache hit?** — A 60-second Redis cache keyed by `(org, query, filters)` short-circuits stage 2.
4. **Rerank** — Top 50 candidates go to a cross-encoder (Cohere `rerank-v3.5` by default).
5. **Hydrate** — Top N results are joined with Postgres for full memory content + document metadata.

See [Hybrid retrieval](../architecture/retrieval) for the details.

## Next steps

- [SDK reference](../sdk/) — full TypeScript API
- [MCP setup](../mcp/) — Claude Desktop, Cursor, Cline
- [REST API](../api/) — every endpoint
- [Architecture](../architecture/retrieval) — how the search engine is built
