# `CogniaClient`

The top-level entry point.

```ts
import { CogniaClient } from '@cogniahq/sdk'

const cognia = new CogniaClient({
  apiKey: process.env.COGNIA_API_KEY!,
})
```

## Constructor options

```ts
interface CogniaClientOptions {
  apiKey: string
  baseUrl?: string       // default: 'https://api.cognia.xyz'
  userAgent?: string     // appended to the SDK identifier
  timeoutMs?: number     // default: 30_000
  maxRetries?: number    // default: 3
  fetch?: typeof fetch   // default: globalThis.fetch
}
```

| Option | Notes |
|---|---|
| `apiKey`     | Required. Throws if missing. |
| `baseUrl`    | Override for self-hosted Cognia or staging. Trailing slashes trimmed. |
| `userAgent`  | Goes after `cognia-sdk-js/<version>` so we can identify the integration. |
| `timeoutMs`  | Per-request timeout. Throws `CogniaTimeoutError`. |
| `maxRetries` | Applies to retryable errors (5xx, 408, 429, network). |
| `fetch`      | Inject Cloudflare Workers / undici / etc. |

## Sub-clients

The client exposes two namespaces:

| Property | Type | See |
|---|---|---|
| `cognia.search`   | `SearchAPI`   | [Search](./search) |
| `cognia.memories` | `MemoriesAPI` | [Memories](./memories) |

These are property-style; they're created once per `CogniaClient` and share its config.

## Cancellation

Every method accepts an `AbortSignal` (via the underlying transport). Pass it through the request:

```ts
const ctrl = new AbortController()
setTimeout(() => ctrl.abort(), 5_000)

await cognia.search.query({ query: 'q', signal: ctrl.signal })
//   ^ supported on every method on `cognia.*`
```

Aborting before the request fires throws an `AbortError`. Aborting mid-flight throws too — but does **not** roll back any server-side state.

## Headers sent

Every request includes:

```
Authorization: Bearer ck_live_…
User-Agent:    cognia-sdk-js/<version> [<your custom>]
Accept:        application/json
Content-Type:  application/json   (for body-bearing methods only)
```
