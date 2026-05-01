# Errors

The SDK throws three error classes, all extending `Error`.

| Class | When |
|---|---|
| `CogniaApiError`     | The server returned 4xx or 5xx after retries are exhausted. |
| `CogniaTimeoutError` | The request took longer than `timeoutMs`. |
| `CogniaNetworkError` | DNS / TCP / TLS failed before a response was received. |

```ts
import {
  CogniaApiError,
  CogniaTimeoutError,
  CogniaNetworkError,
} from '@cogniahq/sdk'

try {
  await cognia.memories.retrieve('mem_404')
} catch (error) {
  if (error instanceof CogniaApiError) {
    console.error(`API error: ${error.code} (${error.status})`)
    console.error('request_id:', error.requestId)
  } else if (error instanceof CogniaTimeoutError) {
    console.error('timeout')
  } else if (error instanceof CogniaNetworkError) {
    console.error('network failure:', error.message)
  } else {
    throw error
  }
}
```

## `CogniaApiError` fields

```ts
class CogniaApiError extends Error {
  status: number               // HTTP status
  code: string                 // e.g. 'forbidden', 'not_found'
  body?: unknown               // parsed response body
  requestId?: string           // x-request-id header
}
```

When filing a support ticket, include `requestId` — Cognia's logs are indexed by it.

## Error codes

| Code | Meaning |
|---|---|
| `bad_request`              | Validation error in the request body. |
| `unauthorized`             | Missing / invalid / revoked API key. |
| `forbidden`                | Key is valid but lacks the required scope. |
| `not_found`                | Resource doesn't exist or isn't visible to this user. |
| `rate_limit_exceeded`      | Too many requests; retry after `Retry-After`. |
| `embedding_unavailable`    | All embedding providers failed. Surfaced loud — never silent. |
| `internal`                 | Server bug. Report with `requestId`. |

## Retry-aware code

The SDK retries automatically. For UX-aware code paths, only catch what's user-actionable:

```ts
try {
  return await cognia.search.query({ query })
} catch (error) {
  if (error instanceof CogniaApiError && error.status === 429) {
    return null // tell the caller to slow down
  }
  if (error instanceof CogniaApiError && error.status === 422) {
    return null // query was rejected (e.g. too long)
  }
  throw error  // everything else — propagate
}
```
