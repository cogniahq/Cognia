# Errors & retries

## Error envelope

Every non-2xx response from `/v1/*` follows the same shape:

```json
{
  "error": "forbidden",
  "message": "Missing scope: search",
  "request_id": "req_01HF0WQ…"
}
```

Include `request_id` when filing support tickets — Cognia indexes by it.

## Status code map

| Code | Meaning | Retry? |
|---|---|---|
| `400` | Malformed request, validation error | No — fix the input |
| `401` | Bad / revoked / missing API key | No |
| `403` | Key lacks the required scope | No |
| `404` | Resource not found (or not visible to this user) | No |
| `408` | Server-side request timeout | Yes |
| `409` | Concurrent write conflict | Yes (with idempotency key) |
| `422` | Semantic validation failed (e.g. embedding limit exceeded) | No |
| `429` | Rate limit exceeded | Yes (respect `Retry-After`) |
| `500` | Bug — please report with `request_id` | Yes (idempotent calls only) |
| `502 / 503 / 504` | Upstream / cold-start / timeout | Yes |

The SDK retries the **Yes** rows automatically with exponential backoff + jitter. You shouldn't need a retry library on top.

## SDK error classes

```ts
import {
  CogniaApiError,
  CogniaTimeoutError,
  CogniaNetworkError,
} from '@cogniahq/sdk'

try {
  await cognia.search.query({ query })
} catch (error) {
  if (error instanceof CogniaApiError && error.status === 429) {
    // Already retried `maxRetries` times; surface to caller
  } else if (error instanceof CogniaTimeoutError) {
    // Increase timeoutMs or shrink the request
  } else if (error instanceof CogniaNetworkError) {
    // DNS / TCP / TLS — likely transient, but retries are exhausted
  } else {
    throw error
  }
}
```

Every `CogniaApiError` carries:

| Field | Description |
|---|---|
| `.status`     | HTTP status code |
| `.code`       | Machine-readable error key (e.g. `forbidden`, `rate_limit_exceeded`) |
| `.message`    | Human-readable summary |
| `.body`       | Parsed response body, when available |
| `.requestId`  | `x-request-id` from the response |

## Retry strategy

The default backoff schedule:

```
attempt 0  ->  immediate
attempt 1  ->  ~500ms ± 20% jitter
attempt 2  ->  ~1s    ± 20%
attempt 3  ->  ~2s    ± 20%
attempt 4  ->  ~4s    ± 20%
…capped at 30s per delay.
```

When the response carries `Retry-After`, that header wins — useful for `429` from upstream rate limiting (Cohere / Voyage / OpenAI).

Tune both knobs at the client level:

```ts
new CogniaClient({
  apiKey,
  maxRetries: 5,
  timeoutMs: 60_000,
})
```

## Idempotency for writes

`PATCH /v1/memories/:id` and `DELETE /v1/memories/:id` are idempotent — retrying the same call is safe. For `POST` endpoints (when added in future), pass an `Idempotency-Key` header (uuid) to dedupe on the server.
