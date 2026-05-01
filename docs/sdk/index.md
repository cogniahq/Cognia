# `@cogniahq/sdk`

The official TypeScript SDK. Strict types, automatic retries, pluggable fetch, ESM + CJS, Node 18+.

```sh
npm install @cogniahq/sdk
```

## Why use it

- **Type safety** — every response is typed; no `any` escaping.
- **Retries built-in** — exponential backoff with jitter, respects `Retry-After`.
- **Timeout-safe** — per-request `AbortController` from a single `timeoutMs` knob.
- **Edge-friendly** — pluggable `fetch` for Workers, Bun, undici.
- **Tree-shakeable** — pure ESM; CJS available for legacy stacks.

## At a glance

```ts
import { CogniaClient } from '@cogniahq/sdk'

const cognia = new CogniaClient({ apiKey: process.env.COGNIA_API_KEY! })

// Hybrid search
const hits = await cognia.search.query({ query: 'q1 sales calls', limit: 10 })

// Memory CRUD
const memory = await cognia.memories.retrieve(hits[0].id)
await cognia.memories.update(memory.id, { title: 'Renamed' })
await cognia.memories.delete(memory.id)

// Async iteration
for await (const m of cognia.memories.iterate()) {
  if (m.created_at < '2025-01-01') break
}
```

## Pages

- [Installation](./install)
- [Client reference](./client)
- [Search](./search)
- [Memories](./memories)
- [Errors](./errors)
- [Examples](./examples)
