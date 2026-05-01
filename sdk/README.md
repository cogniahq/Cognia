# @cogniahq/sdk

The official TypeScript SDK for the [Cognia](https://cognia.xyz) platform — typed memory, hybrid (dense + sparse) search, and document intelligence.

## Install

```sh
npm install @cogniahq/sdk
# or
pnpm add @cogniahq/sdk
# or
bun add @cogniahq/sdk
```

Requires Node.js 18+ (for native `fetch`). For older runtimes, pass a `fetch` implementation explicitly.

## Quickstart

```ts
import { CogniaClient } from '@cogniahq/sdk'

const cognia = new CogniaClient({
  apiKey: process.env.COGNIA_API_KEY!,
})

// Hybrid search (dense + BM25 sparse, server-side rerank)
const hits = await cognia.search.query({ query: 'indemnity carve-outs', limit: 10 })

for (const hit of hits) {
  console.log(hit.score, hit.title, hit.snippet)
}
```

## Authentication

Pass your API key when constructing the client. Keys come in two flavors:

- `ck_live_…` — production keys
- `ck_test_…` — test/staging keys

Generate one in the Cognia dashboard under **Settings → API keys**. Each key has scopes (`memories.read`, `memories.write`, `search`, `*`) that determine which methods it can call.

```ts
const cognia = new CogniaClient({
  apiKey: process.env.COGNIA_API_KEY!,
  baseUrl: 'https://api.cognia.xyz',  // override for self-hosted deployments
  timeoutMs: 30_000,
  maxRetries: 3,
})
```

## API

### `cognia.search.query(options)`

Hybrid search across the API key's tenant. Server-side combines:

- Dense embeddings (OpenAI `text-embedding-3-small` by default)
- BM25 sparse retrieval (handled by Qdrant with `modifier: idf`)
- Cross-encoder reranking (Cohere/Voyage/Jina depending on tenant config)

```ts
const hits = await cognia.search.query({
  query: 'force majeure clause',
  limit: 10,
})

// Each hit:
// {
//   id: string                 // memory id
//   title: string | null
//   snippet: string            // ~300 char preview
//   url: string | null
//   score: number              // higher = more relevant
//   document?: {
//     id?: string
//     name?: string            // original filename
//     page_number?: number
//   }
// }
```

### `cognia.memories.list(options?)`

Paginated memory listing.

```ts
const page = await cognia.memories.list({ limit: 50, q: 'kickoff' })
console.log(page.data, page.next_cursor)
```

### `cognia.memories.iterate(options?)`

Async iterator that walks every page lazily — convenient for backfills:

```ts
for await (const memory of cognia.memories.iterate({ q: 'invoice' })) {
  // process memory
}
```

### `cognia.memories.retrieve(id)`

```ts
const memory = await cognia.memories.retrieve('mem_abc...')
```

### `cognia.memories.update(id, input)`

```ts
await cognia.memories.update('mem_abc...', {
  title: 'Renamed',
  content: 'Updated body',
})
```

### `cognia.memories.delete(id)`

Soft-delete; the memory is hidden from search and listings but recoverable for 30 days.

```ts
await cognia.memories.delete('mem_abc...')
```

## Errors

Every error inherits from `Error` and includes structured fields:

| Class | When it's thrown |
|---|---|
| `CogniaApiError`    | API returned 4xx/5xx after retries. Has `.status`, `.code`, `.body`, `.requestId`. |
| `CogniaTimeoutError`| Request exceeded `timeoutMs`. |
| `CogniaNetworkError`| DNS / TCP / TLS failure. |

```ts
import { CogniaApiError } from '@cogniahq/sdk'

try {
  await cognia.memories.retrieve('mem_404')
} catch (error) {
  if (error instanceof CogniaApiError && error.status === 404) {
    // handle gracefully
  } else {
    throw error
  }
}
```

## Retries

The client retries idempotent failures automatically:

- `408`, `429`, `502`, `503`, `504` HTTP responses
- Network errors (TCP / DNS)
- Timeouts

Retries use exponential backoff (500ms → 1s → 2s → … capped at 30s) plus jitter, and respect `Retry-After` headers when present.

## Custom transports

Inject your own fetch (Cloudflare Workers, Bun, undici, etc.):

```ts
import { fetch as undiciFetch } from 'undici'

const cognia = new CogniaClient({
  apiKey: process.env.COGNIA_API_KEY!,
  fetch: undiciFetch as unknown as typeof fetch,
})
```

## License

Apache-2.0
